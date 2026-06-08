// supabase/functions/create-qpay-invoice/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CreateInvoiceBody = {
  jobId?: string;
  userId?: string;
  amount?: number;
  durationDays?: number;
};

type JsonRecord = Record<string, unknown>;

type QPayAuthResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  [key: string]: unknown;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const QPAY_AUTH_URL = "https://merchant.qpay.mn/v2/auth/token";
const QPAY_INVOICE_URL = "https://merchant.qpay.mn/v2/invoice";
const REQUEST_TIMEOUT_MS = 15000;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  try {
    if (req.method !== "POST") {
      return json(
        {
          success: false,
          stage: "method_check",
          error: "Method not allowed",
        },
        405
      );
    }

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

    if (!supabaseUrl || !serviceRoleKey) {
      return json(
        {
          success: false,
          stage: "env_check",
          error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY дутуу байна",
        },
        500
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const bodyResult = await readJsonBody<CreateInvoiceBody>(req);
    if (!bodyResult.ok) {
      return json(
        {
          success: false,
          stage: "body_parse",
          error: "JSON body уншиж чадсангүй",
        },
        400
      );
    }

    const body = bodyResult.data;

    const jobId = String(body?.jobId ?? "").trim();
    const userId = String(body?.userId ?? "").trim();
    const amount = Number(body?.amount ?? 0);
    const durationDays = Number(body?.durationDays ?? 0);

    if (!jobId) {
      return json(
        {
          success: false,
          stage: "validation",
          error: "jobId хоосон байна",
        },
        400
      );
    }

    if (!userId) {
      return json(
        {
          success: false,
          stage: "validation",
          error: "userId хоосон байна",
        },
        400
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return json(
        {
          success: false,
          stage: "validation",
          error: "amount буруу байна",
        },
        400
      );
    }

    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      return json(
        {
          success: false,
          stage: "validation",
          error: "durationDays буруу байна",
        },
        400
      );
    }

    const qpayUsername = (Deno.env.get("QPAY_USERNAME") ?? "").trim();
    const qpayPassword = (Deno.env.get("QPAY_PASSWORD") ?? "").trim();
    const qpayInvoiceCode = (Deno.env.get("QPAY_INVOICE_CODE") ?? "").trim();

    if (!qpayUsername || !qpayPassword || !qpayInvoiceCode) {
      return json(
        {
          success: false,
          stage: "env_check",
          error:
            "QPAY_USERNAME / QPAY_PASSWORD / QPAY_INVOICE_CODE secret дутуу байна",
          debug: {
            has_username: Boolean(qpayUsername),
            has_password: Boolean(qpayPassword),
            has_invoice_code: Boolean(qpayInvoiceCode),
          },
        },
        500
      );
    }

    const callbackBaseUrl = supabaseUrl.replace(/\/+$/, "");
    const callbackUrl = `${callbackBaseUrl}/functions/v1/qpay-callback`;

    const senderInvoiceNo = buildSenderInvoiceNo(jobId);
    const normalizedAmount = normalizeAmount(amount);
    const normalizedDurationDays = Math.max(1, Math.round(durationDays));

    const basicAuth = toBase64(`${qpayUsername}:${qpayPassword}`);

    const authResult = await fetchJson(QPAY_AUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({}),
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    console.log("QPay auth status:", authResult.status);
    console.log("QPay auth data:", safeJsonStringify(authResult.data));

    if (!authResult.ok) {
      return json(
        {
          success: false,
          stage: "qpay_auth_failed",
          error: "QPay auth амжилтгүй боллоо",
          status: authResult.status,
          details: authResult.data,
        },
        502
      );
    }

    const authData = authResult.data as QPayAuthResponse;
    const accessToken =
      typeof authData?.access_token === "string" ? authData.access_token.trim() : "";

    if (!accessToken) {
      return json(
        {
          success: false,
          stage: "qpay_auth_token_missing",
          error: "QPay access_token олдсонгүй",
          details: authData,
        },
        502
      );
    }

    const invoicePayload = {
      invoice_code: qpayInvoiceCode,
      sender_invoice_no: senderInvoiceNo,
      invoice_receiver_code: "terminal",
      sender_branch_code: "SALBAR1",
      invoice_description: buildInvoiceDescription(jobId, normalizedDurationDays),
      amount: normalizedAmount,
      callback_url: callbackUrl,
      allow_partial: false,
      allow_exceed: false,
      enable_expiry: false,
      calculate_vat: false,
    };

    console.log("QPay invoice payload:", safeJsonStringify(invoicePayload));

    const invoiceResult = await fetchJson(QPAY_INVOICE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(invoicePayload),
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    console.log("QPay invoice status:", invoiceResult.status);
    console.log("QPay invoice data:", safeJsonStringify(invoiceResult.data));

    if (!invoiceResult.ok) {
      return json(
        {
          success: false,
          stage: "qpay_invoice_failed",
          error: "QPay invoice үүсгэхэд алдаа гарлаа",
          status: invoiceResult.status,
          details: invoiceResult.data,
          request_payload: invoicePayload,
        },
        502
      );
    }

    const invoiceId =
      firstString(
        invoiceResult.data?.invoice_id,
        invoiceResult.data?.invoiceId,
        invoiceResult.data?.object_id,
        invoiceResult.data?.id
      ) ?? "";

    if (!invoiceId) {
      return json(
        {
          success: false,
          stage: "invoice_id_missing",
          error: "QPay invoice response дотроос invoice_id олдсонгүй",
          qpay: invoiceResult.data,
        },
        502
      );
    }

    const qrText =
      firstString(
        invoiceResult.data?.qr_text,
        invoiceResult.data?.qrText,
        invoiceResult.data?.qr_code,
        invoiceResult.data?.qrCode,
        invoiceResult.data?.qPay_QRcode
      ) ?? null;

    const paymentPayload = {
      job_id: jobId,
      user_id: userId,
      amount: normalizedAmount,
      duration_days: normalizedDurationDays,
      qpay_invoice_id: invoiceId,
      qpay_qr: qrText,
      status: "PENDING",
      sender_invoice_no: senderInvoiceNo,
      qpay_payment_id: null,
      paid_at: null,
    };

    const { data: sponsorPayment, error: insertError } = await supabase
      .from("sponsor_payments")
      .insert(paymentPayload)
      .select("*")
      .single();

    if (insertError) {
      console.log("sponsor_payment_insert_failed:", insertError);

      return json(
        {
          success: false,
          stage: "sponsor_payment_insert_failed",
          error: insertError.message,
          payload: paymentPayload,
        },
        500
      );
    }

    return json(
      {
        success: true,
        stage: "done",
        jobId,
        userId,
        amount: normalizedAmount,
        durationDays: normalizedDurationDays,
        sender_invoice_no: senderInvoiceNo,
        qpay_invoice_id: invoiceId,
        callback_url: callbackUrl,
        sponsor_payment: sponsorPayment,
        qpay: invoiceResult.data,
      },
      200
    );
  } catch (error: unknown) {
    console.log("create-qpay-invoice server_exception:", stringifyUnknown(error));

    return json(
      {
        success: false,
        stage: "server_exception",
        error: getErrorMessage(error),
      },
      500
    );
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: CORS_HEADERS,
  });
}

async function readJsonBody<T>(
  req: Request
): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    const data = (await req.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

async function fetchJson(
  url: string,
  options: {
    method?: string;
    headers?: HeadersInit;
    body?: string;
    timeoutMs?: number;
  }
): Promise<{
  ok: boolean;
  status: number;
  data: JsonRecord;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? REQUEST_TIMEOUT_MS
  );

  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });

    const data = await safeJson(res);

    return {
      ok: res.ok,
      status: res.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {
        error: error instanceof Error ? error.message : "Network request failed",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson(res: Response): Promise<JsonRecord> {
  const text = await res.text();

  if (!text) return {};

  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    return { raw_text: text };
  }
}

function buildSenderInvoiceNo(jobId: string) {
  const compactJobId = String(jobId ?? "").replace(/-/g, "").trim();
  const shortTs = Date.now().toString().slice(-6);
  return `ZV-${compactJobId}-${shortTs}`;
}

function buildInvoiceDescription(jobId: string, durationDays: number) {
  const text = `Tureestei sponsor ${durationDays} day(s) / job ${jobId}`;
  return text.slice(0, 150);
}

function normalizeAmount(value: number) {
  return Math.max(1, Math.round(value));
}

function firstString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function toBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function getErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timeout";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown server error";
}

function stringifyUnknown(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}