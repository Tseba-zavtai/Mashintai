/**
 * Small, schema-agnostic ranking helpers for the Home screen.
 *
 * Keep data ownership in JobsContext/Supabase: this module only receives
 * listings that are already safe to show and returns stable, predictable
 * orderings for the Home rails.
 */

export type HomeFeedKind = 'sponsored' | 'recommended' | 'newest';

export type RecommendationMode =
  | 'personalized'
  | 'popular'
  | 'recent'
  | 'empty';

export interface HomeFeedSection<T> {
  kind: HomeFeedKind;
  items: T[];
  total: number;
  isEmpty: boolean;
  /**
   * Lets the UI use a truthful cold-start message without guessing why the
   * recommendation rail was chosen.
   */
  recommendationMode?: RecommendationMode;
}

export interface HomeFeedOptions<T> {
  /** Number of cards to show in a horizontal rail. Eight is a useful default. */
  limit?: number;
  sponsoredLimit?: number;
  recommendedLimit?: number;
  newestLimit?: number;

  /**
   * A listing can genuinely be both new and recommended. Keep overlap on by
   * default so a sparse launch feed does not look empty; opt in to de-duping
   * only when the product has enough inventory to benefit from it.
   */
  dedupeAcrossSections?: boolean;

  /** Accessors make the helper work with the existing JobsContext shape. */
  getId?: (item: T) => string | number | undefined | null;
  isEligible?: (item: T) => boolean;
  isSponsored?: (item: T) => boolean;
  getCreatedAt?: (item: T) => string | Date | number | null | undefined;
  getUpdatedAt?: (item: T) => string | Date | number | null | undefined;

  /**
   * Return a positive score only when the user has meaningful history for the
   * listing. With no personal signals, the helper automatically falls back to
   * popular listings. With no signals the recommendation section stays empty.
   */
  getPersonalScore?: (item: T) => number | null | undefined;
  getPopularityScore?: (item: T) => number | null | undefined;
}

export interface HomeFeedResult<T> {
  sponsored: HomeFeedSection<T>;
  recommended: HomeFeedSection<T>;
  newest: HomeFeedSection<T>;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' ? (value as UnknownRecord) : {};

const asNumber = (value: unknown): number => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const asTimestamp = (value: string | Date | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const defaultId = <T,>(item: T): string | number | undefined => {
  const record = asRecord(item);
  const id = record.id ?? record.job_id ?? record.jobId;
  return typeof id === 'string' || typeof id === 'number' ? id : undefined;
};

const defaultEligible = <T,>(item: T): boolean => {
  const record = asRecord(item);
  // An explicitly inactive, deleted, expired, or hidden listing never belongs
  // in a customer-facing Home feed. Missing fields remain backward compatible.
  if (record.is_active === false || record.isActive === false) return false;
  if (record.is_deleted === true || record.isDeleted === true) return false;
  if (record.is_expired === true || record.isExpired === true) return false;
  if (record.is_hidden === true || record.isHidden === true) return false;
  return true;
};

const defaultSponsored = <T,>(item: T): boolean => {
  const record = asRecord(item);
  return (
    record.is_sponsored === true ||
    record.isSponsored === true ||
    record.sponsored === true ||
    record.sponsor_status === 'active' ||
    record.sponsorStatus === 'active'
  );
};

const defaultCreatedAt = <T,>(item: T): string | Date | number | null | undefined => {
  const record = asRecord(item);
  const value = record.created_at ?? record.createdAt ?? record.posted_at ?? record.postedAt;
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date
    ? value
    : null;
};

const defaultUpdatedAt = <T,>(item: T): string | Date | number | null | undefined => {
  const record = asRecord(item);
  const value = record.updated_at ?? record.updatedAt ?? record.created_at ?? record.createdAt;
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date
    ? value
    : null;
};

export const defaultPopularityScore = <T,>(item: T): number => {
  const record = asRecord(item);
  // These weights are intentionally conservative. They provide a sensible
  // cold-start fallback until product analytics supplies a tailored score.
  return (
    asNumber(record.search_count ?? record.searchCount) * 4 +
    asNumber(record.view_count ?? record.viewCount ?? record.views) +
    asNumber(record.favorite_count ?? record.favoriteCount ?? record.favorites) * 3 +
    asNumber(record.request_count ?? record.requestCount ?? record.rental_count ?? record.rentalCount) * 5
  );
};

const sortByScoreThenRecent = <T,>(
  items: T[],
  getScore: (item: T) => number,
  getRecent: (item: T) => number,
): T[] =>
  [...items].sort((left, right) => {
    const scoreDifference = getScore(right) - getScore(left);
    if (scoreDifference !== 0) return scoreDifference;
    return getRecent(right) - getRecent(left);
  });

const sortByRecent = <T,>(items: T[], getRecent: (item: T) => number): T[] =>
  [...items].sort((left, right) => getRecent(right) - getRecent(left));

const omitSeen = <T,>(
  items: T[],
  seen: Set<string>,
  getId: (item: T) => string | number | undefined | null,
): T[] =>
  items.filter((item) => {
    const id = getId(item);
    // Records without IDs are still usable in previews; do not discard them.
    return id === undefined ? true : !seen.has(String(id));
  });

const remember = <T,>(items: T[], seen: Set<string>, getId: (item: T) => string | number | undefined | null) => {
  for (const item of items) {
    const id = getId(item);
    if (id !== null && id !== undefined) seen.add(String(id));
  }
};

/**
 * Build the three Home rails in the agreed product order:
 * Sponsored -> Recommended -> Newest.
 *
 * When the account has no meaningful personal behavior yet, `recommended`
 * switches to popular listings. With no real signals it stays empty;
 * sponsorship and recency alone never qualify a recommendation.
 */
export const buildHomeFeed = <T,>(items: readonly T[], options: HomeFeedOptions<T> = {}): HomeFeedResult<T> => {
  const limit = Math.max(1, options.limit ?? 8);
  const sponsoredLimit = Math.max(1, options.sponsoredLimit ?? limit);
  const recommendedLimit = Math.max(1, options.recommendedLimit ?? limit);
  const newestLimit = Math.max(1, options.newestLimit ?? limit);
  const dedupeAcrossSections = options.dedupeAcrossSections ?? false;

  const getId = options.getId ?? defaultId;
  const isEligible = options.isEligible ?? defaultEligible;
  const isSponsored = options.isSponsored ?? defaultSponsored;
  const getCreatedAt = options.getCreatedAt ?? defaultCreatedAt;
  const getUpdatedAt = options.getUpdatedAt ?? defaultUpdatedAt;
  const getPopularityScore = options.getPopularityScore ?? defaultPopularityScore;
  const getPersonalScore = options.getPersonalScore ?? (() => 0);

  const recent = (item: T) => Math.max(asTimestamp(getUpdatedAt(item)), asTimestamp(getCreatedAt(item)));
  const popularity = (item: T) => asNumber(getPopularityScore(item));
  const personal = (item: T) => asNumber(getPersonalScore(item));
  const candidates = items.filter(isEligible);
  const seen = new Set<string>();

  const sponsoredPool = sortByScoreThenRecent(
    candidates.filter(isSponsored),
    popularity,
    recent,
  );
  const sponsoredItems = sponsoredPool.slice(0, sponsoredLimit);
  if (dedupeAcrossSections) remember(sponsoredItems, seen, getId);

  const recommendationCandidates = (dedupeAcrossSections ? omitSeen(candidates, seen, getId) : [...candidates])
    .filter((item) => personal(item) > 0 || popularity(item) > 0);
  const hasPersonalSignals = recommendationCandidates.some((item) => personal(item) > 0);
  const hasPopularitySignals = recommendationCandidates.some((item) => popularity(item) > 0);
  const recommendationMode: RecommendationMode = hasPersonalSignals
    ? 'personalized'
    : hasPopularitySignals
      ? 'popular'
      : 'empty';
  const recommendationSorter = hasPersonalSignals
    ? (source: T[]) => sortByScoreThenRecent(source, (item) => personal(item) * 1000 + popularity(item), recent)
    : hasPopularitySignals
      ? (source: T[]) => sortByScoreThenRecent(source, popularity, recent)
      : (source: T[]) => sortByRecent(source, recent);
  const recommendedItems = recommendationSorter(recommendationCandidates).slice(0, recommendedLimit);
  if (dedupeAcrossSections) remember(recommendedItems, seen, getId);

  const newestCandidates = dedupeAcrossSections ? omitSeen(candidates, seen, getId) : [...candidates];
  const newestItems = sortByRecent(newestCandidates, (item) => asTimestamp(getCreatedAt(item))).slice(0, newestLimit);

  return {
    sponsored: {
      kind: 'sponsored',
      items: sponsoredItems,
      total: sponsoredPool.length,
      isEmpty: sponsoredItems.length === 0,
    },
    recommended: {
      kind: 'recommended',
      items: recommendedItems,
      total: recommendationCandidates.length,
      isEmpty: recommendedItems.length === 0,
      recommendationMode,
    },
    newest: {
      kind: 'newest',
      items: newestItems,
      total: newestCandidates.length,
      isEmpty: newestItems.length === 0,
    },
  };
};

export const HOME_FEED_EMPTY_COPY: Record<HomeFeedKind, string> = {
  sponsored: 'Одоогоор Sponsored зар алга.',
  recommended: 'Зар нэмэгдэхэд танд тохирох сонголтууд энд харагдана.',
  newest: 'Одоогоор шинэ зар алга.',
};

export const HOME_FEED_RECOMMENDATION_COPY: Record<RecommendationMode, string> = {
  personalized: 'Таны хадгалсан заруудтай төстэй сонголтууд',
  popular: 'Одоогоор эрэлттэй байгаа сонголтууд',
  recent: 'Шинэ нэмэгдсэн сонголтууд',
  empty: 'Зар нэмэгдэхэд танд тохирох сонголтууд энд харагдана.',
};
/**
 * Use this for a “Бүгдийг харах” screen. It intentionally returns every
 * eligible item for the requested semantic rail instead of the Home preview
 * limit, while retaining the same safe cold-start recommendation behavior.
 */
export const getAllHomeFeedItems = <T,>(
  items: readonly T[],
  kind: HomeFeedKind,
  options: HomeFeedOptions<T> = {},
): T[] => {
  const fullLimit = Math.max(1, items.length);
  const feeds = buildHomeFeed(items, {
    ...options,
    limit: fullLimit,
    sponsoredLimit: fullLimit,
    recommendedLimit: fullLimit,
    newestLimit: fullLimit,
    dedupeAcrossSections: false,
  });
  return feeds[kind].items;
};
export function savedInterestScorer<T>(items: readonly T[], savedIds: readonly string[] = []) {
  const saved = new Set(savedIds.map(String));
  const categories = new Set<string>();
  const subcategories = new Set<string>();
  const key = (value: unknown) => String(value ?? "").trim().toLowerCase();
  for (const item of items) {
    const row = asRecord(item);
    if (!saved.has(String(row.id))) continue;
    if (key(row.category)) categories.add(key(row.category));
    if (key(row.subcategory)) subcategories.add(key(row.subcategory));
  }
  return (item: T) => {
    const row = asRecord(item);
    return (categories.has(key(row.category)) ? 3 : 0)
      + (subcategories.has(key(row.subcategory)) ? 8 : 0);
  };
}
