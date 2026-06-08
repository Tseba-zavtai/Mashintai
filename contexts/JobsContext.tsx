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

const STORAGE_KEY = "@jobs_storage";
const USER_LOCATION_KEY = "@user_location";
const STORAGE_BUCKET = "post-images";

interface UserLocation {
  latitude: number;
  longitude: number;
}

type DbJobRow = any;

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
    ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value.trim(),
      )
    : false;
}

/**
 * LIKE wildcard-ууд (% болон _) орсон үед query эвдэхээс хамгаална
 */
function escapeLike(input: string): string {
  return (input ?? "").replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Текстийг search-д бэлдэнэ
 * - lower
 * - trim
 * - special chars / зай зэргийг цэвэрлэнэ
 */
function normalizeForSearch(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яёөү0-9]+/gi, "");
}

/**
 * Cyrillic -> Latin
 * санхүү -> sankhuu
 * барилга -> barilga
 * тогооч -> togooch
 */
function cyrillicToLatin(input: string): string {
  const text = (input ?? "").toLowerCase();

  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "j",
    з: "z",
    и: "i",
    й: "i",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    ө: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ү: "u",
    ф: "f",
    х: "kh",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sh",
    ъ: "",
    ы: "ii",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  let out = "";
  for (const ch of text) {
    out += map[ch] ?? ch;
  }
  return out;
}

/**
 * Latin -> Cyrillic
 * practical Mongolian search helper
 */
function latinToCyrillic(input: string): string {
  let s = (input ?? "").trim().toLowerCase().replace(/\s+/g, " ");

  const rules: Array<[RegExp, string]> = [
    [/sch/g, "щ"],
    [/sh/g, "ш"],
    [/ch/g, "ч"],
    [/ts/g, "ц"],
    [/ya/g, "я"],
    [/yo/g, "ё"],
    [/yu/g, "ю"],
    [/ye/g, "е"],
    [/kh/g, "х"],
  ];

  for (const [re, rep] of rules) s = s.replace(re, rep);

  const map: Record<string, string> = {
    a: "а",
    b: "б",
    v: "в",
    g: "г",
    d: "д",
    e: "е",
    z: "з",
    i: "и",
    j: "ж",
    k: "к",
    l: "л",
    m: "м",
    n: "н",
    o: "о",
    p: "п",
    r: "р",
    s: "с",
    t: "т",
    u: "у",
    f: "ф",
    h: "х",
    y: "й",
    q: "к",
    w: "в",
    x: "кс",
    c: "к",
  };

  let out = "";
  for (const ch of s) out += map[ch] ?? ch;
  return out;
}

/**
 * Нэг query-г олон хувилбар болгоно
 * sankhuu -> sankhuu / санхуу / sankhu / ...
 */
function buildSearchVariants(input: string): string[] {
  const raw = (input ?? "").trim();
  if (!raw) return [];

  const variants = new Set<string>();

  const add = (v: string) => {
    const n = normalizeForSearch(v);
    if (n) variants.add(n);
  };

  add(raw);
  add(latinToCyrillic(raw));
  add(cyrillicToLatin(raw));

  const lowered = raw.toLowerCase();

  add(lowered.replace(/oo/g, "o"));
  add(lowered.replace(/uu/g, "u"));
  add(lowered.replace(/ii/g, "i"));
  add(lowered.replace(/ee/g, "e"));
  add(lowered.replace(/aa/g, "a"));

  add(lowered.replace(/kh/g, "h"));
  add(lowered.replace(/sh/g, "s"));
  add(lowered.replace(/ch/g, "c"));

  add(latinToCyrillic(lowered.replace(/oo/g, "o")));
  add(latinToCyrillic(lowered.replace(/uu/g, "u")));
  add(latinToCyrillic(lowered.replace(/ii/g, "i")));
  add(latinToCyrillic(lowered.replace(/kh/g, "h")));
  add(latinToCyrillic(lowered.replace(/sh/g, "s")));
  add(latinToCyrillic(lowered.replace(/ch/g, "c")));

  return Array.from(variants);
}

/**
 * Search compare
 * text: original/cyrillic/latin бүх хувилбараар тулгана
 */
function searchMatch(text: string, query: string): boolean {
  const variants = buildSearchVariants(query);
  if (variants.length === 0) return true;

  const original = normalizeForSearch(text);
  const translit = normalizeForSearch(cyrillicToLatin(text));

  return variants.some((q) => original.includes(q) || translit.includes(q));
}

function normalizeImageUrls(row: any): string[] {
  const raw = row?.image_urls ?? row?.imageUrls ?? null;

  if (Array.isArray(raw)) {
    return raw.filter(isNonEmptyString);
  }

  if (isNonEmptyString(raw)) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(isNonEmptyString);
      }
    } catch {
      return [raw];
    }
  }

  const fallback = row?.image_url ?? row?.imageUrl ?? null;
  if (isNonEmptyString(fallback)) {
    return [fallback];
  }

  return [];
}

/**
 * Job search field-үүдийг нэгтгэнэ
 */
function getJobSearchHaystacks(row: any): string[] {
  const locationAddress =
    typeof row?.location === "string"
      ? row.location
      : (row?.location?.address ?? row?.address ?? "");

  return [
    row?.title ?? "",
    row?.description ?? "",
    row?.category ?? "",
    row?.subcategory ?? "",
    row?.subcategory_name ?? "",
    row?.posted_by_name ?? row?.postedBy?.name ?? "",
    row?.posted_by_phone ?? row?.postedBy?.phone ?? "",
    locationAddress,
  ];
}

/**
 * App-level search filter
 */
function jobMatchesQuery(row: any, query: string): boolean {
  const q = (query ?? "").trim();
  if (!q) return true;

  return getJobSearchHaystacks(row).some((field) =>
    searchMatch(String(field ?? ""), q),
  );
}

function extractStoragePathFromUrl(url: string): string | null {
  try {
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;

    const path = url.slice(idx + marker.length).split("?")[0];
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

async function removeStorageImages(urls: string[]) {
  const paths = urls
    .map((url) => extractStoragePathFromUrl(url))
    .filter((p): p is string => isNonEmptyString(p));

  if (!paths.length) return;

  try {
    await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  } catch (error) {
    console.log("REMOVE STORAGE IMAGES ERROR:", error);
  }
}

type RentalReviewRow = {
  job_id: string | null;
  reviewed_user_id: string | null;
  item_rating: number | null;
  user_rating: number | null;
};

type RatingSummary = {
  avg: number | null;
  count: number;
};

type ReviewStats = {
  jobStats: Record<string, RatingSummary>;
  userStats: Record<string, RatingSummary & { rentalCount: number }>;
};

function average(values: number[]): number | null {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
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

async function loadRentalReviewStats(
  jobIds: string[],
  userIds: string[],
): Promise<ReviewStats> {
  const uniqueJobIds = Array.from(new Set(jobIds.filter(isNonEmptyString)));
  const uniqueUserIds = Array.from(new Set(userIds.filter(isNonEmptyString)));

  const empty: ReviewStats = { jobStats: {}, userStats: {} };
  if (!uniqueJobIds.length && !uniqueUserIds.length) return empty;

  try {
    let query = supabase
      .from("rental_reviews")
      .select("job_id, reviewed_user_id, item_rating, user_rating");

    const filters: string[] = [];
    if (uniqueJobIds.length)
      filters.push(`job_id.in.(${uniqueJobIds.join(",")})`);
    if (uniqueUserIds.length)
      filters.push(`reviewed_user_id.in.(${uniqueUserIds.join(",")})`);
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
    for (const [jobId, ratings] of Object.entries(jobRatings)) {
      jobStats[jobId] = { avg: average(ratings), count: ratings.length };
    }

    const userStats: ReviewStats["userStats"] = {};
    const allUserIds = new Set([
      ...Object.keys(userRatings),
      ...Object.keys(userRentalCounts),
    ]);
    for (const userId of allUserIds) {
      const ratings = userRatings[userId] ?? [];
      userStats[userId] = {
        avg: average(ratings),
        count: ratings.length,
        rentalCount: userRentalCounts[userId] ?? 0,
      };
    }

    return { jobStats, userStats };
  } catch (error: any) {
    const msg = String(error?.message ?? error ?? "").toLowerCase();
    if (
      msg.includes("rental_reviews") ||
      msg.includes("does not exist") ||
      msg.includes("schema cache")
    ) {
      console.warn(
        "[reviews] rental_reviews table not ready yet. Run the SQL migration first.",
      );
      return empty;
    }
    console.warn(
      "[reviews] Failed to load review stats:",
      formatSupabaseError(error),
    );
    return empty;
  }
}

function getJobRankingScore(job: any): number {
  const now = Date.now();
  const postedTs =
    job?.postedDate?.getTime?.() ??
    toSafeDate(job?.created_at ?? job?.updated_at).getTime();
  const bumpedTs =
    job?.bumpedAt?.getTime?.() ?? getBumpedAtDate(job)?.getTime?.() ?? 0;
  const sponsoredUntilTs =
    job?.sponsoredUntil?.getTime?.() ??
    toSafeDate(job?.sponsored_until).getTime?.() ??
    0;
  const isSponsored = !!job?.isSponsored && sponsoredUntilTs > now;
  const itemRating =
    asNumberOrNull(job?.itemRatingAvg ?? job?.item_rating_avg) ?? 0;
  const userRating =
    asNumberOrNull(job?.postedBy?.userRatingAvg ?? job?.user_rating_avg) ?? 0;
  const rentalCount =
    asNumberOrNull(job?.rentalCount ?? job?.rental_count) ?? 0;

  let score = 0;

  if (isSponsored) {
    score += 1_000_000;
    if (itemRating >= 4) score += 60_000;
    else if (itemRating >= 3) score += 35_000;
    else if (itemRating > 0) score += 12_000;
    else score += 45_000; // шинэ, үнэлгээгүй sponsored-д боломж өгнө
  }

  if (bumpedTs > 0) {
    const ageHours = Math.max(0, (now - bumpedTs) / 36e5);
    score += Math.max(0, 180_000 - ageHours * 4_000);
  }

  score += itemRating * 4_000;
  score += userRating * 2_000;
  score += Math.min(rentalCount, 100) * 80;
  score += postedTs / 1_000_000_000;

  return score;
}

/**
 * Supabase row -> App Job (normalize)
 */
const mapDbToJob = (row: DbJobRow, reviewStats?: ReviewStats): Job => {
  const postedUserId = row?.posted_by_id ?? row?.postedBy?.id ?? null;
  const userStat = postedUserId
    ? reviewStats?.userStats?.[postedUserId]
    : undefined;

  const postedBy = (row?.postedBy ??
    ({
      id: postedUserId,
      name: row?.posted_by_name ?? row?.posted_by_phone ?? "Unknown",
      phone: row?.posted_by_phone ?? null,
      photoUri: row?.posted_by_photo ?? null,
    } as any)) as any;

  postedBy.userRatingAvg =
    userStat?.avg ??
    asNumberOrNull(row?.posted_by_user_rating_avg ?? row?.user_rating_avg) ??
    null;
  postedBy.userReviewCount =
    userStat?.count ??
    asNumberOrNull(
      row?.posted_by_user_review_count ?? row?.user_review_count,
    ) ??
    0;
  postedBy.rentalCount =
    userStat?.rentalCount ??
    asNumberOrNull(row?.posted_by_rental_count ?? row?.user_rental_count) ??
    0;

  const postedDateRaw = row?.postedDate ?? row?.created_at ?? row?.updated_at;

  const location: any =
    row?.location ??
    (row?.latitude != null || row?.longitude != null || row?.address != null
      ? {
          address: row?.address ?? null,
          latitude: row?.latitude ?? null,
          longitude: row?.longitude ?? null,
        }
      : null);

  const sponsoredUntilRaw = row?.sponsoredUntil ?? row?.sponsored_until ?? null;
  const sponsoredUntil = sponsoredUntilRaw
    ? toSafeDate(sponsoredUntilRaw)
    : null;

  const legacySponsored = !!(row?.isSponsored ?? row?.is_sponsored ?? false);
  const isSponsoredByTime = sponsoredUntil
    ? sponsoredUntil.getTime() > Date.now()
    : false;
  const computedIsSponsored = sponsoredUntil
    ? isSponsoredByTime
    : legacySponsored;

  const subName =
    row?.subcategories?.name ??
    row?.subcategory?.name ??
    row?.subcategory_name ??
    row?.subcategory ??
    null;

  const imageUrls = normalizeImageUrls(row);
  const jobStat = row?.id ? reviewStats?.jobStats?.[row.id] : undefined;
  const itemRatingAvg =
    jobStat?.avg ?? asNumberOrNull(row?.item_rating_avg ?? row?.itemRatingAvg);
  const itemReviewCount =
    jobStat?.count ??
    asNumberOrNull(row?.item_review_count ?? row?.itemReviewCount) ??
    0;
  const rentalCount =
    jobStat?.count ??
    asNumberOrNull(row?.rental_count ?? row?.rentalCount) ??
    itemReviewCount;
  const bumpedAt = getBumpedAtDate(row);

  const mapped: any = {
    ...row,
    id: row?.id,
    title: row?.title ?? "",
    description: row?.description ?? "",
    category: row?.category ?? null,
    subcategory: subName,
    subcategory_id: row?.subcategory_id ?? row?.subcategoryId ?? null,
    postType: row?.postType ?? row?.post_type ?? "job",
    sponsoredUntil,
    isSponsored: computedIsSponsored,
    isActive: row?.isActive ?? row?.is_active ?? true,
    postedBy,
    postedDate: toSafeDate(postedDateRaw),
    applicants: row?.applicants ?? 0,
    location,
    salary: row?.salary ?? null,
    urgency: row?.urgency ?? null,
    image_url: imageUrls[0] ?? null,
    image_urls: imageUrls,
    itemRatingAvg,
    item_rating_avg: itemRatingAvg,
    itemReviewCount,
    item_review_count: itemReviewCount,
    rentalCount,
    rental_count: rentalCount,
    bumpedAt,
    bumped_at: bumpedAt ? bumpedAt.toISOString() : null,
    bumpCount: asNumberOrNull(row?.bump_count ?? row?.bumpCount) ?? 0,
    bump_count: asNumberOrNull(row?.bump_count ?? row?.bumpCount) ?? 0,
  };

  return mapped as Job;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function formatSupabaseError(error: any) {
  if (!error) return "Unknown Supabase error";

  return {
    message: error?.message ?? String(error),
    code: error?.code ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
  };
}

/**
 * jobs унших хамгийн тэсвэртэй хувилбар.
 *
 * 1. Эхлээд jobs + subcategories join хийж үзнэ.
 * 2. Join дээр relationship / RLS / schema асуудал гарвал jobs дангаар нь уншина.
 * 3. is_active column/filter асуудалтай байвал filter-гүй уншаад app дээрээ filter хийнэ.
 *
 * Ингэснээр Supabase schema бага зэрэг зөрсөн ч app шууд унахгүй.
 */
async function queryJobsRobustly() {
  const selectAttempts = [
    {
      label: "jobs_with_subcategories",
      select: "*, subcategories(name)",
    },
    {
      label: "jobs_only",
      select: "*",
    },
  ];

  const activeFilterAttempts = [true, false];

  let lastError: any = null;

  for (const selectAttempt of selectAttempts) {
    for (const useActiveFilter of activeFilterAttempts) {
      try {
        let query = supabase.from("jobs").select(selectAttempt.select);

        if (useActiveFilter) {
          query = query.eq("is_active", true);
        }

        query = query.order("created_at", { ascending: false });

        const { data, error } = await query;

        if (error) {
          lastError = error;
          console.warn(
            `[loadJobs] Supabase attempt failed: ${selectAttempt.label}, activeFilter=${useActiveFilter}`,
            formatSupabaseError(error),
          );
          continue;
        }

        const rows = Array.isArray(data) ? data : [];

        return rows.filter((row: any) => row?.is_active !== false);
      } catch (error) {
        lastError = error;
        console.warn(
          `[loadJobs] Supabase attempt crashed: ${selectAttempt.label}, activeFilter=${useActiveFilter}`,
          formatSupabaseError(error),
        );
      }
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
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

async function loadJobsFromCache(): Promise<Job[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr.map((row: any) => mapDbToJob(row));
  } catch {
    return [];
  }
}

export const [JobsContext, useJobs] = createContextHook(() => {
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadUserLocation = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_LOCATION_KEY);
      if (!mountedRef.current) return;
      if (stored) setUserLocation(JSON.parse(stored));
    } catch (error) {
      console.error("Failed to load user location:", error);
    }
  }, []);

  const saveUserLocation = useCallback(async (location: UserLocation) => {
    try {
      await AsyncStorage.setItem(USER_LOCATION_KEY, JSON.stringify(location));
      if (!mountedRef.current) return;
      setUserLocation(location);
    } catch (error) {
      console.error("Failed to save user location:", error);
      throw error;
    }
  }, []);

  /**
   * Load jobs from Supabase.
   *
   * Search-ийг Supabase .or дээр хийхгүй, app дотроо filter хийж байна.
   * Учир нь category/subcategory/posted_by_name/address column-ийн аль нэг DB дээр байхгүй байвал
   * Supabase .or query тэр чигээрээ унадаг.
   */
  const loadJobs = useCallback(async (searchText?: string) => {
    const myReqId = ++requestIdRef.current;
    const qRaw = (searchText ?? "").trim();
    const hasQuery = qRaw.length > 0;
    const MAX_RETRY = 3;

    try {
      if (mountedRef.current) setIsLoading(true);

      let rows: any[] = [];

      for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        try {
          rows = await queryJobsRobustly();
          break;
        } catch (err) {
          const isLast = attempt === MAX_RETRY;

          console.warn(
            `[loadJobs] attempt ${attempt}/${MAX_RETRY} failed`,
            formatSupabaseError(err),
          );

          if (isLast) throw err;
          await sleep(300 * attempt);
        }
      }

      if (!mountedRef.current || requestIdRef.current !== myReqId) return;

      const reviewStats = await loadRentalReviewStats(
        rows.map((row: any) => row?.id).filter(isNonEmptyString),
        rows.map((row: any) => row?.posted_by_id).filter(isNonEmptyString),
      );

      let mapped = rows.map((row: any) => mapDbToJob(row, reviewStats));

      if (hasQuery) {
        mapped = mapped.filter((job) => jobMatchesQuery(job, qRaw));
      }

      const sorted = sortJobs(mapped);

      if (!mountedRef.current || requestIdRef.current !== myReqId) return;

      setJobs(sorted);

      if (!hasQuery) {
        await saveJobsToCache(sorted);
      }
    } catch (error) {
      console.error(
        "Failed to load jobs from Supabase:",
        formatSupabaseError(error),
      );

      if (!mountedRef.current || requestIdRef.current !== myReqId) return;

      const cached = await loadJobsFromCache();

      if (!mountedRef.current || requestIdRef.current !== myReqId) return;

      if (cached.length > 0) {
        const filtered = hasQuery
          ? cached.filter((job) => jobMatchesQuery(job, qRaw))
          : cached;

        setJobs(sortJobs(filtered));
      } else if (hasQuery) {
        setJobs([]);
      } else {
        setJobs(sortJobs(MOCK_JOBS));
      }
    } finally {
      if (mountedRef.current && requestIdRef.current === myReqId) {
        setIsLoading(false);
      }
    }
  }, []);

  const searchJobs = useCallback(
    async (text: string) => {
      await loadJobs(text);
    },
    [loadJobs],
  );

  const clearSearch = useCallback(async () => {
    await loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    loadJobs();
    loadUserLocation();
  }, [loadJobs, loadUserLocation]);

  const addJob = useCallback(
    async (
      newJob: Omit<Job, "id" | "postedDate" | "applicants" | "postedBy">,
      userInfo: {
        name: string;
        phone: string;
        photoUri?: string;
        isSponsored?: boolean;
        sponsoredUntil?: Date | string | null;
      },
    ) => {
      try {
        const session = await requireSession();
        const uid = session?.user?.id ?? null;
        if (!uid) throw new Error("Not authenticated. Please login again.");

        const imageUrls = Array.isArray((newJob as any).image_urls)
          ? (newJob as any).image_urls.filter(isNonEmptyString)
          : [];

        const rawCategoryId =
          (newJob as any).category_id ?? (newJob as any).categoryId ?? null;
        const rawSubcategoryId =
          (newJob as any).subcategory_id ??
          (newJob as any).subcategoryId ??
          null;

        const safeCategoryId = isUuidLike(rawCategoryId) ? rawCategoryId : null;
        const safeSubcategoryId = isUuidLike(rawSubcategoryId)
          ? rawSubcategoryId
          : null;

        const safeCategory = isNonEmptyString((newJob as any).category)
          ? (newJob as any).category.trim()
          : null;

        const safeSubcategory = isNonEmptyString((newJob as any).subcategory)
          ? (newJob as any).subcategory.trim()
          : null;

        const payload: any = {
          posted_by_id: uid,

          title: (newJob as any).title,
          description: (newJob as any).description,
          category: safeCategory,
          subcategory: safeSubcategory,
          post_type: (newJob as any).postType ?? "job",

          category_id: safeCategoryId,
          subcategory_id: safeSubcategoryId,

          address:
            (newJob as any).location?.address ??
            (newJob as any).address ??
            null,
          latitude:
            (newJob as any).location?.latitude ??
            (newJob as any).latitude ??
            null,
          longitude:
            (newJob as any).location?.longitude ??
            (newJob as any).longitude ??
            null,

          posted_by_name: userInfo.name,
          posted_by_phone: userInfo.phone,
          posted_by_photo: userInfo.photoUri ?? null,

          is_sponsored: userInfo.isSponsored ?? false,
          sponsored_until: userInfo.sponsoredUntil
            ? new Date(userInfo.sponsoredUntil).toISOString()
            : null,

          image_url: imageUrls[0] ?? (newJob as any).image_url ?? null,
          image_urls: imageUrls,

          item_rating_avg: null,
          item_review_count: 0,
          rental_count: 0,
          bumped_at: null,
          bump_count: 0,

          is_active: true,
        };

        const res = await safeInsertJob(payload);
        if (res.error) throw res.error;

        await loadJobs();

        return mapDbToJob(res.data);
      } catch (error) {
        console.error("Failed to add job:", error);
        throw error;
      }
    },
    [loadJobs],
  );

  const sponsorJob = useCallback(
    async (jobId: string, sponsoredUntil: Date | string | null) => {
      try {
        if (!jobId) {
          throw new Error("Job ID is required");
        }

        const untilIso = sponsoredUntil
          ? new Date(sponsoredUntil).toISOString()
          : null;

        const res = await safeRpc<any>("admin_sponsor_job", {
          p_job_id: jobId,
          p_until: untilIso,
        });

        if ((res as any)?.error) throw (res as any).error;

        const data = (res as any)?.data;
        const row = Array.isArray(data) ? data[0] : data;

        if (!row) {
          throw new Error("0 rows updated");
        }

        await loadJobs();
        return row;
      } catch (error) {
        console.error("Failed to sponsor job:", error);
        throw error;
      }
    },
    [loadJobs],
  );

  const updateJobCategory = useCallback(
    async (jobId: string, newCategory: string) => {
      try {
        const res = await safeUpdateJob(jobId, {
          category: newCategory,
          category_id: null,
        });
        if (res.error) throw res.error;
        await loadJobs();
      } catch (error) {
        console.error("Failed to update job category:", error);
        throw error;
      }
    },
    [loadJobs],
  );

  const deleteJob = useCallback(
    async (jobId: string) => {
      try {
        const existingJob = jobs.find((j: any) => j.id === jobId) as any;
        const storageUrls = normalizeImageUrls(existingJob);

        const res = await safeDeleteJob(jobId);
        if (res.error) throw res.error;

        if (storageUrls.length > 0) {
          await removeStorageImages(storageUrls);
        }

        setJobs((prev) => {
          const next = prev.filter((j: any) => j.id !== jobId);
          saveJobsToCache(next as Job[]);
          return next as any;
        });
      } catch (error) {
        console.error("Failed to delete job:", error);
        throw error;
      }
    },
    [jobs],
  );

  const toggleJobActive = useCallback(
    async (jobId: string, isActive: boolean) => {
      try {
        const res = await safeUpdateJob(jobId, { is_active: isActive });
        if (res.error) throw res.error;

        setJobs((prev) => {
          const next = prev.map((j: any) =>
            j.id === jobId ? { ...j, isActive } : j,
          );
          saveJobsToCache(next as Job[]);
          return next as any;
        });
      } catch (error) {
        console.error("Failed to toggle job active:", error);
        throw error;
      }
    },
    [],
  );

  const bumpJob = useCallback(
    async (jobId: string) => {
      try {
        if (!jobId) throw new Error("Job ID is required");

        const existing = jobs.find((j: any) => j.id === jobId) as any;
        const nowIso = new Date().toISOString();
        const nextCount =
          (asNumberOrNull(existing?.bumpCount ?? existing?.bump_count) ?? 0) +
          1;

        const res = await safeUpdateJob(jobId, {
          bumped_at: nowIso,
          bump_count: nextCount,
          updated_at: nowIso,
        });
        if (res.error) throw res.error;

        await loadJobs();
      } catch (error) {
        console.error("Failed to bump job:", error);
        throw error;
      }
    },
    [jobs, loadJobs],
  );

  const submitRentalReview = useCallback(
    async (params: {
      jobId: string;
      itemRating: number;
      userRating?: number | null;
      comment?: string;
    }) => {
      try {
        const session = await requireSession();
        const reviewerId = session?.user?.id ?? null;
        if (!reviewerId)
          throw new Error("Not authenticated. Please login again.");

        const job = jobs.find((j: any) => j.id === params.jobId) as any;
        const reviewedUserId =
          job?.postedBy?.id ?? job?.posted_by_id ?? job?.postedById ?? null;

        if (!params.jobId) throw new Error("Job ID is required");
        if (!reviewedUserId) throw new Error("Түрээслүүлэгчийн ID олдсонгүй");
        if (reviewerId === reviewedUserId) {
          throw new Error(
            "Өөрийн зар дээр түрээс дуусгах үнэлгээ өгөх боломжгүй",
          );
        }

        const itemRating = Math.max(1, Math.min(5, Number(params.itemRating)));
        const userRating = params.userRating
          ? Math.max(1, Math.min(5, Number(params.userRating)))
          : null;

        const { error } = await supabase.from("rental_reviews").insert({
          job_id: params.jobId,
          reviewer_id: reviewerId,
          reviewed_user_id: reviewedUserId,
          item_rating: itemRating,
          user_rating: userRating,
          comment: params.comment?.trim() || null,
        });

        if (error) throw error;
        await loadJobs();
      } catch (error) {
        console.error("Failed to submit rental review:", error);
        throw error;
      }
    },
    [jobs, loadJobs],
  );

  return {
    jobs,
    addJob,
    sponsorJob,
    updateJobCategory,
    deleteJob,
    toggleJobActive,
    bumpJob,
    submitRentalReview,
    isLoading,
    userLocation,
    saveUserLocation,
    loadJobs,
    searchJobs,
    clearSearch,
  };
});
