// supabase/functions/delete-user/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleanDeletedAccountFiles } from "../_shared/accountDeletion.ts";

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

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return new Response(JSON.stringify({ error: "Хэрэглэгчийн дугаар буруу байна." }), { status: 400 });
    }
    // Profiles, financial unlinking and Auth removal commit or roll back together.
    const { error: dbErr } = await admin.rpc("delete_account_atomic", { p_user_id: userId });
    if (dbErr) {
      const messages: Record<string, string> = {
        ACTIVE_RENTAL: "Дуусаагүй түрээс байна. Түрээсээ дуусгаж эсвэл цуцалсны дараа бүртгэлээ устгана уу.",
        PENDING_PAYMENT: "Дуусаагүй төлбөр байна. Төлбөрөө шалгаж эсвэл нэхэмжлэлээ цуцалсны дараа дахин оролдоно уу.",
        OPEN_DISPUTE: "Шийдэгдээгүй маргаан байна. Тусламжийн багтай холбогдоно уу.",
        ADMIN_ACCOUNT_PROTECTED: "Үндсэн админ бүртгэлийг энэ үйлдлээр устгахгүй. Эхлээд админ эрхээ шилжүүлнэ үү.",
      };
      const code = Object.keys(messages).find(key => dbErr.message?.includes(key));
      console.error("delete-account transaction rejected", code ?? dbErr.code);
      return new Response(JSON.stringify({ error: code ? messages[code] : "Бүртгэлийг устгаж чадсангүй. Мэдээлэл өөрчлөгдөөгүй. Дахин оролдоно уу." }), {
        status: code ? 409 : 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Storage is external to the DB transaction. Failures remain in a retry queue.
    await cleanDeletedAccountFiles(admin).catch(() => console.error("storage cleanup queued for retry"));

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
