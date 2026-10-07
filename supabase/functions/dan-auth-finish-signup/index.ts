import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, corsHeaders, getAuthenticatedUserId, getDanConfig, json } from "../_shared/dan.ts";

type FinishSignupBody = {
  phone?: string;
  password?: string;
};

const normalizePhone = (value: string) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("976") ? digits.slice(3) : digits;
  return /^\d{8}$/.test(local) ? `+976${local}` : null;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const config = getDanConfig();
    const userId = await getAuthenticatedUserId(req, config);
    if (!userId) return json({ error: "authentication_required" }, 401);

    const body = (await req.json().catch(() => ({}))) as FinishSignupBody;
    const phone = normalizePhone(body.phone ?? "");
    const password = String(body.password ?? "");

    if (!phone) return json({ error: "invalid_phone" }, 400);
    if (password.length < 6) return json({ error: "weak_password" }, 400);

    const admin = adminClient(config);
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id, terms_accepted_at, dan_onboarding_completed_at")
      .eq("id", userId)
      .maybeSingle<{ id: string; terms_accepted_at: string | null; dan_onboarding_completed_at: string | null }>();

    if (profileError || !profile) throw new Error("DAN profile is unavailable.");
    if (!profile.terms_accepted_at) return json({ error: "terms_acceptance_required" }, 422);
    if (profile.dan_onboarding_completed_at) return json({ error: "onboarding_already_completed" }, 409);
    const { data: identity, error: identityError } = await admin.from("dan_identities").select("user_id").eq("user_id", userId).maybeSingle();
    if (identityError || !identity) return json({ error: "dan_identity_required" }, 403);

    // DAN account-ын дотоод email нь нууцлаг байдаг. Утас + нууц үгээр
    // нэвтрэх боломжийг идэвхжүүлэхдээ дотоод нэвтрэх хаягийг утсаар солино.
    // Бодит email эсвэл DAN-ийн иргэний мэдээлэл хадгалахгүй.
    const internalEmail = `u976${phone.slice(4)}@example.com`;
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      email: internalEmail,
      email_confirm: true,
      password,
      user_metadata: { phone, phone_number: phone, auth_provider: "dan" },
    });
    if (authError) {
      const message = String(authError.message ?? "").toLowerCase();
      if (message.includes("already") || message.includes("unique")) {
        return json({ error: "phone_already_in_use" }, 409);
      }
      throw authError;
    }

    // Profile, default contact and completion marker commit together.
    const { error: updateError } = await admin.rpc("save_login_phone_profile", {
      p_user_id: userId, p_phone: phone, p_complete_signup: true,
    });
    if (updateError) throw updateError;
    return json({ ok: true, phone });
  } catch (error) {
    console.error("dan-auth-finish-signup failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "dan_signup_finish_unavailable" }, 500);
  }
});
