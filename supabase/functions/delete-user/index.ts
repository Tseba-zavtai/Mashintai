// supabase/functions/delete-user/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = body["userId"];

    if (!userId || typeof userId !== "string") {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ✅ who is calling? (token verify)
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: auth } },
    });

    const { data: udata, error: uerr } = await client.auth.getUser();
    if (uerr || !udata?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey);

    // A caller may always delete their own account. Deleting another account
    // requires a server-side super-admin check; the client UI is not trusted.
    if (udata.user.id !== userId) {
      const { data: callerProfile, error: callerProfileError } = await admin
        .from("users")
        .select("is_super_admin")
        .eq("id", udata.user.id)
        .maybeSingle();

      if (callerProfileError || callerProfile?.is_super_admin !== true) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 1) public.users (table) устгана
    const { error: dbErr } = await admin.from("users").delete().eq("id", userId);
    if (dbErr) {
      return new Response(JSON.stringify({ error: dbErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2) auth user устгана
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});