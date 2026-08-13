import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  adminClient,
  appCallbackUrl,
  getDanCitizen,
  getDanConfig,
  hmacSha256,
  randomToken,
  redirectToApp,
  sha256,
  exchangeDanCode,
} from "../_shared/dan.ts";

type AuthState = {
  mode: "sign_in" | "sign_up" | "link";
  link_user_id: string | null;
  terms_accepted_at: string | null;
};

serve(async (req: Request) => {
  const url = new URL(req.url);
  const providerError = url.searchParams.get("error");
  const code = url.searchParams.get("code")?.trim() ?? "";
  const rawState = url.searchParams.get("state")?.trim() ?? "";

  if (providerError || !code || !rawState) {
    return redirectToApp({ error: "cancelled_or_invalid" });
  }

  try {
    const config = getDanConfig();
    const admin = adminClient(config);
    const stateHash = await sha256(rawState);
    const now = new Date().toISOString();

    // State-г нэг удаа л ашиглана. Ингэснээр callback дахин тоглуулах боломжгүй.
    const { data: state, error: stateError } = await admin
      .from("dan_auth_states")
      .update({ consumed_at: now })
      .eq("state_hash", stateHash)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .select("mode, link_user_id, terms_accepted_at")
      .maybeSingle<AuthState>();

    if (stateError || !state) {
      return redirectToApp({ error: "expired_or_invalid" });
    }

    const accessToken = await exchangeDanCode(config, code);
    const citizen = await getDanCitizen(accessToken);
    const identityHash = await hmacSha256(citizen.registerNumber, config.identityPepper);

    const { data: existingIdentity, error: identityLookupError } = await admin
      .from("dan_identities")
      .select("user_id")
      .eq("identity_hash", identityHash)
      .maybeSingle<{ user_id: string }>();

    if (identityLookupError) throw new Error("Unable to look up DAN identity.");

    let userId = existingIdentity?.user_id ?? null;

    // Бүртгүүлэх болон нэвтрэх нь тусдаа үйлдэл. Өмнө нь DAN account
    // үүсгэсэн иргэн дахин бүртгүүлэхгүй, "DAN-аар нэвтрэх"-ийг ашиглана.
    if (state.mode === "sign_up" && userId) {
      return redirectToApp({ error: "identity_already_registered" });
    }

    if (state.mode === "link") {
      if (!state.link_user_id) throw new Error("Link target is missing.");
      if (userId && userId !== state.link_user_id) {
        return redirectToApp({ error: "identity_already_linked" });
      }

      userId = state.link_user_id;
      if (!existingIdentity) {
        const { error: insertIdentityError } = await admin.from("dan_identities").insert({
          user_id: userId,
          identity_hash: identityHash,
          verified_name: citizen.verifiedName,
        });
        if (insertIdentityError) throw new Error("Unable to link DAN identity.");
      }
      if (citizen.publicName) {
        const { error: publicNameError } = await admin.from("users").update({ name: citizen.publicName }).eq("id", userId);
        if (publicNameError) {
          throw new Error("Unable to update the DAN-verified display name.");
        }
      }

    } else if (!userId) {
      // Legacy account өөрөө DAN-аар sign in хийхэд шинэ account битгий үүсгэ.
      // Эхлээд тухайн хуучин account-аасаа Profile → DAN-аар баталгаажуулах ёстой.
      if (state.mode === "sign_in") {
        return redirectToApp({ error: "identity_not_linked" });
      }
      const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
        email: `dan-${crypto.randomUUID()}@identity.tureesly.invalid`,
        email_confirm: true,
        user_metadata: { auth_provider: "dan" },
      });

      if (createUserError || !createdUser.user?.id) {
        throw new Error("Unable to create DAN account.");
      }

      userId = createdUser.user.id;
      const { error: profileError } = await admin.from("users").upsert(
        {
          id: userId,
          // The full legal name remains private; only its shortened DAN-derived form is public.
          name: citizen.publicName ?? "DAN хэрэглэгч",
          phone: null,
          terms_accepted_at: state.terms_accepted_at,
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (profileError) throw new Error("Unable to create user profile.");

      const { error: insertIdentityError } = await admin.from("dan_identities").insert({
        user_id: userId,
        identity_hash: identityHash,
        verified_name: citizen.verifiedName,
      });
      if (insertIdentityError) throw new Error("Unable to save DAN identity.");
    }

    if (!userId) throw new Error("DAN user could not be resolved.");

    const rawHandoff = randomToken(32);
    const handoffHash = await sha256(rawHandoff);
    const handoffExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error: handoffError } = await admin.from("dan_auth_handoffs").insert({
      handoff_hash: handoffHash,
      user_id: userId,
      expires_at: handoffExpiresAt,
    });
    if (handoffError) throw new Error("Unable to finish DAN sign-in.");

    return redirectToApp({ handoff: rawHandoff, linked: state.mode === "link" ? "1" : "0" });
  } catch (error) {
    console.error("dan-oauth-callback failed", error instanceof Error ? error.message : "unknown");
    // Техникийн дэлгэрэнгүйг deep link болон browser history-д гаргахгүй.
    return new Response(null, {
      status: 302,
      headers: { Location: appCallbackUrl({ error: "sign_in_failed" }), "Cache-Control": "no-store" },
    });
  }
});