import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";

const DAN_CALLBACK_URL = "tureesly://dan-callback";

type DanMode = "sign_in" | "sign_up" | "link";

type StartResponse = {
  authorize_url?: string;
};

type FinishSignupResponse = {
  ok?: boolean;
  error?: string;
};

type CompleteResponse = {
  token_hash?: string;
  type?: "magiclink";
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function callbackParam(url: string, key: string) {
  const parsed = Linking.parse(url);
  const value = parsed.queryParams?.[key];
  return Array.isArray(value) ? value[0] : typeof value === "string" ? value : "";
}

/**
 * DAN browser session-г эхлүүлж, амжилттай дууссаны дараа стандарт Supabase session үүсгэнэ.
 * Client ID / Secret болон регистрийн дугаар энэ код руу огт орж ирдэггүй.
 */
export async function authenticateWithDan(mode: DanMode, options?: { termsAccepted?: boolean }) {
  const { data: startData, error: startError } = await supabase.functions.invoke<StartResponse>(
    "dan-auth-start",
    { body: { mode, termsAccepted: options?.termsAccepted === true } },
  );

  if (startError || !startData?.authorize_url) {
    throw new Error(errorMessage(startError, "DAN нэвтрэхийг эхлүүлж чадсангүй."));
  }

  const browserResult = await WebBrowser.openAuthSessionAsync(
    startData.authorize_url,
    DAN_CALLBACK_URL,
  );

  if (browserResult.type !== "success") {
    if (browserResult.type === "cancel" || browserResult.type === "dismiss") {
      throw new Error("DAN нэвтрэх цуцлагдсан байна.");
    }

    throw new Error(
      "DAN нэвтрэх хуудас дууссангүй. Хэрэв SSO дээр “Load failed” гарсан бол DAN талын түр ачааллын алдаа байж болно. Хэсэг хүлээгээд дахин оролдоно уу.",
    );
  }

  const errorCode = callbackParam(browserResult.url, "error");
  if (errorCode) {
    if (errorCode === "identity_already_linked") {
      throw new Error("Энэ DAN иргэн өөр хэрэглэгчийн бүртгэлтэй холбогдсон байна.");
    }
    if (errorCode === "identity_already_registered") {
      throw new Error("Энэ DAN иргэн өмнө нь бүртгүүлсэн байна. Утасны дугаар, нууц үгээрээ нэвтэрнэ үү.");
    }
    if (errorCode === "identity_not_linked") {
      throw new Error("Энэ DAN иргэн Tureesly account-тай хараахан холбогдоогүй байна. Өмнөх account-аараа нэвтэрч Profile → DAN-аар баталгаажуулахыг сонгоно уу.");
    }
    throw new Error("DAN нэвтрэх амжилтгүй боллоо. Дахин оролдоно уу.");
  }

  const handoff = callbackParam(browserResult.url, "handoff");
  if (!handoff) {
    throw new Error("DAN нэвтрэх хариу дутуу байна. Дахин оролдоно уу.");
  }

  const { data: completeData, error: completeError } = await supabase.functions.invoke<CompleteResponse>(
    "dan-auth-complete",
    { body: { handoff } },
  );

  if (completeError || !completeData?.token_hash) {
    throw new Error(errorMessage(completeError, "DAN session үүсгэж чадсангүй."));
  }

  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: completeData.token_hash,
    type: "magiclink",
  });

  if (verifyError || !verified.session || !verified.user?.id) {
    throw new Error(errorMessage(verifyError, "DAN нэвтрэх session баталгаажаагүй байна."));
  }

  return {
    userId: verified.user.id,
    linked: callbackParam(browserResult.url, "linked") === "1",
  };
}
export async function finishDanSignUp(phone: string, password: string) {
  const { data, error } = await supabase.functions.invoke<FinishSignupResponse>(
    "dan-auth-finish-signup",
    { body: { phone, password } },
  );

  if (error || !data?.ok) {
    const code = data?.error;
    if (code === "invalid_phone") throw new Error("8 оронтой утасны дугаар оруулна уу.");
    if (code === "weak_password") throw new Error("Нууц үг 6-аас дээш тэмдэгттэй байна.");
    if (code === "phone_already_in_use") throw new Error("Энэ утасны дугаар өөр Tureesly бүртгэл дээр ашиглагдаж байна.");
    if (code === "terms_acceptance_required") throw new Error("Үйлчилгээний нөхцөлийг эхлээд зөвшөөрнө үү.");
    throw new Error(errorMessage(error, "Бүртгэлийн мэдээллийг хадгалж чадсангүй."));
  }
}
