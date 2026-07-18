import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

type SendRentalRequestPushBody = {
  rentalRequestId?: unknown;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isExpoPushToken(value: unknown): value is string {
  return typeof value === "string" && (value.startsWith("ExponentPushToken[") || value.startsWith("ExpoPushToken["));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Server configuration is incomplete" }, 500);
    }

    if (!authorization.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser();
    const caller = authData?.user;
    if (authError || !caller) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as SendRentalRequestPushBody;
    if (typeof body.rentalRequestId !== "string" || !body.rentalRequestId.trim()) {
      return json({ error: "rentalRequestId is required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: rentalRequest, error: rentalRequestError } = await admin
      .from("rental_requests")
      .select("id, requester_id, owner_id, job_id, insurance_status")
      .eq("id", body.rentalRequestId)
      .maybeSingle();

    if (rentalRequestError) {
      return json({ error: rentalRequestError.message }, 500);
    }
    if (!rentalRequest) {
      return json({ error: "Rental request not found" }, 404);
    }
    if (rentalRequest.requester_id !== caller.id) {
      return json({ error: "Forbidden" }, 403);
    }
    if (!rentalRequest.owner_id) {
      return json({ delivered: false, reason: "owner_missing" });
    }

    const { data: owner, error: ownerError } = await admin
      .from("users")
      .select("expo_push_token")
      .eq("id", rentalRequest.owner_id)
      .maybeSingle();

    if (ownerError) {
      return json({ error: ownerError.message }, 500);
    }
    if (!isExpoPushToken(owner?.expo_push_token)) {
      return json({ delivered: false, reason: "push_token_missing" });
    }

    const { data: job } = await admin
      .from("jobs")
      .select("title")
      .eq("id", rentalRequest.job_id)
      .maybeSingle();

    const jobTitle = typeof job?.title === "string" && job.title.trim() ? job.title.trim() : "зар";
    const requesterName = typeof caller.user_metadata?.name === "string" && caller.user_metadata.name.trim()
      ? caller.user_metadata.name.trim()
      : "Хэрэглэгч";

    const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to: owner.expo_push_token,
        sound: "default",
        title: "Шинэ түрээсийн хүсэлт",
        body: requesterName + " таны " + jobTitle + " зарыг түрээслэх хүсэлт илгээлээ.",
        channelId: "default",
        data: { url: "/rental-requests?requestId=" + encodeURIComponent(rentalRequest.id) },
      }),
    });

    const expoResult = await expoResponse.json().catch(() => null);
    const ticket = Array.isArray(expoResult?.data) ? expoResult.data[0] : null;
    if (!expoResponse.ok || ticket?.status === "error") {
      return json({ error: ticket?.message ?? "Expo push delivery failed" }, 502);
    }

    return json({ delivered: true, ticketId: ticket?.id ?? null });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});