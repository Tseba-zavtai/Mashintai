import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, corsHeaders, json } from "../_shared/dan.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const admin = adminClient({ supabaseUrl: Deno.env.get("SUPABASE_URL")!, serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! });
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "authentication_required" }, 401);
    const { data: identity, error: identityError } = await admin.auth.getUser(token);
    const user = identity.user;
    if (identityError || !user?.email) return json({ error: "authentication_required" }, 401);
    const originalEmail = user.email;
    const originalMetadata = { ...user.user_metadata };
    const body = await req.json();
    const digits = String(body.phone ?? "").replace(/\D/g, "");
    const local = digits.length === 11 && digits.startsWith("976") ? digits.slice(3) : digits;
    if (!/^\d{8}$/.test(local)) return json({ error: "invalid_phone" }, 400);
    const password = String(body.currentPassword ?? "");
    if (!password) return json({ error: "invalid_password" }, 400);
    // The verification client must not replace the service-role client's session.
    const verifier = adminClient({ supabaseUrl: Deno.env.get("SUPABASE_URL")!, serviceRoleKey: Deno.env.get("SUPABASE_ANON_KEY")! });
    const verified = await verifier.auth.signInWithPassword({ email: user.email, password });
    if (verified.error || verified.data.user?.id !== user.id) return json({ error: "invalid_password" }, 403);
    const phone = `+976${local}`;
    const updated = await admin.auth.admin.updateUserById(user.id, { email: `u976${local}@example.com`, email_confirm: true, user_metadata: { ...user.user_metadata, phone, phone_number: phone } });
    if (updated.error) {
      if (/already|unique|registered/i.test(updated.error.message)) return json({ error: "phone_already_in_use" }, 409);
      throw updated.error;
    }
    const profile = await admin.rpc("save_login_phone_profile", { p_user_id: user.id, p_phone: phone, p_complete_signup: false });
    if (profile.error) {
      const rollback = await admin.auth.admin.updateUserById(user.id, { email: originalEmail, email_confirm: true, user_metadata: originalMetadata });
      if (rollback.error) console.error("phone-change rollback failed", user.id);
      if (profile.error.code === "23505") return json({ error: "phone_already_in_use" }, 409);
      throw profile.error;
    }
    return json({ ok: true, phone });
  } catch {
    return json({ error: "phone_change_unavailable" }, 500);
  }
});
