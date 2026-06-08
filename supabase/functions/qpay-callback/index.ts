// @ts-nocheck: QPay callback edge function дээр Supabase/Deno local TS lint false positive өгч байгаа тул type-check-г унтраав.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type QPayCallbackBody = {
  invoice_id?: string;
  payment_id?: string;
  qpay_payment_id?: string;
  sender_invoice_no?: string;
  invoice_status?: string;
  payment_status?: string;
  status?: string;
  amount?: number | string;
  paid_amount?: number | string;
  duration_days?: number | string;
  durationDays?: number | string;
  invoice_description?: string;
  description?: string;
  [key: string]: unknown;
};

type JsonRecord = Record<string, unknown>;

const QPAY_AUTH_URL = "https://merchant.qpay.mn/v2/auth/token";
const QPAY_PAYMENT_CHECK_URL = "https://merchant.qpay.mn/v2/payment/check";
const REQUEST_TIMEOUT_MS = 15000;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders(),
    });
  }

  try {
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
    const url = new URL(req.url);
    const method = req.method.toUpperCase();

    console.log("qpay-callback method:", method);
    console.log("qpay-callback url:", req.url);

    if (method === "GET") {
      return await handleGetCallback(supabase, url);
    }

    if (method === "POST") {
      return await handlePostCallback(req, supabase);
    }

    return json(
      {
        success: false,
        stage: "method_check",
        error: "Method not allowed",
      },
      405
    );
  } catch (error: unknown) {
    console.log("qpay-callback server_exception:", stringifyUnknown(error));

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

async function handleGetCallback(supabase, url: URL) {
  const qpayPaymentId =
    firstString(
      url.searchParams.get("qpay_payment_id"),
      url.searchParams.get("payment_id"),
      url.searchParams.get("qpayPaymentId"),
    ) ?? "";

  const invoiceIdFromQuery =
    firstString(
      url.searchParams.get("invoice_id"),
      url.searchParams.get("invoiceId"),
      url.searchParams.get("object_id"),
      url.searchParams.get("invoice"),
    ) ?? "";

  const senderInvoiceNoFromQuery =
    firstString(
      url.searchParams.get("sender_invoice_no"),
      url.searchParams.get("senderInvoiceNo"),
    ) ?? "";

  console.log(
    "GET callback query:",
    safeJsonStringify(Object.fromEntries(url.searchParams.entries())),
  );
  console.log("GET callback qpayPaymentId:", qpayPaymentId);
  console.log("GET callback invoiceIdFromQuery:", invoiceIdFromQuery);
  console.log("GET callback senderInvoiceNoFromQuery:", senderInvoiceNoFromQuery);

  if (!qpayPaymentId && !invoiceIdFromQuery && !senderInvoiceNoFromQuery) {
    return json(
      {
        success: false,
        stage: "validation",
        error:
          "GET callback дээр qpay_payment_id / invoice_id / sender_invoice_no олдсонгүй",
        query: Object.fromEntries(url.searchParams.entries()),
      },
      400,
    );
  }

  if (invoiceIdFromQuery || qpayPaymentId) {
    const paymentContext = await resolvePaymentContext({
      qpayPaymentId,
      invoiceId: invoiceIdFromQuery,
    });

    if (!paymentContext.ok) {
      return json(
        {
          success: false,
          stage: paymentContext.stage,
          error: paymentContext.error,
          details: paymentContext.details ?? null,
        },
        paymentContext.httpStatus ?? 502,
      );
    }

    return await finalizeByInvoiceId(supabase, {
      qpayInvoiceId: paymentContext.invoiceId,
      qpayPaymentId: paymentContext.qpayPaymentId,
      senderInvoiceNo: paymentContext.senderInvoiceNo,
      status: paymentContext.status,
      paidAmount: paymentContext.paidAmount,
      durationDays: paymentContext.durationDays,
      raw: paymentContext.raw,
    });
  }

  return await finalizeBySenderInvoiceNo(supabase, {
    senderInvoiceNo: senderInvoiceNoFromQuery,
    qpayPaymentId: qpayPaymentId || null,
    status: "PAID",
    paidAmount: null,
    durationDays: null,
    raw: {
      query: Object.fromEntries(url.searchParams.entries()),
    },
  });
}

async function handlePostCallback(req: Request, supabase) {
  let body: QPayCallbackBody;

  try {
    body = (await req.json()) as QPayCallbackBody;
  } catch {
    return json(
      {
        success: false,
        stage: "body_parse",
        error: "Callback JSON body уншиж чадсангүй",
      },
      400,
    );
  }

  console.log("POST callback body:", safeJsonStringify(body));

  const invoiceId =
    firstString(
      body.invoice_id,
      (body as JsonRecord).invoiceId,
      (body as JsonRecord).object_id,
    ) ?? "";

  const qpayPaymentId =
    firstString(
      body.qpay_payment_id,
      body.payment_id,
      (body as JsonRecord).qpayPaymentId,
    ) ?? "";

  const senderInvoiceNo =
    firstString(
      body.sender_invoice_no,
      (body as JsonRecord).senderInvoiceNo,
    ) ?? "";

  const normalizedStatus = normalizeStatus(
    firstString(body.invoice_status, body.payment_status, body.status) ?? "",
  );

  const paidAmount =
    parseNumber(body.paid_amount) ??
    parseNumber(body.amount) ??
    null;

  const durationDays =
    parseNumber(body.duration_days) ??
    parseNumber(body.durationDays) ??
    getDurationDaysFromAmount(paidAmount) ??
    parseDurationDaysFromDescription(
      firstString(body.invoice_description, body.description) ?? "",
    ) ??
    null;

  if (!invoiceId && !qpayPaymentId && !senderInvoiceNo) {
    return json(
      {
        success: false,
        stage: "validation",
        error:
          "POST callback дээр invoice_id / qpay_payment_id / sender_invoice_no байхгүй байна",
        callback_body: body,
      },
      400,
    );
  }

  if (invoiceId || qpayPaymentId) {
    const paymentContext = await resolvePaymentContext({
      qpayPaymentId,
      invoiceId,
    });

    if (!paymentContext.ok) {
      return json(
        {
          success: false,
          stage: paymentContext.stage,
          error: paymentContext.error,
          details: paymentContext.details ?? null,
          callback_body: body,
        },
        paymentContext.httpStatus ?? 502,
      );
    }

    return await finalizeByInvoiceId(supabase, {
      qpayInvoiceId: paymentContext.invoiceId,
      qpayPaymentId: paymentContext.qpayPaymentId ?? qpayPaymentId ?? null,
      senderInvoiceNo: paymentContext.senderInvoiceNo ?? senderInvoiceNo ?? null,
      status: paymentContext.status || normalizedStatus || "PAID",
      paidAmount: paymentContext.paidAmount ?? paidAmount,
      durationDays: paymentContext.durationDays ?? durationDays,
      raw: {
        callback_body: body,
        resolved_payment_context: paymentContext.raw,
      },
    });
  }

  const paidLike =
    isPaidLikeStatus(normalizedStatus) ||
    (paidAmount != null && paidAmount > 0);

  if (!paidLike) {
    return json(
      {
        success: true,
        stage: "callback_received_but_not_paid",
        message: "POST callback ирсэн боловч төлбөр баталгаажаагүй байна",
        sender_invoice_no: senderInvoiceNo,
        callback_body: body,
      },
      200,
    );
  }

  return await finalizeBySenderInvoiceNo(supabase, {
    senderInvoiceNo,
    qpayPaymentId: qpayPaymentId || null,
    status: normalizedStatus || "PAID",
    paidAmount,
    durationDays,
    raw: body,
  });
}

async function resolvePaymentContext(params: {
  qpayPaymentId?: string;
  invoiceId?: string;
}): Promise<
  | {
    ok: true;
    invoiceId: string;
    qpayPaymentId: string | null;
    senderInvoiceNo: string | null;
    status: string;
    paidAmount: number | null;
    durationDays: number | null;
    raw: {
      payment_data: JsonRecord;
      payment_check_data: JsonRecord;
    };
  }
  | {
    ok: false;
    stage: string;
    error: string;
    details?: unknown;
    httpStatus?: number;
  }
> {
  const qpayAuth = await getQPayAccessToken();

  if (!qpayAuth.ok) {
    return {
      ok: false,
      stage: "qpay_auth_failed",
      error: qpayAuth.error,
      details: qpayAuth.details,
      httpStatus: 502,
    };
  }

  const accessToken = qpayAuth.accessToken;

  let invoiceId = firstString(params.invoiceId) ?? "";
  let qpayPaymentId = firstString(params.qpayPaymentId) ?? "";
  let senderInvoiceNo: string | null = null;
  let paymentStatus = "";
  let paymentData: JsonRecord = {};
  let paymentCheckData: JsonRecord = {};

  if (qpayPaymentId) {
    const paymentGetUrl =
      `https://merchant.qpay.mn/v2/payment/${encodeURIComponent(qpayPaymentId)}`;

    const paymentResult = await fetchJson(paymentGetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    console.log("QPay payment detail status:", paymentResult.status);
    console.log(
      "QPay payment detail data:",
      safeJsonStringify(paymentResult.data),
    );

    if (!paymentResult.ok) {
      return {
        ok: false,
        stage: "qpay_payment_get_failed",
        error: "QPay payment detail авч чадсангүй",
        details: {
          status: paymentResult.status,
          qpay_payment_id: qpayPaymentId,
          data: paymentResult.data,
        },
        httpStatus: 502,
      };
    }

    paymentData = paymentResult.data;

    invoiceId =
      invoiceId ||
      findFirstStringDeep(paymentData, [
        "invoice_id",
        "invoiceId",
        "object_id",
        "objectId",
      ]) ||
      "";

    senderInvoiceNo =
      findFirstStringDeep(paymentData, [
        "sender_invoice_no",
        "senderInvoiceNo",
      ]) ?? null;

    paymentStatus =
      findFirstStringDeep(paymentData, [
        "payment_status",
        "paymentStatus",
        "status",
        "invoice_status",
        "invoiceStatus",
      ]) ?? "";
  }

  if (!invoiceId) {
    return {
      ok: false,
      stage: "invoice_id_missing",
      error:
        "QPay payment detail / callback query дотроос invoice_id олдсонгүй",
      details: {
        qpay_payment_id: qpayPaymentId || null,
        payment_data: paymentData,
      },
      httpStatus: 502,
    };
  }

  const checkResult = await fetchJson(QPAY_PAYMENT_CHECK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: {
        page_number: 1,
        page_limit: 100,
      },
    }),
    timeoutMs: REQUEST_TIMEOUT_MS,
  });

  console.log("QPay payment/check status:", checkResult.status);
  console.log(
    "QPay payment/check data:",
    safeJsonStringify(checkResult.data),
  );

  if (!checkResult.ok) {
    return {
      ok: false,
      stage: "qpay_payment_check_failed",
      error: "QPay payment/check авч чадсангүй",
      details: {
        status: checkResult.status,
        invoice_id: invoiceId,
        data: checkResult.data,
      },
      httpStatus: 502,
    };
  }

  paymentCheckData = checkResult.data;

  if (!senderInvoiceNo) {
    senderInvoiceNo =
      findFirstStringDeep(paymentCheckData, [
        "sender_invoice_no",
        "senderInvoiceNo",
      ]) ?? null;
  }

  if (!paymentStatus) {
    paymentStatus =
      findFirstStringDeep(paymentCheckData, [
        "payment_status",
        "paymentStatus",
        "status",
        "invoice_status",
        "invoiceStatus",
      ]) ?? "";
  }

  if (!qpayPaymentId) {
    qpayPaymentId =
      findFirstStringDeep(paymentCheckData, [
        "payment_id",
        "paymentId",
        "qpay_payment_id",
        "qpayPaymentId",
      ]) ?? "";
  }

  const paidAmount =
    parseNumber(findFirstNumberDeep(paymentData, ["paid_amount", "paidAmount"])) ??
    parseNumber(findFirstNumberDeep(paymentCheckData, ["paid_amount", "paidAmount"])) ??
    parseNumber(findFirstNumberDeep(paymentData, ["amount"])) ??
    parseNumber(findFirstNumberDeep(paymentCheckData, ["amount"])) ??
    null;

  const normalizedStatus = normalizeStatus(paymentStatus);

  const paid =
    isPaidLikeStatus(normalizedStatus) ||
    hasPositivePayment(paymentCheckData) ||
    hasPositivePayment(paymentData);

  if (!paid) {
    return {
      ok: false,
      stage: "payment_not_paid",
      error: "Төлбөр хараахан баталгаажаагүй байна",
      details: {
        invoice_id: invoiceId,
        qpay_payment_id: qpayPaymentId || null,
        payment_status: normalizedStatus || null,
        payment_data: paymentData,
        payment_check_data: paymentCheckData,
      },
      httpStatus: 200,
    };
  }

  const durationDays =
    getDurationDaysFromAmount(paidAmount) ??
    parseDurationDaysFromDescription(
      findFirstStringDeep(paymentData, ["invoice_description", "description"]) ??
        findFirstStringDeep(paymentCheckData, [
          "invoice_description",
          "description",
        ]) ??
        "",
    ) ??
    null;

  return {
    ok: true,
    invoiceId,
    qpayPaymentId: qpayPaymentId || null,
    senderInvoiceNo,
    status: normalizedStatus || "PAID",
    paidAmount,
    durationDays,
    raw: {
      payment_data: paymentData,
      payment_check_data: paymentCheckData,
    },
  };
}

async function finalizeByInvoiceId(
  supabase,
  params: {
    qpayInvoiceId: string;
    qpayPaymentId?: string | null;
    senderInvoiceNo?: string | null;
    status: string;
    paidAmount: number | null;
    durationDays: number | null;
    raw: unknown;
  },
) {
  console.log("finalizeByInvoiceId qpayInvoiceId:", params.qpayInvoiceId);
  console.log(
    "finalizeByInvoiceId qpayPaymentId:",
    params.qpayPaymentId ?? null,
  );
  console.log(
    "finalizeByInvoiceId senderInvoiceNo:",
    params.senderInvoiceNo ?? null,
  );

  const { data: sponsorPayment, error: sponsorPaymentError } = await supabase
    .from("sponsor_payments")
    .select("*")
    .eq("qpay_invoice_id", params.qpayInvoiceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sponsorPaymentError) {
    return json(
      {
        success: false,
        stage: "sponsor_payment_lookup_failed",
        error: sponsorPaymentError.message,
        qpay_invoice_id: params.qpayInvoiceId,
      },
      500,
    );
  }

  if (!sponsorPayment) {
    return json(
      {
        success: false,
        stage: "sponsor_payment_not_found",
        error: "qpay_invoice_id-аар sponsor_payments мөр олдсонгүй",
        qpay_invoice_id: params.qpayInvoiceId,
      },
      404,
    );
  }

  return await finalizeSponsorPayment(supabase, {
    sponsorPayment,
    qpayInvoiceId: params.qpayInvoiceId,
    qpayPaymentId: params.qpayPaymentId ?? null,
    senderInvoiceNo: params.senderInvoiceNo ?? null,
    status: params.status,
    paidAmount: params.paidAmount,
    durationDays: params.durationDays,
    raw: params.raw,
  });
}

async function finalizeBySenderInvoiceNo(
  supabase,
  params: {
    senderInvoiceNo: string;
    qpayPaymentId?: string | null;
    status: string;
    paidAmount: number | null;
    durationDays: number | null;
    raw: unknown;
  },
) {
  if (!params.senderInvoiceNo) {
    return json(
      {
        success: false,
        stage: "sender_invoice_no_missing",
        error: "sender_invoice_no байхгүй тул fallback lookup хийж чадсангүй",
      },
      400,
    );
  }

  const { data: sponsorPayment, error: sponsorPaymentError } = await supabase
    .from("sponsor_payments")
    .select("*")
    .eq("sender_invoice_no", params.senderInvoiceNo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sponsorPaymentError) {
    return json(
      {
        success: false,
        stage: "sponsor_payment_lookup_failed",
        error: sponsorPaymentError.message,
        sender_invoice_no: params.senderInvoiceNo,
      },
      500,
    );
  }

  if (!sponsorPayment) {
    return json(
      {
        success: false,
        stage: "sponsor_payment_not_found",
        error: "sender_invoice_no-аар sponsor_payments мөр олдсонгүй",
        sender_invoice_no: params.senderInvoiceNo,
      },
      404,
    );
  }

  return await finalizeSponsorPayment(supabase, {
    sponsorPayment,
    qpayInvoiceId: String(sponsorPayment.qpay_invoice_id ?? "").trim(),
    qpayPaymentId: params.qpayPaymentId ?? null,
    senderInvoiceNo: params.senderInvoiceNo,
    status: params.status,
    paidAmount: params.paidAmount,
    durationDays: params.durationDays,
    raw: params.raw,
  });
}

async function finalizeSponsorPayment(
  supabase,
  params: {
    sponsorPayment: JsonRecord;
    qpayInvoiceId: string;
    qpayPaymentId?: string | null;
    senderInvoiceNo?: string | null;
    status: string;
    paidAmount: number | null;
    durationDays: number | null;
    raw: unknown;
  },
) {
  const sponsorPayment = params.sponsorPayment;
  const sponsorPaymentId = String(sponsorPayment.id ?? "").trim();
  const currentStatus = normalizeStatus(String(sponsorPayment.status ?? ""));
  const jobId = String(sponsorPayment.job_id ?? "").trim();

  if (!sponsorPaymentId) {
    return json(
      {
        success: false,
        stage: "sponsor_payment_id_missing",
        error: "sponsor_payments мөрийн id алга байна",
      },
      500,
    );
  }

  if (!jobId) {
    return json(
      {
        success: false,
        stage: "job_id_missing_in_sponsor_payment",
        error: "sponsor_payments мөр дээр job_id алга байна",
        sponsor_payment_id: sponsorPaymentId,
        qpay_invoice_id: params.qpayInvoiceId || sponsorPayment.qpay_invoice_id,
      },
      500,
    );
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id,is_sponsored,sponsored_until")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) {
    return json(
      {
        success: false,
        stage: "job_lookup_failed",
        error: jobError.message,
        jobId,
        qpay_invoice_id: params.qpayInvoiceId || sponsorPayment.qpay_invoice_id,
      },
      500,
    );
  }

  if (!job) {
    return json(
      {
        success: false,
        stage: "job_not_found",
        error: "Тухайн job олдсонгүй",
        jobId,
        qpay_invoice_id: params.qpayInvoiceId || sponsorPayment.qpay_invoice_id,
      },
      404,
    );
  }

  const durationDays = Math.max(
    1,
    Math.round(
      Number(
        params.durationDays ??
          parseNumber(sponsorPayment.duration_days) ??
          7,
      ),
    ),
  );

  const now = new Date();
  const currentSponsoredUntilRaw = job?.sponsored_until ?? null;
  const currentSponsoredUntil =
    typeof currentSponsoredUntilRaw === "string" &&
      !Number.isNaN(new Date(currentSponsoredUntilRaw).getTime())
      ? new Date(currentSponsoredUntilRaw)
      : null;

  const baseDate =
    currentSponsoredUntil && currentSponsoredUntil.getTime() > now.getTime()
      ? currentSponsoredUntil
      : now;

  const nextSponsoredUntil = new Date(
    baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000,
  );

  const paidAt = new Date().toISOString();
  const resolvedSenderInvoiceNo =
    firstString(params.senderInvoiceNo, sponsorPayment.sender_invoice_no) ?? null;

  const sponsorPaymentUpdatePayload: Record<string, unknown> = {
    status: "PAID",
    paid_at: paidAt,
  };

  if (params.qpayPaymentId) {
    sponsorPaymentUpdatePayload.qpay_payment_id = params.qpayPaymentId;
  }

  if (resolvedSenderInvoiceNo) {
    sponsorPaymentUpdatePayload.sender_invoice_no = resolvedSenderInvoiceNo;
  }

  const { error: sponsorPaymentUpdateError } = await supabase
    .from("sponsor_payments")
    .update(sponsorPaymentUpdatePayload)
    .eq("id", sponsorPaymentId)
    .neq("status", "PAID");

  if (sponsorPaymentUpdateError) {
    return json(
      {
        success: false,
        stage: "sponsor_payment_update_failed",
        error: sponsorPaymentUpdateError.message,
        sponsor_payment_id: sponsorPaymentId,
        qpay_invoice_id: params.qpayInvoiceId || sponsorPayment.qpay_invoice_id,
        jobId,
      },
      500,
    );
  }

  const jobUpdatePayload = {
    is_sponsored: true,
    sponsored_until: nextSponsoredUntil.toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: jobUpdateError } = await supabase
    .from("jobs")
    .update(jobUpdatePayload)
    .eq("id", jobId);

  if (jobUpdateError) {
    return json(
      {
        success: false,
        stage: "job_update_failed",
        error: jobUpdateError.message,
        jobId,
        qpay_invoice_id: params.qpayInvoiceId || sponsorPayment.qpay_invoice_id,
      },
      500,
    );
  }

  if (currentStatus === "PAID") {
    return json(
      {
        success: true,
        stage: "already_processed_but_job_synced",
        message:
          "Энэ invoice өмнө нь PAID болсон байсан, job sponsor төлөвийг дахин баталгаажууллаа",
        sponsor_payment_id: sponsorPaymentId,
        qpay_invoice_id: params.qpayInvoiceId || sponsorPayment.qpay_invoice_id,
        qpay_payment_id:
          params.qpayPaymentId ?? sponsorPayment.qpay_payment_id ?? null,
        sender_invoice_no: resolvedSenderInvoiceNo,
        jobId,
        invoice_status: normalizeStatus(params.status) || "PAID",
        paid_amount: params.paidAmount,
        duration_days: durationDays,
        sponsored_until: nextSponsoredUntil.toISOString(),
        raw: params.raw,
      },
      200,
    );
  }

  return json(
    {
      success: true,
      stage: "done",
      message: "QPay callback амжилттай боловсруулагдлаа",
      sponsor_payment_id: sponsorPaymentId,
      qpay_invoice_id: params.qpayInvoiceId || sponsorPayment.qpay_invoice_id,
      qpay_payment_id:
        params.qpayPaymentId ?? sponsorPayment.qpay_payment_id ?? null,
      sender_invoice_no: resolvedSenderInvoiceNo,
      jobId,
      invoice_status: normalizeStatus(params.status) || "PAID",
      paid_amount: params.paidAmount,
      duration_days: durationDays,
      sponsored_until: nextSponsoredUntil.toISOString(),
      raw: params.raw,
    },
    200,
  );
}

async function getQPayAccessToken(): Promise<
  | { ok: true; accessToken: string }
  | { ok: false; error: string; details?: unknown }
> {
  const qpayUsername = (Deno.env.get("QPAY_USERNAME") ?? "").trim();
  const qpayPassword = (Deno.env.get("QPAY_PASSWORD") ?? "").trim();

  if (!qpayUsername || !qpayPassword) {
    return {
      ok: false,
      error: "QPAY_USERNAME / QPAY_PASSWORD secret дутуу байна",
      details: {
        has_username: Boolean(qpayUsername),
        has_password: Boolean(qpayPassword),
      },
    };
  }

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
    return {
      ok: false,
      error: "QPay auth амжилтгүй боллоо",
      details: authResult.data,
    };
  }

  const accessToken =
    typeof authResult.data?.access_token === "string"
      ? authResult.data.access_token.trim()
      : "";

  if (!accessToken) {
    return {
      ok: false,
      error: "QPay access_token олдсонгүй",
      details: authResult.data,
    };
  }

  return { ok: true, accessToken };
}

async function fetchJson(
  url: string,
  options: {
    method?: string;
    headers?: HeadersInit;
    body?: string;
    timeoutMs?: number;
  },
): Promise<{
  ok: boolean;
  status: number;
  data: JsonRecord;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? REQUEST_TIMEOUT_MS,
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

function normalizeStatus(value: string) {
  return String(value ?? "").trim().toUpperCase();
}

function isPaidLikeStatus(status: string) {
  const normalized = normalizeStatus(status);

  return new Set([
    "PAID",
    "PAID_OUT",
    "SUCCESS",
    "COMPLETED",
    "PAID_SUCCESS",
    "PAYMENT_SUCCESS",
  ]).has(normalized);
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

function getDurationDaysFromAmount(amount: number | null): number | null {
  if (amount == null) return null;
  if (amount === 4500) return 1;
  if (amount === 21000) return 7;
  if (amount === 45000) return 30;
  return null;
}

function parseDurationDaysFromDescription(text: string): number | null {
  const m = String(text ?? "").match(/sponsor\s+(\d+)\s+day/i);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function hasPositivePayment(value: unknown): boolean {
  const amount =
    parseNumber(findFirstNumberDeep(value, ["paid_amount", "paidAmount"])) ??
    parseNumber(findFirstNumberDeep(value, ["amount"]));

  if (amount != null && amount > 0) return true;

  if (Array.isArray(value)) {
    return value.some((x) => hasPositivePayment(x));
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((x) =>
      hasPositivePayment(x)
    );
  }

  return false;
}

function firstString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function findFirstStringDeep(value: unknown, keys: string[]): string | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstStringDeep(item, keys);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    for (const key of keys) {
      const direct = obj[key];
      if (typeof direct === "string" && direct.trim()) {
        return direct.trim();
      }
    }

    for (const nested of Object.values(obj)) {
      const found = findFirstStringDeep(nested, keys);
      if (found) return found;
    }
  }

  return null;
}

function findFirstNumberDeep(
  value: unknown,
  keys: string[],
): number | string | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstNumberDeep(item, keys);
      if (found != null) return found;
    }
    return null;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    for (const key of keys) {
      const direct = obj[key];
      if (
        (typeof direct === "number" && Number.isFinite(direct)) ||
        (typeof direct === "string" && direct.trim())
      ) {
        return direct as number | string;
      }
    }

    for (const nested of Object.values(obj)) {
      const found = findFirstNumberDeep(nested, keys);
      if (found != null) return found;
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

function corsHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders(),
  });
}