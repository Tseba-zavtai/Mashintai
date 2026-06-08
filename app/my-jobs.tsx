// app/my-jobs.tsx
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  MapPin,
  Clock,
  Briefcase,
  BadgeDollarSign,
  Trash2,
  PauseCircle,
  PlayCircle,
  Eye,
  EyeOff,
  Images,
  TrendingUp,
} from "lucide-react-native";
import { PostType } from "@/mocks/jobs";
import { useTheme } from "@/contexts/ThemeContext";

function isNonEmptyString(value: any): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeImageUrls(job: any): string[] {
  const source = job?.image_urls ?? job?.imageUrls ?? null;

  if (Array.isArray(source)) {
    return source.filter(isNonEmptyString);
  }

  if (typeof source === "string" && source.trim()) {
    try {
      const parsed = JSON.parse(source);
      if (Array.isArray(parsed)) {
        return parsed.filter(isNonEmptyString);
      }
    } catch {
      return [source];
    }
  }

  const fallback = job?.image_url ?? job?.imageUrl ?? null;
  if (typeof fallback === "string" && fallback.trim()) {
    return [fallback];
  }

  return [];
}

function toSafeDate(value: any): Date {
  if (!value) return new Date();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function getSponsoredUntilDate(job: any): Date | null {
  const raw = job?.sponsoredUntil ?? job?.sponsored_until ?? null;
  if (!raw) return null;

  const d = toSafeDate(raw);
  if (Number.isNaN(d.getTime())) return null;

  return d;
}

function isJobSponsoredNow(job: any, nowTs = Date.now()): boolean {
  const sponsoredUntil = getSponsoredUntilDate(job);
  if (sponsoredUntil) {
    return sponsoredUntil.getTime() > nowTs;
  }
  return Boolean(job?.isSponsored || job?.is_sponsored);
}

function getSponsoredUntilText(job: any, nowTs = Date.now()): string | null {
  const d = getSponsoredUntilDate(job);
  if (!d) return null;
  if (d.getTime() <= nowTs) return null;
  return d.toLocaleString();
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "0 хоног 00:00:00";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return `${days} хоног ${hh}:${mm}:${ss}`;
}

function getSponsoredCountdownText(
  job: any,
  nowTs = Date.now(),
): string | null {
  const d = getSponsoredUntilDate(job);
  if (!d) return null;

  const diff = d.getTime() - nowTs;
  if (diff <= 0) return null;

  return formatCountdown(diff);
}

function asNumberOrNull(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatRating(value: any) {
  const n = asNumberOrNull(value);
  return n == null ? "Шинэ" : n.toFixed(1);
}

function getBumpedAtText(job: any): string | null {
  const raw = job?.bumpedAt ?? job?.bumped_at ?? null;
  if (!raw) return null;
  const d = toSafeDate(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

function getJobAddress(job: any): string | null {
  const location = job?.location;
  if (typeof location === "string" && location.trim()) return location;
  if (typeof location?.address === "string" && location.address.trim()) {
    return location.address;
  }
  if (typeof job?.address === "string" && job.address.trim())
    return job.address;
  return null;
}

export default function MyJobsScreen() {
  const router = useRouter();
  const { jobs, deleteJob, toggleJobActive, bumpJob } = useJobs() as any;
  const { user } = useAuth();
  const { colors, currentTheme } = useTheme();
  const params = useLocalSearchParams<{ type?: string }>();

  const [selectedTab, setSelectedTab] = useState<PostType>("worker");
  const [showInactive, setShowInactive] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());

  const buttonTextColor = currentTheme === "navy" ? "#F8E75D" : "#1A1A1A";
  const buttonBackgroundColor =
    currentTheme === "navy" ? "#2A2A2A" : colors.primary;

  useEffect(() => {
    if (params.type === "job" || params.type === "worker") {
      setSelectedTab(params.type);
    }
  }, [params.type]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const myJobsRaw = useMemo(() => {
    return (jobs as any[]).filter((job: any) => {
      if (job?.postType !== selectedTab && job?.post_type !== selectedTab)
        return false;
      if (!user) return false;

      const jobPhone = job?.postedBy?.phone ?? job?.posted_by_phone ?? null;
      const jobUserId = job?.postedBy?.id ?? job?.posted_by_id ?? null;

      return jobPhone === user.phone || jobUserId === user.id;
    });
  }, [jobs, selectedTab, user]);

  const myJobs = useMemo(() => {
    return myJobsRaw.filter((job: any) =>
      showInactive ? true : (job?.isActive ?? job?.is_active ?? true) === true,
    );
  }, [myJobsRaw, showInactive]);

  const formatDate = useCallback((date: Date) => {
    const safeDate = toSafeDate(date);
    const now = new Date();
    const diff = Math.floor(
      (now.getTime() - safeDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diff <= 0) return "Өнөөдөр";
    if (diff === 1) return "Өчигдөр";
    if (diff < 7) return `${diff} хоногийн өмнө`;
    if (diff < 30) return `${Math.floor(diff / 7)} долоо хоногийн өмнө`;
    return `${Math.floor(diff / 30)} сарын өмнө`;
  }, []);

  const confirmDelete = useCallback(
    (jobId: string) => {
      Alert.alert(
        "Устгах уу?",
        "Та энэ зараа устгах гэж байна. Storage дээрх зургууд бас устна.",
        [
          { text: "Болих", style: "cancel" },
          {
            text: "Устгах",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteJob(jobId);
              } catch (e: any) {
                Alert.alert("Алдаа", e?.message ?? "Устгахад алдаа гарлаа");
              }
            },
          },
        ],
      );
    },
    [deleteJob],
  );

  const confirmDeactivate = useCallback(
    (jobId: string) => {
      Alert.alert(
        "Идэвхигүй болгох уу?",
        "Энэ зар Home дээр харагдахгүй болно.",
        [
          { text: "Болих", style: "cancel" },
          {
            text: "Идэвхигүй болгох",
            onPress: async () => {
              try {
                await toggleJobActive(jobId, false);
              } catch (e: any) {
                Alert.alert(
                  "Алдаа",
                  e?.message ?? "Идэвхигүй болгоход алдаа гарлаа",
                );
              }
            },
          },
        ],
      );
    },
    [toggleJobActive],
  );

  const activate = useCallback(
    async (jobId: string) => {
      try {
        await toggleJobActive(jobId, true);
      } catch (e: any) {
        Alert.alert("Алдаа", e?.message ?? "Идэвхжүүлэхэд алдаа гарлаа");
      }
    },
    [toggleJobActive],
  );

  const openJobDetail = useCallback(
    (jobId: string) => {
      router.push(`/job-detail?id=${jobId}`);
    },
    [router],
  );

  const confirmBump = useCallback(
    (job: any) => {
      const rating = asNumberOrNull(job?.itemRatingAvg ?? job?.item_rating_avg);
      const warning =
        rating != null && rating < 3
          ? "\n\nАнхаар: Энэ эд зүйлийн үнэлгээ 3.0-аас доош байна. Дээш гаргасан ч хэрэглэгчид таны үнэлгээг харна."
          : "";

      Alert.alert(
        "Зараа дээш гаргах",
        `Энэ зар шинэ заруудын дунд дахин дээш гарна.${warning}`,
        [
          { text: "Болих", style: "cancel" },
          {
            text: "Дээш гаргах",
            onPress: async () => {
              try {
                await bumpJob?.(job.id);
              } catch (e: any) {
                Alert.alert(
                  "Алдаа",
                  e?.message ?? "Зар дээш гаргахад алдаа гарлаа",
                );
              }
            },
          },
        ],
      );
    },
    [bumpJob],
  );

  const openSponsorPayment = useCallback(
    (jobId: string) => {
      router.push({
        pathname: "/sponsor-payment",
        params: { jobId },
      });
    },
    [router],
  );

  const openSponsorPaymentWithWarning = useCallback(
    (job: any) => {
      const rating = asNumberOrNull(job?.itemRatingAvg ?? job?.item_rating_avg);

      if (rating != null && rating < 3) {
        Alert.alert(
          "Анхааруулга",
          "Энэ эд зүйлийн үнэлгээ 3.0-аас доош байна. Sponsored болгосноор илүү олон хүнд харагдах боловч хэрэглэгчид таны үнэлгээг мөн харна. Үргэлжлүүлэх үү?",
          [
            { text: "Болих", style: "cancel" },
            { text: "Үргэлжлүүлэх", onPress: () => openSponsorPayment(job.id) },
          ],
        );
        return;
      }

      openSponsorPayment(job.id);
    },
    [openSponsorPayment],
  );

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: colors.backgroundSecondary },
      ]}
      edges={["top"]}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Миний зарууд",
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: "700" as const,
            color: colors.text,
          },
          headerShadowVisible: false,
        }}
      />

      <View
        style={[styles.tabsContainer, { backgroundColor: colors.background }]}
      >
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === "worker" && {
              ...styles.tabActive,
              backgroundColor: buttonBackgroundColor,
            },
          ]}
          onPress={() => setSelectedTab("worker")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  selectedTab === "worker"
                    ? buttonTextColor
                    : colors.textSecondary,
              },
            ]}
          >
            Түрээслэх зар
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === "job" && {
              ...styles.tabActive,
              backgroundColor: buttonBackgroundColor,
            },
          ]}
          onPress={() => setSelectedTab("job")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  selectedTab === "job"
                    ? buttonTextColor
                    : colors.textSecondary,
              },
            ]}
          >
            Түрээслүүлэх зар
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.toolsRow, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.toolButton, { borderColor: colors.border }]}
          activeOpacity={0.7}
          onPress={() => setShowInactive((v) => !v)}
        >
          {showInactive ? (
            <EyeOff size={18} color={colors.text} />
          ) : (
            <Eye size={18} color={colors.text} />
          )}
          <Text style={[styles.toolButtonText, { color: colors.text }]}>
            {showInactive ? "Идэвхгүйг нуух" : "Идэвхгүйг харуулах"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {myJobs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Briefcase
              size={64}
              color={colors.textSecondary}
              strokeWidth={1.5}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {selectedTab === "worker"
                ? "Түрээслэх зар байхгүй"
                : "Түрээслүүлэх зар байхгүй"}
            </Text>
          </View>
        ) : (
          myJobs.map((job: any) => {
            const active = job?.isActive ?? job?.is_active ?? true;
            const imageUrls = normalizeImageUrls(job);
            const postedDate = toSafeDate(
              job?.postedDate ?? job?.created_at ?? job?.updated_at,
            );
            const address = getJobAddress(job);
            const sponsored = isJobSponsoredNow(job, nowTs);
            const sponsoredUntilText = getSponsoredUntilText(job, nowTs);
            const sponsoredCountdownText = getSponsoredCountdownText(
              job,
              nowTs,
            );
            const itemRatingAvg =
              job?.itemRatingAvg ?? job?.item_rating_avg ?? null;
            const itemReviewCount =
              job?.itemReviewCount ?? job?.item_review_count ?? 0;
            const rentalCount =
              job?.rentalCount ?? job?.rental_count ?? itemReviewCount;
            const bumpedAtText = getBumpedAtText(job);

            return (
              <TouchableOpacity
                key={job.id}
                style={[styles.jobCard, { backgroundColor: colors.background }]}
                activeOpacity={0.7}
                onPress={() => openJobDetail(job.id)}
              >
                <View style={styles.jobHeader}>
                  <Text
                    style={[styles.jobTitle, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {job.title || job.category || "Зар"}
                  </Text>

                  <View style={styles.badgesCol}>
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: colors.backgroundSecondary },
                      ]}
                    >
                      <Text
                        style={[styles.categoryText, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {job.category || "Категори"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: active
                            ? "rgba(0,180,90,0.12)"
                            : "rgba(200,50,50,0.12)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: active ? "#00B45A" : "#C83232" },
                        ]}
                      >
                        {active ? "Идэвхтэй" : "Идэвхгүй"}
                      </Text>
                    </View>
                  </View>
                </View>

                {!!job.subcategory && (
                  <Text
                    style={[
                      styles.subcategoryText,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {job.subcategory}
                  </Text>
                )}

                <View style={styles.ratingInfoBox}>
                  <Text
                    style={[
                      styles.ratingInfoText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    ★ {formatRating(itemRatingAvg)} эд зүйл · {itemReviewCount}{" "}
                    үнэлгээ · {rentalCount} түрээс
                  </Text>
                  {bumpedAtText ? (
                    <Text
                      style={[
                        styles.bumpedText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Сүүлд дээш гаргасан: {bumpedAtText}
                    </Text>
                  ) : null}
                </View>

                {job.description ? (
                  <Text
                    style={[
                      styles.jobDescription,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={2}
                  >
                    {job.description}
                  </Text>
                ) : null}

                {imageUrls.length > 0 ? (
                  <View style={styles.imagesSection}>
                    <View style={styles.imagesLabelRow}>
                      <Images size={16} color={colors.textSecondary} />
                      <Text
                        style={[
                          styles.imagesLabelText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {imageUrls.length} зураг
                      </Text>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.imageScrollContent}
                    >
                      {imageUrls.slice(0, 5).map((uri, index) => (
                        <Image
                          key={`${job.id}-img-${index}`}
                          source={{ uri }}
                          style={styles.previewImage}
                        />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                <View style={styles.jobFooter}>
                  {address ? (
                    <View style={styles.jobInfo}>
                      <MapPin size={14} color={colors.textSecondary} />
                      <Text
                        style={[
                          styles.jobInfoText,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {address}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.jobInfo}>
                    <Clock size={14} color={colors.textSecondary} />
                    <Text
                      style={[
                        styles.jobInfoText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatDate(postedDate)}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: colors.border }]}
                    activeOpacity={0.7}
                    onPress={(e) => {
                      e.stopPropagation();
                      confirmDelete(job.id);
                    }}
                  >
                    <Trash2 size={18} color={colors.text} />
                    <Text style={[styles.actionText, { color: colors.text }]}>
                      Устгах
                    </Text>
                  </TouchableOpacity>

                  {active ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: colors.border }]}
                      activeOpacity={0.7}
                      onPress={(e) => {
                        e.stopPropagation();
                        confirmDeactivate(job.id);
                      }}
                    >
                      <PauseCircle size={18} color={colors.text} />
                      <Text style={[styles.actionText, { color: colors.text }]}>
                        Идэвхигүй
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: colors.border }]}
                      activeOpacity={0.7}
                      onPress={(e) => {
                        e.stopPropagation();
                        activate(job.id);
                      }}
                    >
                      <PlayCircle size={18} color={colors.text} />
                      <Text style={[styles.actionText, { color: colors.text }]}>
                        Идэвхжүүлэх
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.bumpButton, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                  onPress={(e) => {
                    e.stopPropagation();
                    confirmBump(job);
                  }}
                >
                  <TrendingUp size={18} color={colors.text} />
                  <Text style={[styles.bumpButtonText, { color: colors.text }]}>
                    Зараа дээш гаргах
                  </Text>
                </TouchableOpacity>

                {sponsored ? (
                  <View
                    style={[
                      styles.sponsoredBadgeWrapper,
                      {
                        backgroundColor:
                          currentTheme === "navy"
                            ? "rgba(248,231,93,0.12)"
                            : "rgba(0,0,0,0.04)",
                        borderColor:
                          currentTheme === "navy"
                            ? "rgba(248,231,93,0.25)"
                            : "rgba(0,0,0,0.08)",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.sponsoredBadge,
                        { backgroundColor: buttonBackgroundColor },
                      ]}
                    >
                      <BadgeDollarSign
                        size={18}
                        color={buttonTextColor}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.sponsoredBadgeText,
                          { color: buttonTextColor },
                        ]}
                      >
                        Sponsored зар
                      </Text>
                    </View>

                    {sponsoredCountdownText ? (
                      <Text
                        style={[
                          styles.sponsoredCountdownText,
                          { color: colors.text },
                        ]}
                      >
                        Үлдсэн: {sponsoredCountdownText}
                      </Text>
                    ) : null}

                    {sponsoredUntilText ? (
                      <Text
                        style={[
                          styles.sponsoredUntilText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Дуусах: {sponsoredUntilText}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.sponsorButton,
                      { backgroundColor: buttonBackgroundColor },
                    ]}
                    activeOpacity={0.7}
                    onPress={(e) => {
                      e.stopPropagation();
                      openSponsorPaymentWithWarning(job);
                    }}
                  >
                    <BadgeDollarSign
                      size={18}
                      color={buttonTextColor}
                      strokeWidth={2}
                    />
                    <Text
                      style={[
                        styles.sponsorButtonText,
                        { color: buttonTextColor },
                      ]}
                    >
                      Sponsored зар болгох
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  tabsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {},
  tabText: { fontSize: 14, fontWeight: "600" as const },

  toolsRow: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 12,
    padding: 10,
  },
  toolButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  toolButtonText: { fontSize: 13, fontWeight: "600" as const },

  content: { flex: 1 },
  contentContainer: { paddingTop: 16, paddingHorizontal: 20 },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: { fontSize: 16, marginTop: 16 },

  jobCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  jobHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 12,
  },
  jobTitle: { flex: 1, fontSize: 18, fontWeight: "700" as const },

  badgesCol: { gap: 8, alignItems: "flex-end", maxWidth: "45%" },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: "100%",
  },
  categoryText: { fontSize: 12, fontWeight: "600" as const },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontSize: 12, fontWeight: "700" as const },

  subcategoryText: {
    fontSize: 13,
    marginBottom: 8,
    fontWeight: "600" as const,
  },

  ratingInfoBox: {
    marginBottom: 10,
    gap: 4,
  },
  ratingInfoText: {
    fontSize: 12,
    fontWeight: "700" as const,
  },
  bumpedText: {
    fontSize: 11,
  },

  jobDescription: { fontSize: 14, lineHeight: 20, marginBottom: 12 },

  imagesSection: {
    marginBottom: 12,
  },
  imagesLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  imagesLabelText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  imageScrollContent: {
    paddingRight: 4,
    gap: 8,
  },
  previewImage: {
    width: 120,
    height: 90,
    borderRadius: 12,
    backgroundColor: "#E9E9E9",
  },

  jobFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  jobInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
  },
  jobInfoText: { fontSize: 13, flexShrink: 1 },

  actionsRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionText: { fontSize: 14, fontWeight: "600" as const },

  bumpButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  bumpButtonText: { fontSize: 14, fontWeight: "700" as const },

  sponsorButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  sponsorButtonText: { fontSize: 14, fontWeight: "600" as const },

  sponsoredBadgeWrapper: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  sponsoredBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  sponsoredBadgeText: { fontSize: 14, fontWeight: "600" as const },
  sponsoredCountdownText: {
    fontSize: 15,
    textAlign: "center",
    fontWeight: "800" as const,
  },
  sponsoredUntilText: {
    fontSize: 12,
    textAlign: "center",
    fontWeight: "500" as const,
  },

  bottomPadding: { height: 20 },
});
