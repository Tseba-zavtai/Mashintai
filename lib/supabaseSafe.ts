import { supabase } from "@/lib/supabase";

export type SafeResult<T = any> = {
  data: T | null;
  error: Error | null;
};

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toSafeError(error: any, fallbackMessage: string): Error {
  if (!error) return new Error(fallbackMessage);
  if (error instanceof Error) return error;

  const message =
    error?.message ||
    error?.error_description ||
    error?.details ||
    error?.hint ||
    fallbackMessage;

  const safeError = new Error(String(message || fallbackMessage));
  (safeError as any).original = error;
  return safeError;
}

function ok<T>(data: T | null): SafeResult<T> {
  return { data, error: null };
}

function fail<T = any>(error: any, fallbackMessage: string): SafeResult<T> {
  return {
    data: null,
    error: toSafeError(error, fallbackMessage),
  };
}

function normalizeSingleRow<T = any>(data: any): T | null {
  if (Array.isArray(data)) return (data[0] ?? null) as T | null;
  return (data ?? null) as T | null;
}

function cleanObject(input?: Record<string, any> | null) {
  if (!isRecord(input)) return {};
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => typeof key === "string" && key.trim().length > 0)
  );
}

function isUuidLike(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function sanitizeJobsPayload(input: Record<string, any>) {
  const payload = { ...cleanObject(input) };

  if ("category_id" in payload && !isUuidLike(payload.category_id)) {
    payload.category_id = null;
  }

  if ("subcategory_id" in payload && !isUuidLike(payload.subcategory_id)) {
    payload.subcategory_id = null;
  }

  if (typeof payload.category === "object" && payload.category !== null) {
    payload.category = null;
  }

  if (typeof payload.subcategory === "object" && payload.subcategory !== null) {
    payload.subcategory = null;
  }

  if (Array.isArray(payload.image_urls)) {
    payload.image_urls = payload.image_urls.filter(
      (x: any) => typeof x === "string" && x.trim().length > 0
    );
  }

  if (!payload.image_url && Array.isArray(payload.image_urls) && payload.image_urls.length > 0) {
    payload.image_url = payload.image_urls[0];
  }

  return payload;
}

export async function requireSession() {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw toSafeError(error, "Session шалгахад алдаа гарлаа");
    }

    if (session?.user) {
      return session;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw toSafeError(userError, "Хэрэглэгчийн мэдээлэл авахад алдаа гарлаа");
    }

    if (!user) {
      throw new Error("Нэвтэрсэн хэрэглэгч олдсонгүй. Дахин нэвтэрнэ үү.");
    }

    return { user } as any;
  } catch (error) {
    throw toSafeError(error, "Нэвтрэлт шалгах үед алдаа гарлаа");
  }
}

export async function requireUserId(): Promise<string> {
  const session = await requireSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Нэвтэрсэн хэрэглэгч олдсонгүй");
  }

  return userId;
}

export async function safeInsertJob<T = any>(
  payload: Record<string, any>
): Promise<SafeResult<T>> {
  try {
    const userId = await requireUserId();

    const finalPayload = sanitizeJobsPayload({
      ...cleanObject(payload),
      posted_by_id: payload?.posted_by_id ?? userId,
    });

    const { data, error } = await supabase
      .from("jobs")
      .insert(finalPayload)
      .select("*")
      .single();

    if (error) {
      return fail(error, "Зар нэмэхэд алдаа гарлаа");
    }

    return ok((data as T) ?? null);
  } catch (error) {
    return fail(error, "Зар нэмэхэд алдаа гарлаа");
  }
}

export async function safeUpdateJob<T = any>(
  jobId: string,
  patch: Record<string, any>
): Promise<SafeResult<T>> {
  try {
    if (!jobId?.trim()) {
      return fail(null, "jobId хоосон байна");
    }

    const userId = await requireUserId();

    const safePatch =
      patch && typeof patch === "object" ? sanitizeJobsPayload(patch) : cleanObject(patch);

    const { data, error } = await supabase
      .from("jobs")
      .update(safePatch)
      .eq("id", jobId)
      .eq("posted_by_id", userId)
      .select("*")
      .single();

    if (error) {
      return fail(error, "Зар шинэчлэхэд алдаа гарлаа");
    }

    return ok((data as T) ?? null);
  } catch (error) {
    return fail(error, "Зар шинэчлэхэд алдаа гарлаа");
  }
}

export async function safeDeleteJob<T = any>(
  jobId: string
): Promise<SafeResult<T[]>> {
  try {
    if (!jobId?.trim()) {
      return fail(null, "jobId хоосон байна");
    }

    const userId = await requireUserId();

    const { data, error } = await supabase
      .from("jobs")
      .delete()
      .eq("id", jobId)
      .eq("posted_by_id", userId)
      .select("*");

    if (error) {
      return fail(error, "Зар устгахад алдаа гарлаа");
    }

    return ok((data as T[]) ?? []);
  } catch (error) {
    return fail(error, "Зар устгахад алдаа гарлаа");
  }
}

export async function safeRpc<T = any>(
  fn: string,
  params?: Record<string, any>
): Promise<SafeResult<T>> {
  try {
    if (!fn?.trim()) {
      return fail(null, "RPC function нэр хоосон байна");
    }

    await requireSession();

    const { data, error } = await supabase.rpc(fn, cleanObject(params));

    if (error) {
      return fail(error, `${fn} RPC ажиллуулахад алдаа гарлаа`);
    }

    return ok((data as T) ?? null);
  } catch (error) {
    return fail(error, `${fn} RPC ажиллуулахад алдаа гарлаа`);
  }
}

export async function safeGetMyJobById<T = any>(
  jobId: string
): Promise<SafeResult<T>> {
  try {
    if (!jobId?.trim()) {
      return fail(null, "jobId хоосон байна");
    }

    const userId = await requireUserId();

    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("posted_by_id", userId)
      .maybeSingle();

    if (error) {
      return fail(error, "Зар авахад алдаа гарлаа");
    }

    return ok((data as T) ?? null);
  } catch (error) {
    return fail(error, "Зар авахад алдаа гарлаа");
  }
}

export async function safeListMyJobs<T = any>(): Promise<SafeResult<T[]>> {
  try {
    const userId = await requireUserId();

    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("posted_by_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return fail(error, "Миний заруудыг авахад алдаа гарлаа");
    }

    return ok((data as T[]) ?? []);
  } catch (error) {
    return fail(error, "Миний заруудыг авахад алдаа гарлаа");
  }
}

export async function safeToggleJobActive<T = any>(
  jobId: string,
  isActive: boolean
): Promise<SafeResult<T>> {
  return safeUpdateJob<T>(jobId, { is_active: isActive });
}

export async function safeReplaceJobImages<T = any>(
  jobId: string,
  imageUrls: string[]
): Promise<SafeResult<T>> {
  const cleanUrls = Array.isArray(imageUrls)
    ? imageUrls.filter((x) => typeof x === "string" && x.trim().length > 0)
    : [];

  return safeUpdateJob<T>(jobId, {
    image_url: cleanUrls[0] ?? null,
    image_urls: cleanUrls,
  });
}

export async function safePatchJob<T = any>(
  jobId: string,
  patch: Record<string, any>
): Promise<SafeResult<T>> {
  return safeUpdateJob<T>(jobId, patch);
}

export async function safeReadOne<T = any>(
  table: string,
  match: Record<string, any>
): Promise<SafeResult<T>> {
  try {
    if (!table?.trim()) {
      return fail(null, "table нэр хоосон байна");
    }

    let query: any = supabase.from(table).select("*");

    for (const [key, value] of Object.entries(cleanObject(match))) {
      query = query.eq(key, value);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return fail(error, `${table} хүснэгтээс мөр уншихад алдаа гарлаа`);
    }

    return ok((data as T) ?? null);
  } catch (error) {
    return fail(error, `${table} хүснэгтээс мөр уншихад алдаа гарлаа`);
  }
}

export async function safeReadMany<T = any>(
  table: string,
  match?: Record<string, any>
): Promise<SafeResult<T[]>> {
  try {
    if (!table?.trim()) {
      return fail(null, "table нэр хоосон байна");
    }

    let query: any = supabase.from(table).select("*");

    for (const [key, value] of Object.entries(cleanObject(match))) {
      query = query.eq(key, value);
    }

    const { data, error } = await query;

    if (error) {
      return fail(error, `${table} хүснэгтээс мөрүүд уншихад алдаа гарлаа`);
    }

    return ok((data as T[]) ?? []);
  } catch (error) {
    return fail(error, `${table} хүснэгтээс мөрүүд уншихад алдаа гарлаа`);
  }
}

export async function safeInsertOne<T = any>(
  table: string,
  payload: Record<string, any>
): Promise<SafeResult<T>> {
  try {
    if (!table?.trim()) {
      return fail(null, "table нэр хоосон байна");
    }

    const { data, error } = await supabase
      .from(table)
      .insert(cleanObject(payload))
      .select("*")
      .single();

    if (error) {
      return fail(error, `${table} хүснэгтэд нэмэхэд алдаа гарлаа`);
    }

    return ok(normalizeSingleRow<T>(data));
  } catch (error) {
    return fail(error, `${table} хүснэгтэд нэмэхэд алдаа гарлаа`);
  }
}

export async function safeUpdateOne<T = any>(
  table: string,
  match: Record<string, any>,
  patch: Record<string, any>
): Promise<SafeResult<T>> {
  try {
    if (!table?.trim()) {
      return fail(null, "table нэр хоосон байна");
    }

    let query: any = supabase.from(table).update(cleanObject(patch));

    for (const [key, value] of Object.entries(cleanObject(match))) {
      query = query.eq(key, value);
    }

    const { data, error } = await query.select("*").single();

    if (error) {
      return fail(error, `${table} хүснэгтийн мөр шинэчлэхэд алдаа гарлаа`);
    }

    return ok(normalizeSingleRow<T>(data));
  } catch (error) {
    return fail(error, `${table} хүснэгтийн мөр шинэчлэхэд алдаа гарлаа`);
  }
}

export async function safeDeleteOne<T = any>(
  table: string,
  match: Record<string, any>
): Promise<SafeResult<T[]>> {
  try {
    if (!table?.trim()) {
      return fail(null, "table нэр хоосон байна");
    }

    let query: any = supabase.from(table).delete();

    for (const [key, value] of Object.entries(cleanObject(match))) {
      query = query.eq(key, value);
    }

    const { data, error } = await query.select("*");

    if (error) {
      return fail(error, `${table} хүснэгтийн мөр устгахад алдаа гарлаа`);
    }

    return ok((data as T[]) ?? []);
  } catch (error) {
    return fail(error, `${table} хүснэгтийн мөр устгахад алдаа гарлаа`);
  }
}