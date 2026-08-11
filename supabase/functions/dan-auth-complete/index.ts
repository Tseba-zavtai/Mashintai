import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, corsHeaders, getDanConfig, json, sha256 } from "../_shared/dan.ts";

type CompleteBody = { handoff?: string };

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as CompleteBody;
    const rawHandoff = body.handoff?.trim() ?? "";
    if (!rawHandoff || rawHandoff.length < 32) {
      return json({ error: "invalid_handoff" }, 400);
    }

    const config = getDanConfig();
    const admin = adminClient(config);
    const handoffHash = await sha256(rawHandoff);
    const now = new Date().toISOString();

    // Энэ кодыг нэг л төхөөрөмж/нэг л удаа session болгоно.
    const { data: handoff, error: handoffError } = await admin
      .from("dan_auth_handoffs")
      .update({ consumed_at: now })
      .eq("handoff_hash", handoffHash)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .select("user_id")
      .maybeSingle<{ user_id: string }>();

    if (handoffError || !handoff?.user_id) {
      return json({ error: "expired_or_used_handoff" }, 401);
    }

    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(handoff.user_id);
    const email = userResult.user?.email?.trim();
    if (userError || !email) {
      throw new Error("DAN user session cannot be created.");
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      throw new Error("DAN session token cannot be created.");
    }

    // action_link эсвэл email OTP-г буцаахгүй. Зөвхөн app дотор verifyOtp хийхэд
    // хэрэгтэй token_hash-г нэг удаагийн handoff сольж авна.
    return json({ token_hash: tokenHash, type: "magiclink" });
  } catch (error) {
    console.error("dan-auth-complete failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "dan_session_unavailable" }, 500);
  }
});