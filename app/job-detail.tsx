import {
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  useWindowDimensions,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useJobs } from "@/contexts/JobsContext";
import {
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Images,
} from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

function toSafeDate(value: any): Date {
  if (!value) return new Date();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
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

function RatingStars({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity
          key={n}
          activeOpacity={0.75}
          disabled={disabled}
          onPress={() => onChange(n)}
          style={styles.starButton}
        >
          <Text style={[styles.starText, { opacity: n <= value ? 1 : 0.28 }]}>
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function normalizeImageUrls(job: any): string[] {
  const source = job?.image_urls ?? job?.imageUrls ?? null;

  if (Array.isArray(source)) {
    return source.filter((x) => typeof x === "string" && x.trim().length > 0);
  }

  if (typeof source === "string" && source.trim()) {
    try {
      const parsed = JSON.parse(source);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (x) => typeof x === "string" && x.trim().length > 0,
        );
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

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jobs, submitRentalReview } = useJobs() as any;
  const { user, isAuthenticated } = useAuth() as any;
  const router = useRouter();
  const { colors, currentTheme } = useTheme();
  const { width } = useWindowDimensions();

  const job = useMemo(() => jobs.find((j: any) => j.id === id), [jobs, id]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [itemRating, setItemRating] = useState(5);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  if (!job) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: colors.backgroundSecondary },
        ]}
        edges={["top"]}
      >
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.text }]}>
            Зар олдсонгүй
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.backBtnText, { color: colors.text }]}>
              Буцах
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const postedBy: any = job.postedBy ?? {};
  const posterName = postedBy?.name ?? "Хэрэглэгч";
  const posterPhone = postedBy?.phone ?? "";
  const posterId = postedBy?.phone ?? postedBy?.id ?? "";
  const initial = posterName.charAt(0).toUpperCase() || "?";
  const imageUrls = normalizeImageUrls(job);
  const safePostedDate = toSafeDate(
    (job as any).postedDate ??
      (job as any).created_at ??
      (job as any).updated_at,
  );
  const itemRatingAvg =
    (job as any).itemRatingAvg ?? (job as any).item_rating_avg ?? null;
  const itemReviewCount =
    (job as any).itemReviewCount ?? (job as any).item_review_count ?? 0;
  const rentalCount =
    (job as any).rentalCount ?? (job as any).rental_count ?? itemReviewCount;
  const posterUserRating = postedBy?.userRatingAvg ?? null;
  const posterUserReviewCount = postedBy?.userReviewCount ?? 0;
  const posterRentalCount = postedBy?.rentalCount ?? 0;
  const isOwnJob = !!user?.id && !!postedBy?.id && user.id === postedBy.id;

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Өнөөдөр";
    if (diffInDays === 1) return "Өчигдөр";
    return `${diffInDays} өдрийн өмнө`;
  };

  const handleCallPress = async () => {
    const phoneNumber = posterPhone;
    if (!phoneNumber) {
      Alert.alert("Анхаар", "Утасны дугаар олдсонгүй");
      return;
    }

    let phoneUrl = "";

    if (Platform.OS === "android" || Platform.OS === "ios") {
      phoneUrl = `tel:${phoneNumber}`;
    } else {
      Alert.alert(
        "Анхаар",
        "Утас руу залгах нь зөвхөн гар утсан дээр ажиллана",
      );
      return;
    }

    try {
      const supported = await Linking.canOpenURL(phoneUrl);
      if (supported) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert("Алдаа", "Утас руу залгах боломжгүй байна");
      }
    } catch (error) {
      console.error("Error opening phone dialer:", error);
      Alert.alert("Алдаа", "Утас руу залгах явцад алдаа гарлаа");
    }
  };

  const openReviewModal = () => {
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    if (isOwnJob) {
      Alert.alert("Анхаар", "Өөрийн зар дээр үнэлгээ өгөх боломжгүй");
      return;
    }
    setItemRating(5);
    setUserRating(null);
    setReviewComment("");
    setReviewModalVisible(true);
  };

  const handleSubmitReview = async () => {
    if (reviewSubmitting) return;

    try {
      setReviewSubmitting(true);
      await submitRentalReview?.({
        jobId: job.id,
        itemRating,
        userRating,
        comment: reviewComment,
      });
      setReviewModalVisible(false);
      Alert.alert("Амжилттай", "Түрээс дуусаж, үнэлгээ хадгалагдлаа");
    } catch (e: any) {
      Alert.alert("Алдаа", e?.message ?? "Үнэлгээ хадгалахад алдаа гарлаа");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const activeImage = imageUrls[activeImageIndex] ?? imageUrls[0] ?? null;
  const mainImageHeight = Math.min(Math.max(width * 0.62, 220), 340);

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
            <Text style={[styles.backButton, { color: colors.text }]}>
              ← Буцах
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Зарын дэлгэрэнгүй
          </Text>
        </View>
        <Image
          source={{
            uri:
              currentTheme === "navy"
                ? "https://r2-pub.rork.com/attachments/7h0ju4xu59gyen0tzh8ns"
                : "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/0rqqd3riktgmfxudfl0s8",
          }}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <TouchableOpacity
          style={[styles.posterSection, { backgroundColor: colors.background }]}
          activeOpacity={0.7}
          onPress={() => {
            if (!posterId) return;
            router.push(
              `/user-profile?userId=${encodeURIComponent(String(posterId))}`,
            );
          }}
        >
          {postedBy?.photoUri ? (
            <Image
              source={{ uri: postedBy.photoUri }}
              style={styles.posterAvatar}
            />
          ) : (
            <View
              style={[styles.posterAvatar, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.posterInitial, { color: colors.text }]}>
                {initial}
              </Text>
            </View>
          )}
          <View style={styles.posterInfo}>
            <Text style={[styles.posterName, { color: colors.text }]}>
              {posterName}
            </Text>
            <Text style={[styles.posterPhone, { color: colors.textSecondary }]}>
              {posterPhone || "Утасны дугааргүй"}
            </Text>
          </View>
        </TouchableOpacity>

        <View
          style={[styles.titleSection, { backgroundColor: colors.background }]}
        >
          <Text style={[styles.jobTitle, { color: colors.text }]}>
            {job.title || job.category || "Зар"}
          </Text>
          <View style={styles.badgesRow}>
            <View
              style={[styles.typeBadge, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.typeBadgeText, { color: colors.text }]}>
                {job.postType === "job" ? "Түрээслүүлэх" : "Түрээслэх"}
              </Text>
            </View>

            {(job as any).isSponsored ? (
              <View
                style={[
                  styles.sponsoredBadge,
                  {
                    backgroundColor:
                      currentTheme === "navy" ? "#2A2A2A" : "#FFF5CC",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sponsoredBadgeText,
                    { color: currentTheme === "navy" ? "#F8E75D" : "#8A6500" },
                  ]}
                >
                  Sponsored
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {imageUrls.length > 0 ? (
          <View
            style={[
              styles.imagesSection,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.imageHeaderRow}>
              <View style={styles.imageHeaderLeft}>
                <Images size={18} color={colors.text} />
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.text, marginBottom: 0 },
                  ]}
                >
                  Зураг
                </Text>
              </View>
              <Text
                style={[styles.imageCountText, { color: colors.textSecondary }]}
              >
                {activeImageIndex + 1}/{imageUrls.length}
              </Text>
            </View>

            {activeImage ? (
              <Image
                source={{ uri: activeImage }}
                style={[styles.mainImage, { height: mainImageHeight }]}
                resizeMode="cover"
              />
            ) : null}

            {imageUrls.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailScroll}
              >
                {imageUrls.map((uri, index) => {
                  const selected = index === activeImageIndex;
                  return (
                    <TouchableOpacity
                      key={`${uri}-${index}`}
                      activeOpacity={0.8}
                      onPress={() => setActiveImageIndex(index)}
                      style={[
                        styles.thumbnailWrap,
                        {
                          borderColor: selected
                            ? colors.primary
                            : colors.border,
                          backgroundColor: colors.backgroundSecondary,
                        },
                      ]}
                    >
                      <Image source={{ uri }} style={styles.thumbnailImage} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        <View
          style={[styles.metaSection, { backgroundColor: colors.background }]}
        >
          <View style={styles.metaItem}>
            <Calendar size={16} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {formatDate(safePostedDate)}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Briefcase size={16} color={colors.textSecondary} />
            <Text
              style={[styles.metaTextBold, { color: colors.textSecondary }]}
            >
              {job.category || "Категори"}
            </Text>
            {!!job.subcategory && (
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {" "}
                - {job.subcategory}
              </Text>
            )}
          </View>

          {job.location ? (
            <View style={styles.metaItem}>
              <MapPin size={16} color={colors.textSecondary} />
              <Text
                style={[
                  styles.metaText,
                  { color: colors.textSecondary, flex: 1 },
                ]}
              >
                {job.location?.address || "Байршил сонгосон"}
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={[styles.ratingSection, { backgroundColor: colors.background }]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Үнэлгээ
          </Text>

          <View style={styles.ratingCardsRow}>
            <View
              style={[
                styles.ratingCard,
                { backgroundColor: colors.backgroundSecondary },
              ]}
            >
              <Text style={[styles.ratingNumber, { color: colors.text }]}>
                ★ {formatRating(itemRatingAvg)}
              </Text>
              <Text
                style={[styles.ratingLabel, { color: colors.textSecondary }]}
              >
                Эд зүйл
              </Text>
              <Text style={[styles.ratingSub, { color: colors.textSecondary }]}>
                {itemReviewCount} үнэлгээ · {rentalCount} түрээс
              </Text>
            </View>

            <View
              style={[
                styles.ratingCard,
                { backgroundColor: colors.backgroundSecondary },
              ]}
            >
              <Text style={[styles.ratingNumber, { color: colors.text }]}>
                ★ {formatRating(posterUserRating)}
              </Text>
              <Text
                style={[styles.ratingLabel, { color: colors.textSecondary }]}
              >
                Хэрэглэгч
              </Text>
              <Text style={[styles.ratingSub, { color: colors.textSecondary }]}>
                {posterUserReviewCount} үнэлгээ · {posterRentalCount} түрээс
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.descriptionSection,
            { backgroundColor: colors.background },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Дэлгэрэнгүй мэдээлэл
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {job.description || "-"}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.callButton, { backgroundColor: colors.primary }]}
          onPress={handleCallPress}
          activeOpacity={0.8}
        >
          <Phone size={20} color={colors.text} />
          <Text style={[styles.callButtonText, { color: colors.text }]}>
            {posterPhone ? `Залгах: ${posterPhone}` : "Утасны дугаар алга"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.reviewButton,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              opacity: isOwnJob ? 0.5 : 1,
            },
          ]}
          onPress={openReviewModal}
          activeOpacity={0.8}
          disabled={isOwnJob}
        >
          <Text style={[styles.reviewButtonText, { color: colors.text }]}>
            Түрээс дуусгах / Үнэлгээ өгөх
          </Text>
          <Text
            style={[
              styles.reviewButtonSubText,
              { color: colors.textSecondary },
            ]}
          >
            Эд зүйлийн үнэлгээ заавал, хэрэглэгчийн үнэлгээ сайн дурын
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.reviewModal, { backgroundColor: colors.background }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Түрээс дуусгах
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              Түрээс дууссан гэж тэмдэглэхийн тулд эд зүйлийн үнэлгээ заавал
              өгнө.
            </Text>

            <Text style={[styles.modalLabel, { color: colors.text }]}>
              Эд зүйлийн үнэлгээ *
            </Text>
            <RatingStars
              value={itemRating}
              onChange={setItemRating}
              disabled={reviewSubmitting}
            />

            <Text style={[styles.modalLabel, { color: colors.text }]}>
              Хэрэглэгчийн үнэлгээ (заавал биш)
            </Text>
            <RatingStars
              value={userRating ?? 0}
              onChange={(value) =>
                setUserRating(userRating === value ? null : value)
              }
              disabled={reviewSubmitting}
            />

            <TextInput
              style={[
                styles.commentInput,
                {
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Сэтгэгдэл бичих (заавал биш)"
              placeholderTextColor={colors.textSecondary}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              textAlignVertical="top"
              editable={!reviewSubmitting}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalCancelButton,
                  { borderColor: colors.border },
                ]}
                onPress={() => setReviewModalVisible(false)}
                disabled={reviewSubmitting}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>
                  Болих
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleSubmitReview}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text
                    style={[styles.modalSubmitText, { color: colors.text }]}
                  >
                    Дуусгах
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: "row" as const,
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 8,
    flex: 1,
    paddingRight: 12,
  },
  logo: {
    width: 70,
    height: 32,
  },
  backButton: {
    fontSize: 16,
    fontWeight: "600" as const,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    flexShrink: 1,
  },

  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },

  posterSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  posterAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    backgroundColor: "#EAEAEA",
  },
  posterInitial: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  posterInfo: {
    flex: 1,
  },
  posterName: {
    fontSize: 20,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  posterPhone: {
    fontSize: 14,
  },

  titleSection: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  jobTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  sponsoredBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sponsoredBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  imagesSection: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  imageHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },
  imageHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  imageCountText: {
    fontSize: 13,
    fontWeight: "600",
  },
  mainImage: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#E9E9E9",
    marginBottom: 12,
  },
  thumbnailScroll: {
    paddingRight: 4,
    gap: 8,
  },
  thumbnailWrap: {
    width: 78,
    height: 78,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },

  metaSection: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  metaText: {
    fontSize: 14,
  },
  metaTextBold: {
    fontSize: 14,
    fontWeight: "600" as const,
  },

  descriptionSection: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },

  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  callButtonText: {
    fontSize: 17,
    fontWeight: "700" as const,
  },

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

  ratingSection: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ratingCardsRow: {
    flexDirection: "row",
    gap: 10,
  },
  ratingCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
  },
  ratingNumber: {
    fontSize: 18,
    fontWeight: "800" as const,
    marginBottom: 4,
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  ratingSub: {
    fontSize: 11,
    marginTop: 4,
  },

  reviewButton: {
    marginTop: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    gap: 4,
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: "800" as const,
  },
  reviewButtonSubText: {
    fontSize: 12,
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  reviewModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800" as const,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "700" as const,
    marginTop: 10,
    marginBottom: 6,
  },
  starsRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 6,
  },
  starButton: {
    paddingVertical: 4,
    paddingRight: 7,
  },
  starText: {
    fontSize: 32,
    color: "#FFB800",
  },
  commentInput: {
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginTop: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  modalSubmitButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: "800" as const,
  },

  bottomPadding: {
    height: 20,
  },
});
