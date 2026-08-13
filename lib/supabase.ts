// lib/supabase.ts
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * React Native / Expo Supabase client
 * .env байвал тэрийг ашиглана
 * байхгүй бол доорх fallback value ашиглана
 */

// fallback URL
const PASTE_SUPABASE_URL = "https://wrekrjaitokrqydkwgtg.supabase.co";

// fallback anon key
const PASTE_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyZWtyamFpdG9rcnF5ZGt3Z3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NTQzNzMsImV4cCI6MjA4MDIzMDM3M30.k2coOI8Vq0952aT5nDr_2FvZBCOO3wvXIj1MUO3H-QI";

const SUPABASE_URL = (
  process.env.EXPO_PUBLIC_SUPABASE_URL || PASTE_SUPABASE_URL
).trim();

const SUPABASE_ANON_KEY = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || PASTE_SUPABASE_ANON_KEY
).trim();

const DEFAULT_TIMEOUT_MS = 20000;
const AUTH_STORAGE_KEY_PREFIX = "sb-tureestei-auth";
const IS_DEV = typeof __DEV__ !== "undefined" ? __DEV__ : false;

function validateSupabaseConfig() {
  const urlOk = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL);

  if (!urlOk) {
    console.warn("[Supabase] Invalid SUPABASE_URL:", SUPABASE_URL);
  }

  if (!SUPABASE_ANON_KEY) {
    console.warn("[Supabase] Missing SUPABASE_ANON_KEY");
  } else if (!SUPABASE_ANON_KEY.startsWith("eyJ")) {
    console.warn(
      "[Supabase] SUPABASE_ANON_KEY looks unusual. Check Dashboard → Settings → API → anon public"
    );
  }
}

validateSupabaseConfig();

/**
 * RN fetch wrapper with timeout
 * network hang үүсэхээс хамгаална
 */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    return response;
  } catch (e: any) {
    const msg = e?.message || String(e);
    const lower = String(msg).toLowerCase();

    console.log("[Supabase] fetch error:", msg);

    if (lower.includes("network request failed")) {
      console.log(
        "[Supabase] Hint: internet, VPN, Private DNS, AdGuard, emulator network, or invalid Supabase URL / anon key шалгаарай."
      );
    }

    if (
      lower.includes("aborted") ||
      lower.includes("aborterror") ||
      lower.includes("signal is aborted")
    ) {
      console.log("[Supabase] Request timeout");
    }

    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      storageKey: AUTH_STORAGE_KEY_PREFIX,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch: fetchWithTimeout as any,
      headers: {
        "X-Client-Info": "tureestei-app",
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 2,
      },
    },
  }
);
/**
 * Checks a legacy administrator password without replacing the current
 * application session, such as an active DAN session.
 */
export async function verifyPasswordWithoutChangingSession(
  email: string,
  password: string
) {
  const verifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: fetchWithTimeout as any,
      headers: {
        "X-Client-Info": "tureesly-admin-password-check",
      },
    },
  });

  try {
    const { error } = await verifier.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } finally {
    await verifier.auth.signOut({ scope: "local" }).catch(() => {});
  }
}

/**
 * Optional auth debug log
 * production behavior-т нөлөөлөхгүй
 */
if (IS_DEV) {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log("[Supabase auth]", event, {
      hasSession: !!session,
      userId: session?.user?.id ?? null,
    });
  });
}

export async function getSupabaseSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getSupabaseUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function clearSupabaseSession() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export default supabase;