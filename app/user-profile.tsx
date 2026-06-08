// app/user-profile.tsx
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { User, ChevronLeft } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useJobs } from "@/contexts/JobsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";
import { getLogoSource } from "@/constants/logo";

function asNumberOrNull(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatRating(value: any) {
  const n = asNumberOrNull(value);
  return n == null ? "Шинэ" : n.toFixed(1);
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { jobs } = useJobs();
  const { colors, currentTheme } = useTheme();

  const logoSource = useMemo(() => getLogoSource(currentTheme), [currentTheme]);

  const userJobs = useMemo(() => {
    return (jobs as any[]).filter((job: any) => {
      const postedBy = job?.postedBy ?? {};
      return (
        String(postedBy.phone ?? postedBy.id ?? "") === String(userId ?? "")
      );
    });
  }, [jobs, userId]);

  const user = userJobs.length > 0 ? (userJobs[0] as any).postedBy : null;

  const workerJobs = useMemo(() => {
    return userJobs.filter(
      (job: any) => job.postType === "worker" || job.post_type === "worker",
    );
  }, [userJobs]);

  const employerJobs = useMemo(() => {
    return userJobs.filter(
      (job: any) => job.postType === "job" || job.post_type === "job",
    );
  }, [userJobs]);

  const profileStats = useMemo(() => {
    const userRatingAvg = user?.userRatingAvg ?? null;
    const userReviewCount = user?.userReviewCount ?? 0;
    const rentalCount = user?.rentalCount ?? 0;

    const itemReviewCount = userJobs.reduce(
      (sum: number, job: any) =>
        sum +
        (Number(job?.itemReviewCount ?? job?.item_review_count ?? 0) || 0),
      0,
    );

    return {
      userRatingAvg,
      userReviewCount,
      rentalCount,
      itemReviewCount,
    };
  }, [user, userJobs]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const safeDate = date instanceof Date ? date : new Date(date as any);
    const diffInMs = now.getTime() - safeDate.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Өнөөдөр";
    if (diffInDays === 1) return "Өчигдөр";
    return `${diffInDays} өдрийн өмнө`;
  };

  if (!user) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: colors.backgroundSecondary },
        ]}
        edges={["top"]}
      >
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
            Хэрэглэгч олдсонгүй
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.backBtnText, { color: colors.text }]}>
              Буцах
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: colors.backgroundSecondary },
      ]}
      edges={["top"]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Профайл
          </Text>
        </View>

        <Image source={logoSource} style={styles.logo} resizeMode="contain" />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View
          style={[styles.profileCard, { backgroundColor: colors.background }]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            {user.photoUri ? (
              <Image
                source={{ uri: user.photoUri }}
                style={styles.avatarImage}
              />
            ) : (
              <User size={40} color={colors.text} strokeWidth={2} />
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {user.name || "Хэрэглэгч"}
            </Text>
            <Text
              style={[styles.profilePhone, { color: colors.textSecondary }]}
            >
              {user.phone}
            </Text>
            <Text style={[styles.profileRating, { color: colors.text }]}>
              ★ {formatRating(profileStats.userRatingAvg)} ·{" "}
              {profileStats.userReviewCount} үнэлгээ
            </Text>
            <Text
              style={[styles.profileSubRating, { color: colors.textSecondary }]}
            >
              {profileStats.rentalCount} удаа түрээслүүлсэн
            </Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View
            style={[styles.statCard, { backgroundColor: colors.background }]}
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {workerJobs.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Түрээслэх зар
            </Text>
          </View>

          <View
            style={[styles.statCard, { backgroundColor: colors.background }]}
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {employerJobs.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Түрээслүүлэх зар
            </Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View
            style={[styles.statCard, { backgroundColor: colors.background }]}
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>
              ★ {formatRating(profileStats.userRatingAvg)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Хэрэглэгчийн үнэлгээ
            </Text>
          </View>

          <View
            style={[styles.statCard, { backgroundColor: colors.background }]}
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {profileStats.rentalCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Нийт түрээс
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Нийтэлсэн зарууд
          </Text>

          {userJobs.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: colors.background },
              ]}
            >
              <Text
                style={[styles.emptyStateText, { color: colors.textSecondary }]}
              >
                Зар байхгүй байна
              </Text>
            </View>
          ) : (
            userJobs.map((job: any) => (
              <TouchableOpacity
                key={job.id}
                style={[styles.jobCard, { backgroundColor: colors.background }]}
                activeOpacity={0.7}
                onPress={() => router.push(`/job-detail?id=${job.id}`)}
              >
                <View style={styles.jobHeader}>
                  <Text style={[styles.jobTitle, { color: colors.text }]}>
                    {job.title || job.category || "Зар"}
                  </Text>
                  <View
                    style={[
                      styles.typeBadge,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text
                      style={[styles.typeBadgeText, { color: colors.text }]}
                    >
                      {job.postType === "job" ? "Түрээслүүлэх" : "Түрээслэх"}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.jobDescription,
                    { color: colors.textSecondary },
                  ]}
                  numberOfLines={2}
                >
                  {job.description}
                </Text>

                <Text
                  style={[
                    styles.jobRatingText,
                    { color: colors.textSecondary },
                  ]}
                >
                  ★ {formatRating(job.itemRatingAvg ?? job.item_rating_avg)} эд
                  зүйл · {job.rentalCount ?? job.rental_count ?? 0} түрээс
                </Text>

                <Text style={[styles.jobDate, { color: colors.textSecondary }]}>
                  {formatDate(
                    job.postedDate ?? job.created_at ?? job.updated_at,
                  )}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: { width: 70, height: 32 },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
  },
  content: { flex: 1 },
  contentContainer: { paddingTop: 20 },
  profileCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 70, height: 70 },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 20,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  profilePhone: { fontSize: 14 },
  profileRating: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "800" as const,
  },
  profileSubRating: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600" as const,
  },
  statsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "800" as const,
    marginBottom: 4,
  },
  statLabel: { fontSize: 12, textAlign: "center" },
  section: { marginBottom: 24, marginTop: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    marginLeft: 20,
    marginBottom: 12,
  },
  emptyState: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyStateText: { fontSize: 16 },
  jobCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    flex: 1,
    marginRight: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  jobDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  jobRatingText: {
    fontSize: 12,
    fontWeight: "700" as const,
    marginBottom: 6,
  },
  jobDate: { fontSize: 12 },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  notFoundText: {
    fontSize: 18,
    fontWeight: "600" as const,
    marginBottom: 20,
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  bottomPadding: { height: 20 },
});
