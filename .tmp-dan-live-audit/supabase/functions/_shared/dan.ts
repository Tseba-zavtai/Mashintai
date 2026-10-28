import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const encoder = new TextEncoder();

export type DanConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  identityPepper: string;
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function getDanConfig(): DanConfig {
  const config = {
    supabaseUrl: (Deno.env.get("SUPABASE_URL") ?? "").trim(),
    serviceRoleKey: (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim(),
    clientId: (Deno.env.get("DAN_CLIENT_ID") ?? "").trim(),
    clientSecret: (Deno.env.get("DAN_CLIENT_SECRET") ?? "").trim(),
    redirectUri: (Deno.env.get("DAN_REDIRECT_URI") ?? "").trim(),
    identityPepper: (Deno.env.get("DAN_IDENTITY_PEPPER") ?? "").trim(),
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`DAN server configuration is incomplete: ${missing.join(", ")}`);
  }

  if (config.identityPepper.length < 32) {
    throw new Error("DAN_IDENTITY_PEPPER must be at least 32 characters long.");
  }

  return config;
}

export function adminClient(config: Pick<DanConfig, "supabaseUrl" | "serviceRoleKey">) {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return bytesToBase64Url(data);
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function hmacSha256(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

export async function getAuthenticatedUserId(req: Request, config: DanConfig) {
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) return null;

  const { data, error } = await adminClient(config).auth.getUser(token);
  if (error || !data.user?.id) return null;
  return data.user.id;
}

export const DAN_SCOPE = btoa(JSON.stringify([
  {
    services: ["WS100101_getCitizenIDCardInfo"],
    wsdl: "https://xyp.gov.mn/citizen-1.3.0/ws?WSDL",
  },
]));

export function buildDanAuthorizeUrl(config: DanConfig, state: string) {
  const url = new URL("https://sso.gov.mn/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", DAN_SCOPE);
  url.searchParams.set("state", state);
  // DAN-д хэрэглэгч өөрөө OTP / банк / тоон гарын үсгийн аргаа сонгоно.
  // OTP нь одоогийн урсгалын default сонголт.
  url.searchParams.set("login_type", "OTP");
  return url.toString();
}

export async function exchangeDanCode(config: DanConfig, code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });

  const response = await fetchWithTimeout("https://sso.gov.mn/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const payload = await readJson(response);
  if (!response.ok || !isRecord(payload) || typeof payload.access_token !== "string") {
    throw new Error("DAN token exchange failed.");
  }

  return payload.access_token;
}

export function formatDanPublicDisplayName(verifiedName: string | null) {
  const parts = String(verifiedName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];

  const familyInitial = Array.from(parts[0])[0]?.toLocaleUpperCase("mn-MN") ?? "";
  const givenName = parts[parts.length - 1];
  return familyInitial ? `${familyInitial}. ${givenName}` : givenName;
}

export async function getDanCitizen(accessToken: string) {
  const response = await fetchWithTimeout("https://sso.gov.mn/oauth2/api/v1/service", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error("DAN citizen service request failed.");
  }

  const service = findServiceResult(payload, "WS100101_getCitizenIDCardInfo");
  if (!service || Number(service.resultCode ?? 0) !== 0) {
    throw new Error("DAN citizen identity could not be verified.");
  }

  const responseData = isRecord(service.response) ? service.response : service;
  const registerNumber = firstString(
    responseData.regnum,
    responseData.regNum,
    responseData.registerNumber,
    responseData.register_number,
  );

  if (!registerNumber) {
    throw new Error("DAN did not return a usable citizen identifier.");
  }

  const givenName = firstString(
    responseData.firstname,
    responseData.firstName,
    responseData.givenName,
    responseData.name,
  );
  const familyName = firstString(
    responseData.lastname,
    responseData.lastName,
    responseData.surname,
  );

  return {
    registerNumber: registerNumber.toUpperCase(),
    verifiedName: [familyName, givenName].filter(Boolean).join(" ").trim() || null,
    publicName: formatDanPublicDisplayName([familyName, givenName].filter(Boolean).join(" ").trim() || null),
  };
}

export function appCallbackUrl(params: Record<string, string>) {
  const url = new URL("tureesly://dan-callback");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function redirectToApp(params: Record<string, string>) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: appCallbackUrl(params),
      "Cache-Control": "no-store",
    },
  });
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function findServiceResult(value: unknown, serviceName: string): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findServiceResult(item, serviceName);
      if (found) return found;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  const direct = value[serviceName];
  if (isRecord(direct)) return direct;

  for (const child of Object.values(value)) {
    const found = findServiceResult(child, serviceName);
    if (found) return found;
  }

  return null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}