import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  adminClient,
  buildDanAuthorizeUrl,
  corsHeaders,
  getAuthenticatedUserId,
  getDanConfig,
  json,
  randomToken,
  sha256,
} from "../_shared/dan.ts";

type StartBody = { mode?: "sign_in" | "sign_up" | "link" };

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const config = getDanConfig();
    const body = (await req.json().catch(() => ({}))) as StartBody;
    const mode = body.mode === "link" ? "link" : body.mode === "sign_up" ? "sign_up" : "sign_in";
    const linkUserId = mode === "link"
      ? await getAuthenticatedUserId(req, config)
      : null;

    if (mode === "link" && !linkUserId) {
      return json({ error: "authentication_required" }, 401);
    }

    const rawState = randomToken(32);
    const stateHash = await sha256(rawState);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const admin = adminClient(config);

    const { error } = await admin.from("dan_auth_states").insert({
      state_hash: stateHash,
      mode,
      link_user_id: linkUserId,
      expires_at: expiresAt,
    });

    if (error) {
      throw new Error("Unable to start DAN sign-in.");
    }

    return json({
      authorize_url: buildDanAuthorizeUrl(config, rawState),
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("dan-auth-start failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "dan_sign_in_unavailable" }, 500);
  }
});