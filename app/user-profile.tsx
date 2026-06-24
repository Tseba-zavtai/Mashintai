// app/user-profile.tsx
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { User, ChevronLeft, Star, MessageSquare, X } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useJobs } from "@/contexts/JobsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useMemo, useEffect, useState } from "react";
import { getLogoSource } from "@/constants/logo";
import { supabase } from "@/lib/supabase";

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

  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [ratingUser, setRatingUser] = useState<number>(5);
  const [ratingItem, setRatingItem] = useState<number>(5);
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  const [publicReviews, setPublicReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  
  // 🎯 ШИНЭ: Бүх сэтгэгдлийг харах Modal-ийн төлөв
  const [isReviewsModalVisible, setIsReviewsModalVisible] = useState(false);

  const logoSource = useMemo(() => getLogoSource(currentTheme), [currentTheme]);
  
  const userJobs = useMemo(() => {
    return (jobs as any[]).filter((job: any) => {
      const postedBy = job?.postedBy ?? {};
      return String(postedBy.phone ?? postedBy.id ?? "") === String(userId ?? "");
    });
  }, [jobs, userId]);

  const user = userJobs.length > 0 ? (userJobs[0] as any).postedBy : null;

  const profileStats = useMemo(() => {
    const userRatingAvg = user?.userRatingAvg ?? null;
    const userReviewCount = user?.userReviewCount ?? 0;
    const rentalCount = user?.rentalCount ?? 0;
    return { userRatingAvg, userReviewCount, rentalCount };
  }, [user]);

  const fetchPendingReviews = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("rental_requests")
        .select(`id, status, owner_id, requester_id, jobs (title)`)
        .eq("status", "completed");

      if (error) throw error;

      if (data) {
        const myPending = data.filter((item: any) => item.owner_id === user.id || item.requester_id === user.id);
        setPendingReviews(myPending);
      }
    } catch (e) {
      console.log("Үнэлгээ уншихад алдаа гарлаа:", e);
    }
  };

  const fetchPublicReviews = async () => {
    if (!userId && !user?.id) return;
    const targetId = user?.id || userId;
    try {
      setLoadingReviews(true);
      const { data, error } = await supabase
        .from("rental_reviews")
        .select(`id, user_rating, item_rating, comment, created_at, users!reviewer_id(name, photo_uri)`)
        .eq("reviewed_user_id", targetId)
        .not("comment", "is", null)
        .neq("comment", "")
        .order("created_at", { ascending: false });

      if (error) {
        const { data: fallbackData } = await supabase
          .from("rental_reviews")
          .select('*')
          .eq("reviewed_user_id", targetId)
          .not("comment", "is", null)
          .neq("comment", "")
          .order("created_at", { ascending: false });
        setPublicReviews(fallbackData || []);
      } else {
        setPublicReviews(data || []);
      }
    } catch (e) {
      console.log("Fetch public reviews error:", e);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchPendingReviews();
    fetchPublicReviews();
  }, [user?.id, userId]);

  const handleSubmitReview = async (requestItem: any) => {
    try {
      setSubmittingReview(true);
      const isCurrentOwner = user.id === requestItem.owner_id;

      const { error } = await supabase
        .from("rental_reviews")
        .insert({
          request_id: requestItem.id,
          reviewer_id: user.id, 
          reviewee_id: isCurrentOwner ? requestItem.requester_id : requestItem.owner_id,
          user_rating: ratingUser,
          item_rating: isCurrentOwner ? null : ratingItem, 
        });

      if (error) throw error;

      Alert.alert("Баярлалаа", "Таны үнэлгээ амжилттай хадгалагдлаа.");
      setPendingReviews(prev => prev.filter(p => p.id !== requestItem.id));
      fetchPublicReviews(); 
    } catch (e: any) {
      Alert.alert("Алдаа", e.message || "Үнэлгээ илгээхэд алдаа гарлаа");
    } finally {
      setSubmittingReview(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const now = new Date();
    const safeDate = date instanceof Date ? date : new Date(date as any);
    const diffInMs = now.getTime() - safeDate.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Өнөөдөр";
    if (diffInDays === 1) return "Өчигдөр";
    return `${diffInDays} өдрийн өмнө`;
  };

  // 🎯 ШИНЭ: Зөвхөн эхний 3 сэтгэгдлийг тасдаж авах
  const visibleReviews = publicReviews.slice(0, 3);

  // 🎯 ШИНЭ: Сэтгэгдэл зурах жижиг компонент
  const renderReviewItem = (r: any) => {
    const reviewerName = r.users?.name || r.reviewer?.name || "Хэрэглэгч";
    const reviewerPhoto = r.users?.photo_uri || r.reviewer?.photo_uri || null;
    const rating = r.user_rating || r.item_rating || 5;
    const date = new Date(r.created_at).toLocaleDateString();

    return (
      <View key={r.id} style={[styles.reviewCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.reviewHeader}>
          <View style={[styles.reviewAvatar, { backgroundColor: colors.backgroundSecondary }]}>
            {reviewerPhoto ? (
              <Image source={{ uri: reviewerPhoto }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <User size={18} color={colors.textSecondary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.reviewerName, { color: colors.text }]}>{reviewerName}</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>{date}</Text>
          </View>
          <View style={styles.reviewStars}>
            <Star size={14} fill="#FFB800" color="#FFB800" />
            <Text style={[styles.reviewRatingText, { color: colors.text }]}>{rating.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={[styles.reviewComment, { color: colors.text }]}>{r.comment}</Text>
      </View>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["top"]}>
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Хэрэглэгч олдсонгүй эсвэл зар нь устгагдсан байна.</Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.backBtnText, { color: colors.headerText }]}>Буцах</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ padding: 4 }}>
            <ChevronLeft size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Профайл</Text>
        </View>
        <Image source={logoSource} style={styles.logo} resizeMode="contain" />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.profileCard, { backgroundColor: colors.background }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            {user.photoUri ? (
              <Image source={{ uri: user.photoUri }} style={styles.avatarImage} />
            ) : (
              <User size={40} color={colors.headerText} strokeWidth={2} />
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>{user.name || "Хэрэглэгч"}</Text>
            <Text style={[styles.profilePhone, { color: colors.textSecondary }]}>{user.phone}</Text>
            <Text style={[styles.profileRating, { color: colors.text }]}>★ {formatRating(profileStats.userRatingAvg)} · {profileStats.userReviewCount} үнэлгээ</Text>
            <Text style={[styles.profileSubRating, { color: colors.textSecondary }]}>{profileStats.rentalCount} удаа түрээслүүлсэн</Text>
          </View>
        </View>

        {pendingReviews.length > 0 && (
          <View style={[styles.reviewBox, { backgroundColor: colors.background, borderColor: colors.primary }]}>
            <Text style={[styles.reviewTitle, { color: colors.text }]}>📣 Түрээсийн үнэлгээ дутуу байна!</Text>
            <Text style={[styles.reviewSub, { color: colors.textSecondary }]}>Захиалга: {pendingReviews[0]?.jobs?.title || "Түрээсийн бараа"}</Text>
            <Text style={[styles.ratingLabel, { color: colors.text }]}>Хэрэглэгчийн харилцааг үнэлэх:</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRatingUser(star)}>
                  <Text style={[styles.starText, { color: star <= ratingUser ? "#FFD700" : colors.border }]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>

            {user.id !== pendingReviews[0]?.owner_id && (
              <>
                <Text style={[styles.ratingLabel, { color: colors.text }]}>Эд зүйлсийн чанарыг үнэлэх:</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setRatingItem(star)}>
                      <Text style={[styles.starText, { color: star <= ratingItem ? "#FFD700" : colors.border }]}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <TouchableOpacity style={[styles.submitReviewBtn, { backgroundColor: colors.primary }]} onPress={() => handleSubmitReview(pendingReviews[0])} disabled={submittingReview}>
              {submittingReview ? <ActivityIndicator color={colors.headerText} size="small" /> : <Text style={[styles.submitReviewBtnText, { color: colors.headerText }]}>Үнэлгээ илгээх</Text>}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>★ {formatRating(profileStats.userRatingAvg)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Хэрэглэгчийн үнэлгээ</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>{profileStats.rentalCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Нийт түрээслүүлсэн</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Хэрэглэгчдийн сэтгэгдэл</Text>
          {loadingReviews ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
          ) : publicReviews.length === 0 ? (
            <View style={[styles.emptyReviewBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <MessageSquare size={32} color={colors.textSecondary} style={{ marginBottom: 10 }} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>Одоогоор сэтгэгдэл байхгүй байна</Text>
            </View>
          ) : (
            <View style={{ marginHorizontal: 20, gap: 12 }}>
              {/* ЗӨВХӨН ЭХНИЙ 3-ИЙГ ЗУРНА */}
              {visibleReviews.map(renderReviewItem)}

              {/* 3-ААС ОЛОН БАЙВАЛ "БҮГДИЙГ ХАРАХ" ТОВЧ ГАРЧ ИРНЭ */}
              {publicReviews.length > 3 && (
                <TouchableOpacity 
                  style={[styles.seeAllBtn, { borderColor: colors.border }]} 
                  onPress={() => setIsReviewsModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.seeAllBtnText, { color: colors.text }]}>Бүх {publicReviews.length} сэтгэгдлийг харах</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Нийтэлсэн зарууд</Text>
          {userJobs.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.background }]}>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>Зар байхгүй байна</Text>
            </View>
          ) : (
            userJobs.map((job: any) => (
              <TouchableOpacity key={job.id} style={[styles.jobCard, { backgroundColor: colors.background }]} activeOpacity={0.7} onPress={() => router.push(`/job-detail?id=${job.id}`)}>
                <View style={styles.jobHeader}>
                  <Text style={[styles.jobTitle, { color: colors.text }]}>{job.title || job.category || "Зар"}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: colors.primary }]}><Text style={[styles.typeBadgeText, { color: colors.headerText }]}>{job.postType === "job" ? "Түрээслүүлэх" : "Түрээслэх"}</Text></View>
                </View>
                <Text style={[styles.jobDescription, { color: colors.textSecondary }]} numberOfLines={2}>{job.description}</Text>
                <Text style={[styles.jobRatingText, { color: colors.textSecondary }]}>★ {formatRating(job.itemRatingAvg ?? job.item_rating_avg)} эд зүйл · {job.rentalCount ?? job.rental_count ?? 0} түрээс</Text>
                <Text style={[styles.jobDate, { color: colors.textSecondary }]}>{formatDate(job.postedDate ?? job.created_at ?? job.updated_at)}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* 🎯 ШИНЭ: БҮХ СЭТГЭГДЛИЙГ ХАРАХ БҮТЭН ДЭЛГЭЦ (MODAL) */}
      <Modal visible={isReviewsModalVisible} animationType="slide" onRequestClose={() => setIsReviewsModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <TouchableOpacity onPress={() => setIsReviewsModalVisible(false)} style={{ padding: 4 }}>
              <ChevronLeft size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Бүх сэтгэгдэл ({publicReviews.length})</Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            {publicReviews.map(renderReviewItem)}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 70, height: 32 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  content: { flex: 1 },
  contentContainer: { paddingTop: 20 },
  profileCard: { marginHorizontal: 20, borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "center", marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, gap: 16 },
  avatar: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: 70, height: 70 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  profilePhone: { fontSize: 14 },
  profileRating: { marginTop: 8, fontSize: 15, fontWeight: "800" },
  profileSubRating: { marginTop: 3, fontSize: 12, fontWeight: "600" },
  reviewBox: { marginHorizontal: 20, borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 16 },
  reviewTitle: { fontSize: 15, fontWeight: "800", marginBottom: 4 },
  reviewSub: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  ratingLabel: { fontSize: 13, fontWeight: "700", marginTop: 6 },
  starsRow: { flexDirection: "row", gap: 4, marginBottom: 8, marginTop: 2 },
  starText: { fontSize: 28, fontWeight: "bold" },
  submitReviewBtn: { height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 12 },
  submitReviewBtnText: { fontSize: 14, fontWeight: "800" },
  statsContainer: { flexDirection: "row", marginHorizontal: 20, gap: 12, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 16, padding: 18, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statNumber: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  statLabel: { fontSize: 12, textAlign: "center" },

  emptyReviewBox: { marginHorizontal: 20, padding: 24, borderRadius: 16, borderWidth: 1, alignItems: "center" },
  reviewCard: { padding: 16, borderRadius: 16, borderWidth: 1 },
  reviewHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  reviewerName: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  reviewStars: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewRatingText: { fontSize: 14, fontWeight: "800" },
  reviewComment: { fontSize: 14, lineHeight: 20 },
  
  seeAllBtn: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 4 },
  seeAllBtnText: { fontSize: 14, fontWeight: "700" },

  section: { marginBottom: 24, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginLeft: 20, marginBottom: 12 },
  emptyState: { marginHorizontal: 20, borderRadius: 16, padding: 40, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  emptyStateText: { fontSize: 16 },
  jobCard: { marginHorizontal: 20, marginBottom: 12, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  jobHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  jobTitle: { fontSize: 16, fontWeight: "700", flex: 1, marginRight: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: "600" },
  jobDescription: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  jobRatingText: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
  jobDate: { fontSize: 12 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  notFoundText: { fontSize: 18, fontWeight: "600", marginBottom: 20 },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { fontSize: 16, fontWeight: "600" },
  bottomPadding: { height: 20 },
  
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
});