// contexts/JobsContext.tsx
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useRef, useState } from "react";
import { Job, MOCK_JOBS } from "@/mocks/jobs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import {
  requireSession,
  safeDeleteJob,
  safeInsertJob,
  safeRpc,
  safeUpdateJob,
} from "@/lib/supabaseSafe";
import { searchMatch } from "@/lib/searchUtils";
import { BUMP_PRIORITY_DECAY_PER_HOUR, BUMP_PRIORITY_MAX_SCORE } from "@/constants/monetization";

const STORAGE_KEY = "@jobs_storage";
const USER_LOCATION_KEY = "@user_location";
const STORAGE_BUCKET = "post-images";

interface UserLocation { latitude: number; longitude: number; }

type DbJobRow = any;
export type RentalRequestStatus = "pending" | "approved" | "rejected" | "cancelled" | "completed";
export type RentalRequest = {
  id: string; job_id: string; requester_id: string; owner_id: string;
  requester_name?: string | null; requester_phone?: string | null; requester_photo?: string | null;
  quantity: number; rent_days?: number; total_price?: number; status: RentalRequestStatus;
  message?: string | null; insurance_status?: string | null; insurance_payer_id?: string | null; insurance_payer_role?: "requester" | "owner" | null; insurance_premium?: number | null; insurance_rate_percent?: number | null; insurance_paid_at?: string | null; created_at?: string; updated_at?: string; jobs?: any;
};

function asPositiveInt(value: any, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function toSafeDate(value: any): Date {
  if (!value) return new Date();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function isNonEmptyString(value: any): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUuidLike(value: any): value is string {
  return typeof value === "string"
    ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
    : false;
}

function normalizeImageUrls(row: any): string[] {
  const raw = row?.image_urls ?? row?.imageUrls ?? null;
  if (Array.isArray(raw)) return raw.filter(isNonEmptyString);
  if (isNonEmptyString(raw)) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(isNonEmptyString);
    } catch { return [raw]; }
  }
  const fallback = row?.image_url ?? row?.imageUrl ?? null;
  if (isNonEmptyString(fallback)) return [fallback];
  return [];
}

function normalizeDynamicData(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {}
  }
  return {};
}
function getJobSearchHaystacks(row: any): string[] {
  const locationAddress = typeof row?.location === "string" ? row.location : (row?.location?.address ?? row?.address ?? "");
  return [
    row?.title ?? "", row?.description ?? "", row?.category ?? "", row?.subcategory ?? "",
    row?.subcategory_name ?? "", row?.posted_by_name ?? row?.postedBy?.name ?? "",
    row?.posted_by_phone ?? row?.postedBy?.phone ?? "", locationAddress,
  ];
}

function jobMatchesQuery(row: any, query: string): boolean {
  const q = (query ?? "").trim();
  if (!q) return true;
  return getJobSearchHaystacks(row).some((field) => searchMatch(String(field ?? ""), q));
}

function extractStoragePathFromUrl(url: string): string | null {
  try {
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  } catch { return null; }
}

async function removeStorageImages(urls: string[]) {
  const paths = urls.map((url) => extractStoragePathFromUrl(url)).filter((p): p is string => isNonEmptyString(p));
  if (!paths.length) return;
  try { await supabase.storage.from(STORAGE_BUCKET).remove(paths); } catch (error) { console.log("REMOVE STORAGE IMAGES ERROR:", error); }
}

type RentalReviewRow = { job_id: string | null; reviewed_user_id: string | null; item_rating: number | null; user_rating: number | null; };
type RatingSummary = { avg: number | null; count: number; };
type ReviewStats = { jobStats: Record<string, RatingSummary>; userStats: Record<string, RatingSummary & { rentalCount: number }>; };

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function asNumberOrNull(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getBumpedAtDate(raw: any): Date | null {
  const value = raw?.bumpedAt ?? raw?.bumped_at ?? null;
  if (!value) return null;
  const d = toSafeDate(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function loadRentalReviewStats(jobIds: string[], userIds: string[]): Promise<ReviewStats> {
  const uniqueJobIds = Array.from(new Set(jobIds.filter(isNonEmptyString)));
  const uniqueUserIds = Array.from(new Set(userIds.filter(isNonEmptyString)));
  const empty: ReviewStats = { jobStats: {}, userStats: {} };
  if (!uniqueJobIds.length && !uniqueUserIds.length) return empty;

  try {
    let query = supabase.from("rental_reviews").select("job_id, reviewed_user_id, item_rating, user_rating");
    const filters: string[] = [];
    if (uniqueJobIds.length) filters.push(`job_id.in.(${uniqueJobIds.join(",")})`);
    if (uniqueUserIds.length) filters.push(`reviewed_user_id.in.(${uniqueUserIds.join(",")})`);
    if (filters.length) query = query.or(filters.join(","));
    const { data, error } = await query;
    if (error) throw error;

    const jobRatings: Record<string, number[]> = {};
    const userRatings: Record<string, number[]> = {};
    const userRentalCounts: Record<string, number> = {};
    for (const row of (data ?? []) as RentalReviewRow[]) {
      const jobId = row.job_id ?? null;
      const userId = row.reviewed_user_id ?? null;
      const itemRating = asNumberOrNull(row.item_rating);
      const userRating = asNumberOrNull(row.user_rating);
      if (jobId && itemRating != null) {
        if (!jobRatings[jobId]) jobRatings[jobId] = [];
        jobRatings[jobId].push(itemRating);
      }
      if (userId) {
        userRentalCounts[userId] = (userRentalCounts[userId] ?? 0) + 1;
        if (userRating != null) {
          if (!userRatings[userId]) userRatings[userId] = [];
          userRatings[userId].push(userRating);
        }
      }
    }

    const jobStats: ReviewStats["jobStats"] = {};
    for (const [jobId, ratings] of Object.entries(jobRatings)) jobStats[jobId] = { avg: average(ratings), count: ratings.length };

    const userStats: ReviewStats["userStats"] = {};
    const allUserIds = new Set([...Object.keys(userRatings), ...Object.keys(userRentalCounts)]);
    for (const userId of allUserIds) {
      const ratings = userRatings[userId] ?? [];
      userStats[userId] = { avg: average(ratings), count: ratings.length, rentalCount: userRentalCounts[userId] ?? 0 };
    }

    return { jobStats, userStats };
  } catch (error: any) {
    return empty;
  }
}

function getJobRankingScore(job: any): number {
  const now = Date.now();
  const postedTs = job?.postedDate?.getTime?.() ?? toSafeDate(job?.created_at ?? job?.updated_at).getTime();
  const bumpedTs = job?.bumpedAt?.getTime?.() ?? getBumpedAtDate(job)?.getTime?.() ?? 0;
  const sponsoredUntilTs = job?.sponsoredUntil?.getTime?.() ?? toSafeDate(job?.sponsored_until).getTime?.() ?? 0;
  const isSponsored = !!job?.isSponsored && sponsoredUntilTs > now;
  const itemRating = asNumberOrNull(job?.itemRatingAvg ?? job?.item_rating_avg) ?? 0;
  const userRating = asNumberOrNull(job?.postedBy?.userRatingAvg ?? job?.user_rating_avg) ?? 0;
  const rentalCount = asNumberOrNull(job?.rentalCount ?? job?.rental_count) ?? 0;

  let score = 0;
  if (isSponsored) {
    score += 1_000_000;
    if (itemRating >= 4) score += 60_000;
    else if (itemRating >= 3) score += 35_000;
    else if (itemRating > 0) score += 12_000;
    else score += 45_000;
  }
  if (bumpedTs > 0) {
    const ageHours = Math.max(0, (now - bumpedTs) / 36e5);
    score += Math.max(0, BUMP_PRIORITY_MAX_SCORE - ageHours * BUMP_PRIORITY_DECAY_PER_HOUR);
  }
  score += itemRating * 4_000 + userRating * 2_000 + Math.min(rentalCount, 100) * 80 + postedTs / 1_000_000_000;
  return score;
}

const mapDbToJob = (row: DbJobRow, reviewStats?: ReviewStats): Job => {
  const postedUserId = row?.posted_by_id ?? row?.postedBy?.id ?? null;
  const userStat = postedUserId ? reviewStats?.userStats?.[postedUserId] : undefined;
  const postedBy = (row?.postedBy ?? {
    id: postedUserId, name: row?.posted_by_name ?? row?.posted_by_phone ?? "Unknown",
    phone: row?.posted_by_phone ?? null, photoUri: row?.posted_by_photo ?? null,
  } as any) as any;
  postedBy.userRatingAvg = userStat?.avg ?? asNumberOrNull(row?.posted_by_user_rating_avg ?? row?.user_rating_avg) ?? null;
  postedBy.userReviewCount = userStat?.count ?? asNumberOrNull(row?.posted_by_user_review_count ?? row?.user_review_count) ?? 0;
  postedBy.rentalCount = userStat?.rentalCount ?? asNumberOrNull(row?.posted_by_rental_count ?? row?.user_rental_count) ?? 0;

  const postedDateRaw = row?.postedDate ?? row?.created_at ?? row?.updated_at;
  const location: any = row?.location ?? (row?.latitude != null || row?.longitude != null || row?.address != null ? { address: row?.address ?? null, latitude: row?.latitude ?? null, longitude: row?.longitude ?? null } : null);
  const sponsoredUntilRaw = row?.sponsoredUntil ?? row?.sponsored_until ?? null;
  const sponsoredUntil = sponsoredUntilRaw ? toSafeDate(sponsoredUntilRaw) : null;
  const legacySponsored = !!(row?.isSponsored ?? row?.is_sponsored ?? false);
  const isSponsoredByTime = sponsoredUntil ? sponsoredUntil.getTime() > Date.now() : false;
  const computedIsSponsored = sponsoredUntil ? isSponsoredByTime : legacySponsored;
  const subName = row?.subcategories?.name ?? row?.subcategory?.name ?? row?.subcategory_name ?? row?.subcategory ?? null;
  const imageUrls = normalizeImageUrls(row);
  const jobStat = row?.id ? reviewStats?.jobStats?.[row.id] : undefined;
  const itemRatingAvg = jobStat?.avg ?? asNumberOrNull(row?.item_rating_avg ?? row?.itemRatingAvg);
  const itemReviewCount = jobStat?.count ?? asNumberOrNull(row?.item_review_count ?? row?.itemReviewCount) ?? 0;
  const rentalCount = jobStat?.count ?? asNumberOrNull(row?.rental_count ?? row?.rentalCount) ?? itemReviewCount;
  const bumpedAt = getBumpedAtDate(row);
  const quantity = asPositiveInt(row?.quantity ?? row?.qty ?? 1, 1);
  const availableQuantity = Math.max(0, asPositiveInt(row?.available_quantity ?? row?.availableQuantity ?? quantity, quantity));
  
  const mapped: any = {
    ...row, id: row?.id, title: row?.title ?? "", description: row?.description ?? "",
    category: row?.category ?? null, subcategory: subName, subcategory_id: row?.subcategory_id ?? row?.subcategoryId ?? null,
    postType: row?.postType ?? row?.post_type ?? "job", sponsoredUntil, isSponsored: computedIsSponsored,
    isActive: row?.isActive ?? row?.is_active ?? true, postedBy, postedDate: toSafeDate(postedDateRaw),
    applicants: row?.applicants ?? 0, location, salary: row?.salary ?? null, urgency: row?.urgency ?? null,
    image_url: imageUrls[0] ?? null, image_urls: imageUrls, itemRatingAvg, item_rating_avg: itemRatingAvg,
    itemReviewCount, item_review_count: itemReviewCount, rentalCount, rental_count: rentalCount,
    bumpedAt, bump_count: asNumberOrNull(row?.bump_count ?? row?.bumpCount) ?? 0, quantity,
    available_quantity: availableQuantity, price: asNumberOrNull(row?.price) ?? 0,
    dynamic_data: normalizeDynamicData(row?.dynamic_data ?? row?.dynamicData),
    price_type: row?.price_type ?? row?.priceType ?? null,
  };
  return mapped as Job;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function formatSupabaseError(error: any) {
  if (!error) return "Unknown Supabase error";
  return { message: error?.message ?? String(error), code: error?.code ?? null, details: error?.details ?? null, hint: error?.hint ?? null };
}

async function hydrateJobDetails(rows: any[]): Promise<any[]> {
  const jobIds = Array.from(new Set(rows.map((row) => row?.id).filter(isNonEmptyString)));
  if (!jobIds.length) return rows;

  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("id,dynamic_data,price_type,category_id,subcategory_id")
      .in("id", jobIds);
    if (error || !Array.isArray(data)) return rows;

    const detailsById = new Map(data.map((detail: any) => [detail.id, detail]));
    return rows.map((row) => {
      const detail = detailsById.get(row?.id);
      if (!detail) return row;
      return {
        ...row,
        dynamic_data: detail.dynamic_data ?? row?.dynamic_data ?? row?.dynamicData,
        price_type: detail.price_type ?? row?.price_type ?? row?.priceType,
        category_id: detail.category_id ?? row?.category_id ?? row?.categoryId,
        subcategory_id: detail.subcategory_id ?? row?.subcategory_id ?? row?.subcategoryId,
      };
    });
  } catch {
    return rows;
  }
}
async function queryJobsRobustly(): Promise<any[]> {
  const selectAttempts = [{ label: "jobs_with_subcategories", select: "*, subcategories(name)" }, { label: "jobs_only", select: "*" }];
  const activeFilterAttempts = [true, false];
  let lastError: any = null;
  for (const selectAttempt of selectAttempts) {
    for (const useActiveFilter of activeFilterAttempts) {
      try {
        let query = supabase.from("active_jobs_v").select(selectAttempt.select);
        if (useActiveFilter) query = query.eq("is_active", true);
        query = query.order("created_at", { ascending: false });
        const { data, error } = await query;
        if (error) { lastError = error; continue; }
        const rows = Array.isArray(data) ? data : [];
        const activeRows = rows.filter((row: any) => {
          if (row?.is_active === false) return false;
          const available = Number(row?.available_quantity ?? row?.availableQuantity ?? 1);
          return !Number.isFinite(available) || available > 0;
        });
        return hydrateJobDetails(activeRows);
      } catch (error) { lastError = error; }
    }
  }
  throw lastError ?? new Error("Unable to load jobs from Supabase");
}

function sortJobs(list: Job[]): Job[] {
  return list.slice().sort((a: any, b: any) => {
    const scoreDiff = getJobRankingScore(b) - getJobRankingScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const aPosted = a?.postedDate?.getTime?.() ?? 0;
    const bPosted = b?.postedDate?.getTime?.() ?? 0;
    return bPosted - aPosted;
  });
}

async function saveJobsToCache(list: Job[]) {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

async function loadJobsFromCache(): Promise<Job[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr.map((row: any) => mapDbToJob(row));
  } catch { return []; }
}

export const [JobsContext, useJobs] = createContextHook(() => {
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [rentalRequests, setRentalRequests] = useState<RentalRequest[]>([]);
  
  // Хадгалсан заруудын ID-г барьж байх State
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadUserLocation = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_LOCATION_KEY);
      if (!mountedRef.current) return;
      if (stored) setUserLocation(JSON.parse(stored));
    } catch (error) { console.error("Failed to load user location:", error); }
  }, []);

  const saveUserLocation = useCallback(async (location: UserLocation) => {
    try {
      await AsyncStorage.setItem(USER_LOCATION_KEY, JSON.stringify(location));
      if (!mountedRef.current) return;
      setUserLocation(location);
    } catch (error) { throw error; }
  }, []);

  // Баазаас хадгалсан заруудыг татах
  const loadSavedJobs = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) return;

      const { data, error } = await supabase
        .from("saved_jobs")
        .select("job_id")
        .eq("user_id", uid);

      if (error) throw error;
      if (data && mountedRef.current) {
        setSavedJobIds(data.map(d => d.job_id));
      }
    } catch (e) {
      console.log("Load saved jobs error:", e);
    }
  }, []);

  // 🎯 ЗАСВАРЛАГДСАН: Давхардаж хадгалахгүй, UI шууд өөрчлөгдөнө, Алдаа заахгүй!
  const toggleSaveJob = useCallback(async (jobId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) throw new Error("Нэвтэрсний дараа хадгалах боломжтой");

      const isSaved = savedJobIds.includes(jobId);

      if (isSaved) {
        // 1. Устгах үйлдэл
        setSavedJobIds(prev => prev.filter(id => id !== jobId)); // UI-г шууд өөрчлөх
        const { error } = await supabase
          .from("saved_jobs")
          .delete()
          .match({ user_id: uid, job_id: jobId });
        if (error) throw error;
      } else {
        // 2. Нэмэх үйлдэл
        setSavedJobIds(prev => [...prev, jobId]); // UI-г шууд өөрчлөх
        const { error } = await supabase
          .from("saved_jobs")
          .insert({ user_id: uid, job_id: jobId });
          
        // Хэрвээ баазад аль хэдийн хадгалагдсан байвал (23505 кодтой алдаа) чимээгүй өнгөрнө!
        if (error && error.code === '23505') {
          console.log("Аль хэдийн хадгалагдсан байна, алдаа заах шаардлагагүй.");
        } else if (error) {
          throw error;
        }
      }
    } catch (e: any) {
      console.error("Toggle save job error:", e);
      // Алдаа гарвал буцаагаад хуучин байдалд нь оруулна
      const isSaved = savedJobIds.includes(jobId);
      setSavedJobIds(prev => isSaved ? prev.filter(id => id !== jobId) : [...prev, jobId]);
    }
  }, [savedJobIds]);

  const loadJobs = useCallback(async (searchText?: string) => {
    const myReqId = ++requestIdRef.current;
    const qRaw = (searchText ?? "").trim();
    const hasQuery = qRaw.length > 0;
    const MAX_RETRY = 3;

    try {
      if (mountedRef.current) setIsLoading(true);
      const cachedJobs = hasQuery ? [] : await loadJobsFromCache();
      if (!hasQuery && cachedJobs.length > 0 && mountedRef.current && requestIdRef.current === myReqId) {
        setJobs(sortJobs(cachedJobs));
      }
      let rows: any[] = [];
      for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        try { rows = await queryJobsRobustly(); break; } catch (err) { if (attempt === MAX_RETRY) throw err; await sleep(300 * attempt); }
      }
      if (!mountedRef.current || requestIdRef.current !== myReqId) return;

      const reviewStats = await loadRentalReviewStats(
        rows.map((row: any) => row?.id).filter(isNonEmptyString),
        rows.map((row: any) => row?.posted_by_id).filter(isNonEmptyString),
      );

      let mapped = rows.map((row: any) => mapDbToJob(row, reviewStats));
      if (hasQuery) mapped = mapped.filter((job) => jobMatchesQuery(job, qRaw));

      const sorted = sortJobs(mapped);
      if (!mountedRef.current || requestIdRef.current !== myReqId) return;

      if (!hasQuery && sorted.length === 0 && cachedJobs.length > 0) {
        setJobs(sortJobs(cachedJobs));
      } else {
        setJobs(sorted);
        if (!hasQuery) await saveJobsToCache(sorted);
      }
    } catch (error) {
      if (!mountedRef.current || requestIdRef.current !== myReqId) return;
      const cached = await loadJobsFromCache();
      if (!mountedRef.current || requestIdRef.current !== myReqId) return;
      if (cached.length > 0) {
        const filtered = hasQuery ? cached.filter((job) => jobMatchesQuery(job, qRaw)) : cached;
        setJobs(sortJobs(filtered));
      } else if (hasQuery) {
        setJobs([]);
      } else {
        setJobs(sortJobs(MOCK_JOBS));
      }
    } finally {
      if (mountedRef.current && requestIdRef.current === myReqId) setIsLoading(false);
    }
  }, []);

  const searchJobs = useCallback(async (text: string) => { await loadJobs(text); }, [loadJobs]);
  const clearSearch = useCallback(async () => { await loadJobs(); }, [loadJobs]);

  const loadRentalRequests = useCallback(async () => {
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.user?.id) {
        if (mountedRef.current) setRentalRequests([]);
        return [];
      }
      const uid = data.session.user.id;
      const selectWithJob = "id,job_id,requester_id,owner_id,requester_name,requester_phone,requester_photo,quantity,rent_days,total_price,status,message,insurance_status,insurance_payer_id,insurance_payer_role,insurance_premium,insurance_rate_percent,insurance_paid_at,created_at,updated_at,jobs(id,title,description,category,subcategory,posted_by_name,posted_by_phone,image_url,image_urls)";

      let rows: any[] = [];
      const withJoin = await supabase
        .from("rental_requests")
        .select(selectWithJob)
        .or(`owner_id.eq.${uid},requester_id.eq.${uid}`)
        .order("created_at", { ascending: false });

      if (withJoin.error) {
        const fallback = await supabase
          .from("rental_requests")
          .select("*")
          .or(`owner_id.eq.${uid},requester_id.eq.${uid}`)
          .order("created_at", { ascending: false });
        if (fallback.error) throw fallback.error;
        rows = Array.isArray(fallback.data) ? fallback.data : [];
      } else {
        rows = Array.isArray(withJoin.data) ? withJoin.data : [];
      }

      if (mountedRef.current) setRentalRequests(rows as RentalRequest[]);
      return rows as RentalRequest[];
    } catch (error) {
      if (mountedRef.current) setRentalRequests([]);
      return [];
    }
  }, []);

  const createRentalRequest = useCallback(async (jobId: string, quantity = 1, rentDays = 1, message?: string) => {
      const session = await requireSession();
      const requesterId = session?.user?.id ?? null;
      if (!requesterId) throw new Error("Нэвтэрсний дараа түрээслэх боломжтой");

      const job = jobs.find((item: any) => String(item.id) === String(jobId)) as any;
      if (!job) throw new Error("Зар олдсонгүй");

      const ownerId = job?.postedBy?.id ?? job?.posted_by_id ?? job?.owner_id ?? null;
      if (!ownerId) throw new Error("Зарын эзний мэдээлэл олдсонгүй");
      if (String(ownerId) === String(requesterId)) throw new Error("Өөрийн зарыг түрээслэх боломжгүй");

      const requestQuantity = asPositiveInt(quantity, 1);
      const requestDays = asPositiveInt(rentDays, 1);
      const available = Number(job?.available_quantity ?? job?.availableQuantity ?? job?.quantity ?? 1);
      if (Number.isFinite(available) && available < requestQuantity) throw new Error("Энэ зарын боломжит тоо хүрэлцэхгүй байна");

      const jobPrice = Number(job?.price) || 0;
      const totalPrice = jobPrice * requestQuantity * requestDays;

      const { data: existing, error: existingError } = await supabase
        .from("rental_requests")
        .select("id,status")
        .eq("job_id", jobId)
        .eq("requester_id", requesterId)
        .eq("status", "pending")
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing?.id) throw new Error("Та энэ зар дээр өмнө нь хүсэлт илгээсэн байна");

      const requesterMeta: any = session?.user?.user_metadata ?? {};
      const { data, error } = await supabase
        .from("rental_requests")
        .insert({
          job_id: jobId, requester_id: requesterId, owner_id: ownerId,
          requester_name: requesterMeta.name ?? requesterMeta.full_name ?? session?.user?.phone ?? session?.user?.email ?? "Хэрэглэгч",
          requester_phone: requesterMeta.phone ?? session?.user?.phone ?? null,
          requester_photo: requesterMeta.photoUri ?? requesterMeta.avatar_url ?? null,
          quantity: requestQuantity, rent_days: requestDays, total_price: totalPrice,
          message: message?.trim() || null, status: "pending",
        })
        .select("*")
        .single();
      if (error) throw error;
      await loadRentalRequests();
      return data as RentalRequest;
    }, [jobs, loadRentalRequests]);

  const approveRentalRequest = useCallback(async (requestId: string) => {
      if (!requestId) throw new Error("Request ID is required");
      const rpc = await safeRpc<any>("approve_rental_request", { p_request_id: requestId });
      if ((rpc as any)?.error) throw (rpc as any).error;
      await Promise.all([loadJobs(), loadRentalRequests()]);
      return (rpc as any)?.data;
    }, [loadJobs, loadRentalRequests]);

  const rejectRentalRequest = useCallback(async (requestId: string) => {
      if (!requestId) throw new Error("Request ID is required");
      const rpc = await safeRpc<any>("reject_rental_request", { p_request_id: requestId });
      if ((rpc as any)?.error) throw (rpc as any).error;
      await loadRentalRequests();
      return (rpc as any)?.data;
    }, [loadRentalRequests]);

  useEffect(() => {
    loadJobs();
    loadUserLocation();
    loadSavedJobs(); // Апп асах үед хадгалсан зарууд татагдана
    loadRentalRequests().catch(() => {});
  }, [loadJobs, loadUserLocation, loadSavedJobs, loadRentalRequests]);

  const addJob = useCallback(async (newJob: Omit<Job, "id" | "postedDate" | "applicants" | "postedBy">, userInfo: { name: string; phone: string; photoUri?: string; isSponsored?: boolean; sponsoredUntil?: Date | string | null; }) => {
      try {
        const session = await requireSession();
        const uid = session?.user?.id ?? null;
        if (!uid) throw new Error("Not authenticated. Please login again.");

        const imageUrls = Array.isArray((newJob as any).image_urls) ? (newJob as any).image_urls.filter(isNonEmptyString) : [];
        const rawCategoryId = (newJob as any).category_id ?? (newJob as any).categoryId ?? null;
        const rawSubcategoryId = (newJob as any).subcategory_id ?? (newJob as any).subcategoryId ?? null;
        const safeCategoryId = isUuidLike(rawCategoryId) ? rawCategoryId : null;
        const safeSubcategoryId = isUuidLike(rawSubcategoryId) ? rawSubcategoryId : null;
        const safeCategory = isNonEmptyString((newJob as any).category) ? (newJob as any).category.trim() : null;
        const safeSubcategory = isNonEmptyString((newJob as any).subcategory) ? (newJob as any).subcategory.trim() : null;
        const payload: any = {
          posted_by_id: uid, title: (newJob as any).title, description: (newJob as any).description,
          category: safeCategory, subcategory: safeSubcategory, post_type: (newJob as any).postType ?? "job",
          category_id: safeCategoryId, subcategory_id: safeSubcategoryId,
          address: (newJob as any).location?.address ?? (newJob as any).address ?? null,
          latitude: (newJob as any).location?.latitude ?? (newJob as any).latitude ?? null,
          longitude: (newJob as any).location?.longitude ?? (newJob as any).longitude ?? null,
          posted_by_name: userInfo.name, posted_by_phone: userInfo.phone, posted_by_photo: userInfo.photoUri ?? null,
          is_sponsored: userInfo.isSponsored ?? false, sponsored_until: userInfo.sponsoredUntil ? new Date(userInfo.sponsoredUntil).toISOString() : null,
          image_url: imageUrls[0] ?? (newJob as any).image_url ?? null, image_urls: imageUrls,
          item_rating_avg: null, item_review_count: 0, rental_count: 0, bumped_at: null, bump_count: 0,
          quantity: asPositiveInt((newJob as any).quantity ?? 1, 1), available_quantity: asPositiveInt((newJob as any).available_quantity ?? (newJob as any).quantity ?? 1, 1),
          price: Number((newJob as any).price) || 0,
          is_active: true,
          dynamic_data: (newJob as any).dynamic_data ?? null,
          price_type: (newJob as any).price_type ?? null,
        };
        const res = await safeInsertJob(payload);
        if (res.error) throw res.error;
        await loadJobs();
        return mapDbToJob(res.data);
      } catch (error) { throw error; }
    }, [loadJobs]);

  const sponsorJob = useCallback(async (jobId: string, sponsoredUntil: Date | string | null) => {
      try {
        if (!jobId) throw new Error("Job ID is required");
        const untilIso = sponsoredUntil ? new Date(sponsoredUntil).toISOString() : null;
        const res = await safeRpc<any>("admin_sponsor_job", { p_job_id: jobId, p_until: untilIso });
        if ((res as any)?.error) throw (res as any).error;
        const data = (res as any)?.data;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) throw new Error("0 rows updated");
        await loadJobs();
        return row;
      } catch (error) { throw error; }
    }, [loadJobs]);

  const updateJobCategory = useCallback(async (jobId: string, newCategory: string) => {
      try {
        const res = await safeUpdateJob(jobId, { category: newCategory, category_id: null });
        if (res.error) throw res.error;
        await loadJobs();
      } catch (error) { throw error; }
    }, [loadJobs]);

  const deleteJob = useCallback(async (jobId: string) => {
      try {
        const existingJob = jobs.find((j: any) => j.id === jobId) as any;
        const storageUrls = normalizeImageUrls(existingJob);
        const res = await safeDeleteJob(jobId);
        if (res.error) throw res.error;
        if (storageUrls.length > 0) await removeStorageImages(storageUrls);
        setJobs((prev) => {
          const next = prev.filter((j: any) => j.id !== jobId);
          saveJobsToCache(next as Job[]);
          return next;
        });
      } catch (error) { throw error; }
    }, [jobs]);

  const toggleJobActive = useCallback(async (jobId: string, isActive: boolean) => {
      try {
        const res = await safeUpdateJob(jobId, { is_active: isActive });
        if (res.error) throw res.error;
        setJobs((prev) => {
          const next = prev.map((j: any) => j.id === jobId ? { ...j, isActive } : j);
          saveJobsToCache(next as Job[]);
          return next;
        });
      } catch (error) { throw error; }
    }, []);

  const bumpJob = useCallback(async (jobId: string) => {
      try {
        if (!jobId) throw new Error("Job ID is required");
        const existing = jobs.find((j: any) => j.id === jobId) as any;
        const nowIso = new Date().toISOString();
        const nextCount = (asNumberOrNull(existing?.bumpCount ?? existing?.bump_count) ?? 0) + 1;
        const res = await safeUpdateJob(jobId, { bumped_at: nowIso, bump_count: nextCount, updated_at: nowIso });
        if (res.error) throw res.error;
        await loadJobs();
      } catch (error) { throw error; }
    }, [jobs, loadJobs]);

  const submitRentalReview = useCallback(async (params: {
    jobId: string;
    requestId?: string | null;
    reviewedUserId?: string | null;
    itemRating: number;
    userRating?: number | null;
    comment?: string;
  }) => {
      try {
        const session = await requireSession();
        const reviewerId = session?.user?.id ?? null;
        if (!reviewerId) throw new Error("Not authenticated. Please login again.");

        const job = jobs.find((j: any) => j.id === params.jobId) as any;
        const requestId = typeof params.requestId === "string" ? params.requestId.trim() || null : null;
        const reviewedUserId = String(
          params.reviewedUserId ?? job?.postedBy?.id ?? job?.posted_by_id ?? job?.postedById ?? "",
        ).trim();

        if (!params.jobId) throw new Error("Job ID is required");
        if (!reviewedUserId) throw new Error("Түрээслүүлэгчийн ID олдсонгүй");
        if (reviewerId === reviewedUserId) throw new Error("Өөрийгөө үнэлэх боломжгүй");

        if (requestId) {
          const { data: existingReviews, error: existingReviewError } = await supabase
            .from("rental_reviews")
            .select("id")
            .eq("request_id", requestId)
            .eq("reviewer_id", reviewerId)
            .limit(1);
          if (existingReviewError) throw existingReviewError;
          if ((existingReviews ?? []).length > 0) {
            throw new Error("Та энэ түрээсийн хүсэлтэд үнэлгээ өгсөн байна.");
          }
        }

        const itemRating = Math.max(1, Math.min(5, Number(params.itemRating)));
        const userRating = params.userRating ? Math.max(1, Math.min(5, Number(params.userRating))) : null;
        const { error } = await supabase.from("rental_reviews").insert({
          job_id: params.jobId,
          reviewer_id: reviewerId,
          reviewed_user_id: reviewedUserId,
          item_rating: itemRating,
          user_rating: userRating,
          comment: params.comment?.trim() || null,
          ...(requestId ? { request_id: requestId } : {}),
        });
        if (error) throw error;
        await Promise.all([loadJobs(), loadRentalRequests()]);
      } catch (error) { throw error; }
    }, [jobs, loadJobs, loadRentalRequests]);

  return {
    jobs, addJob, sponsorJob, updateJobCategory, deleteJob, toggleJobActive, bumpJob, submitRentalReview,
    rentalRequests, loadRentalRequests, createRentalRequest, approveRentalRequest, rejectRentalRequest,
    isLoading, userLocation, saveUserLocation, loadJobs, searchJobs, clearSearch,
    savedJobIds, toggleSaveJob,
  };
});
