import React, { useCallback, useEffect, useMemo, useState } from "react";
import {

  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Sparkles, Tag, Clock3 } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AppHeader from "@/components/AppHeader";
import BannerCarousel, { type Banner } from "@/components/BannerCarousel";
import ListingGridCard from "@/components/ListingGridCard";
import SkeletonCard from "@/components/SkeletonCard";
import { useJobs } from "@/contexts/JobsContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  buildHomeFeed,
  defaultPopularityScore,
  savedInterestScorer,
  HOME_FEED_RECOMMENDATION_COPY,
  type HomeFeedKind,
} from "@/lib/homeFeed";
import { fetchBanners } from "@/lib/banners";

type ListingMode = HomeFeedKind;

type FeedRow =
  | { type: "listings"; key: string; jobs: any[] }
  | { type: "banner"; key: string };

const MODE_COPY: Record<ListingMode, {
  title: string;
  heading: string;
  emptyTitle: string;
  emptyText: string;
  Icon: typeof Tag;
}> = {
  sponsored: {
    title: "Sponsored зарууд",
    heading: "Sponsored зарууд",
    emptyTitle: "Одоогоор Sponsored зар алга",
    emptyText: "Төлбөртэйгээр онцолсон зар нэмэгдэхэд энэ хэсэгт хамгийн түрүүнд харагдана.",
    Icon: Sparkles,
  },
  recommended: {
    title: "Танд санал болгох",
    heading: "Танд санал болгох",
    emptyTitle: "Одоогоор санал болгох зар алга",
    emptyText: "Хадгалалт, эрэлтийн мэдээлэлтэй зарууд бүрдэхэд энд харагдана.",
    Icon: Sparkles,
  },
  newest: {
    title: "Шинэ зарууд",
    heading: "Шинэ зарууд",
    emptyTitle: "Одоогоор шинэ зар алга",
    emptyText: "Шинэ зар нийтлэгдмэгц энэ хэсэгт шууд харагдана.",
    Icon: Clock3,
  },
};

function resolveMode(value: string | string[] | undefined): ListingMode {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "sponsored" || candidate === "recommended" || candidate === "newest") return candidate;
  return "newest";
}

function toTimestamp(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  return 0;
}

function isCurrentSponsored(job: any): boolean {
  const sponsored = Boolean(job?.isSponsored ?? job?.is_sponsored);
  if (!sponsored) return false;

  const untilTimestamp = toTimestamp(job?.sponsoredUntil ?? job?.sponsored_until);
  // Only a valid paid period belongs in the sponsored section.
  return untilTimestamp > Date.now();
}

function isVisibleListing(job: any): boolean {
  if (job?.isActive === false || job?.is_active === false) return false;
  if (job?.isDeleted === true || job?.is_deleted === true) return false;
  if (job?.isExpired === true || job?.is_expired === true) return false;
  if (job?.isHidden === true || job?.is_hidden === true) return false;

  const available = Number(job?.available_quantity ?? job?.availableQuantity ?? job?.quantity ?? 1);
  return !Number.isFinite(available) || available > 0;
}

function listingTimestamp(job: any): string | Date | number | null {
  return job?.postedDate ?? job?.created_at ?? job?.createdAt ?? job?.updated_at ?? job?.updatedAt ?? null;
}

function popularityScore(job: any): number {
  return defaultPopularityScore(job);
}

function createFeedRows(jobs: any[], showBanners: boolean): FeedRow[] {
  const rows: FeedRow[] = [];

  for (let index = 0; index < jobs.length; index += 2) {
    const rowJobs = jobs.slice(index, index + 2);
    const visibleCount = index + rowJobs.length;
    rows.push({
      type: "listings",
      key: `listing-row-${rowJobs.map((job) => job?.id ?? index).join("-")}`,
      jobs: rowJobs,
    });

    // Twelve cards = six complete rows. A banner belongs immediately after the
    // 12th card, not after an arbitrary number of pixels or after the next row.
    if (showBanners && visibleCount >= 12 && visibleCount % 12 === 0) {
      rows.push({ type: "banner", key: `listing-banner-after-${visibleCount}` });
    }
  }

  return rows;
}

export default function ListingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const mode = resolveMode(params.mode);
  const copy = MODE_COPY[mode];
  const { colors } = useTheme();
  const { jobs, loadJobs, isLoading, savedJobIds, toggleSaveJob } = useJobs() as any;
  const jobCount = Array.isArray(jobs) ? jobs.length : 0;
  const [banners, setBanners] = useState<Banner[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadBanners = useCallback(async () => {
    try {
      setBanners(await fetchBanners("home_feed"));
    } catch {
      setBanners([]);
    }
  }, []);

  useEffect(() => {
    void loadBanners();
    if (jobCount === 0) void loadJobs().catch(() => {});
  }, [jobCount, loadBanners, loadJobs]);

  const feed = useMemo(() => {
    const source = Array.isArray(jobs) ? jobs : [];

    return buildHomeFeed(source, {
      // A full listing route intentionally has no rail cap. The exact same
      // ranking rules are used as Home, but every matching job is retained.
      limit: Math.max(source.length, 1),
      dedupeAcrossSections: false,
      getId: (job: any) => job?.id,
      isEligible: isVisibleListing,
      isSponsored: isCurrentSponsored,
      getCreatedAt: listingTimestamp,
      getUpdatedAt: (job: any) => listingTimestamp(job),
      getPopularityScore: popularityScore,
      getPersonalScore: savedInterestScorer(source, savedJobIds),
    });
  }, [jobs, savedJobIds]);

  const section = feed[mode];
  const rows = useMemo(
    () => createFeedRows(section.items as any[], banners.length > 0),
    [section.items, banners.length],
  );

  const recommendationSubtitle = mode === "recommended"
    ? HOME_FEED_RECOMMENDATION_COPY[section.recommendationMode ?? "empty"]
    : mode === "sponsored"
      ? "Төлбөртэйгээр онцолсон зарууд"
      : "Хамгийн сүүлд нийтлэгдсэн зарууд";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadJobs(), loadBanners()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadBanners, loadJobs]);

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.sectionHeadingRow}>
        <Text style={[styles.heading, { color: colors.text }]}>{copy.heading}</Text>
        {!isLoading ? <Text style={[styles.count, { color: colors.textSecondary }]}>{section.total}</Text> : null}
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{recommendationSubtitle}</Text>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.loadingRows}>
      {[0, 1, 2].map((row) => (
        <View key={`listing-skeleton-${row}`} style={styles.gridRow}>
          <SkeletonCard compact />
          <SkeletonCard compact />
        </View>
      ))}
    </View>
  );

  const renderEmpty = () => {
    const Icon = copy.Icon;
    return (
      <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
          <Icon size={27} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{copy.emptyTitle}</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{copy.emptyText}</Text>
        <TouchableOpacity
          style={[styles.backToHomeButton, { borderColor: colors.border }]}
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)" as any)}
          activeOpacity={0.78}
        >
          <Text style={[styles.backToHomeText, { color: colors.primary }]}>Нүүр хуудас руу буцах</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={copy.title} />

      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.type === "banner") {
            return banners.length > 0 ? (
              <View style={styles.bannerWrap}>
                <BannerCarousel banners={banners} />
              </View>
            ) : null;
          }

          return (
            <View style={styles.gridRow}>
              {item.jobs.map((job) => (
                <ListingGridCard
                  key={String(job?.id ?? "listing")}
                  job={job}
                  isSaved={Array.isArray(savedJobIds) && savedJobIds.includes(job?.id)}
                  onToggleSave={toggleSaveJob}
                />
              ))}
              {item.jobs.length === 1 ? <View style={styles.gridSpacer} /> : null}
            </View>
          );
        }}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={isLoading ? renderLoading : renderEmpty}
        ListFooterComponent={<View style={styles.footer} />}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        removeClippedSubviews={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingTop: 16 },
  listHeader: { paddingHorizontal: 20, paddingBottom: 16 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  heading: { flex: 1, fontSize: 20, fontWeight: "800" },
  count: { fontSize: 14, fontWeight: "700" },
  subtitle: { marginTop: 5, fontSize: 13, lineHeight: 18 },
  gridRow: { flexDirection: "row", alignItems: "stretch", gap: 12, paddingHorizontal: 20, marginBottom: 12 },
  gridSpacer: { flex: 1, minWidth: 0 },
  bannerWrap: { marginHorizontal: 20, marginBottom: 12 },
  loadingRows: { paddingTop: 2 },
  emptyCard: { marginHorizontal: 20, minHeight: 250, borderRadius: 18, paddingHorizontal: 24, paddingVertical: 28, alignItems: "center", justifyContent: "center" },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 14, fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyText: { marginTop: 7, fontSize: 14, lineHeight: 20, textAlign: "center" },
  backToHomeButton: { marginTop: 20, minHeight: 44, justifyContent: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 16 },
  backToHomeText: { fontSize: 14, fontWeight: "800" },
  footer: { height: 30 },
});
