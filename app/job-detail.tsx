// app/job-detail.tsx
import {
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
  ActivityIndicator,
  Share,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useJobs } from "@/contexts/JobsContext";
import * as ExpoLinking from "expo-linking";
import {
  Phone,
  MapPin,
  Calendar as CalendarIcon,
  Briefcase,
  Images,
  Star,
  Tag,
  Layers,
  Minus,
  Plus,
  CheckSquare,
  Square,
  Share2,
  Settings2,
} from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { isSponsoredPromotionActive, recordPromotionMetric } from "@/lib/promotionMetrics";
import {
  calculateRentalInsurancePremium,
  RENTAL_INSURANCE_RATE_PERCENT,
} from "@/lib/rentalInsurance";
import DateTimePicker from "@react-native-community/datetimepicker";
import AppHeader from "@/components/AppHeader"; 

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

function formatRatingValue(value: any, count: any) {
  const ratingCount = Number(count ?? 0);
  const n = asNumberOrNull(value);
  if (!ratingCount || n == null) {
    return "Үнэлгээ байхгүй";
  }
  return `★ ${n.toFixed(1)}`;
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
        return parsed.filter((x) => typeof x === "string" && x.trim().length > 0);
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

type PriceType = "hourly" | "daily" | "monthly";

function normalizePriceType(value: unknown): PriceType {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "hourly" || normalized === "Цагийн") return "hourly";
  if (normalized === "monthly" || normalized === "Сарын") return "monthly";
  if (normalized === "daily" || normalized === "Өдрийн") return "daily";
  return "daily";
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
export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jobs } = useJobs() as any;
  const { user, isAuthenticated } = useAuth() as any;
  const router = useRouter();
  const { colors, currentTheme } = useTheme();
  const { width } = useWindowDimensions();
  const job = useMemo(() => jobs.find((j: any) => j.id === id), [jobs, id]);
  const viewedSponsoredJobIdsRef = useRef<Set<string>>(new Set());
  const isSponsoredJobView = isSponsoredPromotionActive(job);

  useEffect(() => {
    const jobId = String(job?.id ?? "").trim();
    if (!jobId || !isSponsoredJobView || viewedSponsoredJobIdsRef.current.has(jobId)) return;

    viewedSponsoredJobIdsRef.current.add(jobId);
    void recordPromotionMetric("sponsored_job", jobId, "impression");
  }, [job?.id, isSponsoredJobView]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [rentModalVisible, setRentModalVisible] = useState(false);
  const [insuranceModalVisible, setInsuranceModalVisible] = useState(false);
  const [rentQuantity, setRentQuantity] = useState(1);
  const [rentSubmitting, setRentSubmitting] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 86400000));
  const [hasTime, setHasTime] = useState(false);
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const buttonTextColor = colors.buttonText;
  const dynamicData = normalizeDynamicData((job as any)?.dynamic_data ?? (job as any)?.dynamicData);
  const priceType = normalizePriceType((job as any)?.price_type ?? (job as any)?.priceType);
  const priceTypeLabel = priceType === "hourly" ? "цаг" : priceType === "monthly" ? "сар" : "өдөр";

  const calculatedDuration = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (hasTime) {
      start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
      end.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
    }

    const diffMs = end.getTime() - start.getTime();
    if (priceType === "hourly") return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));

    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    return priceType === "monthly" ? Math.max(1, Math.ceil(days / 30)) : days;
  }, [startDate, endDate, hasTime, startTime, endTime, priceType]);
  
  if (!job) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["bottom"]}>
          <AppHeader title="Зарын дэлгэрэнгүй" />
          <View style={styles.notFound}>
            <Text style={[styles.notFoundText, { color: colors.text }]}>Зар олдсонгүй</Text>
            <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
              <Text style={[styles.backBtnText, { color: buttonTextColor }]}>Буцах</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const postedBy: any = job.postedBy ?? {};
  const posterName = postedBy?.name ?? "Хэрэглэгч";
  const posterPhone = postedBy?.phone ?? "";
  const posterId = postedBy?.phone ?? postedBy?.id ?? "";
  const initial = posterName.charAt(0).toUpperCase() || "?";
  const imageUrls = normalizeImageUrls(job);
  const safePostedDate = toSafeDate((job as any).postedDate ?? (job as any).created_at ?? (job as any).updated_at);
  const itemRatingAvg = (job as any).itemRatingAvg ?? (job as any).item_rating_avg ?? null;
  const itemReviewCount = (job as any).itemReviewCount ?? (job as any).item_review_count ?? 0;
  const rentalCount = (job as any).rentalCount ?? (job as any).rental_count ?? itemReviewCount;
  const availableQuantity = Number((job as any).available_quantity ?? (job as any).availableQuantity ?? (job as any).quantity ?? 1);
  const jobPrice = Number(job.price || 0);
  const isOwnJob = !!user?.id && !!postedBy?.id && user.id === postedBy.id;
  

  
  const formatDateLabel = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  
  const formatTimeLabel = (date: Date) => {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };
  
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
    if (!phoneNumber) { Alert.alert("Анхаар", "Утасны дугаар олдсонгүй"); return; }
    let phoneUrl = "";
    if (Platform.OS === "android" || Platform.OS === "ios") { phoneUrl = `tel:${phoneNumber}`; } 
    else { Alert.alert("Анхаар", "Утас руу залгах нь зөвхөн гар утсан дээр ажиллана"); return; }

    try {
      const supported = await Linking.canOpenURL(phoneUrl);
      if (supported) await Linking.openURL(phoneUrl);
      else Alert.alert("Алдаа", "Утас руу залгах боломжгүй байна");
    } catch { Alert.alert("Алдаа", "Утас руу залгах явцад алдаа гарлаа"); }
  };

  const handleSharePress = async () => {
    try {
      const priceText = jobPrice > 0 ? `${jobPrice.toLocaleString()} ₮ / ${priceTypeLabel}` : "Үнэ тохиролцоно";
      const titleText = job.title || job.subcategory || job.category || "Зар";
      const deepLink = ExpoLinking.createURL(`/job-detail`, { queryParams: { id: job.id } });
      const shareMessage = `Tureesly дээрх энэ зарыг сонирхоод үзээрэй!\n\n🔹 ${titleText}\n💰 Үнэ: ${priceText}\n\n👇 Яг одоо энд дарж дэлгэрэнгүйг харна уу:\n${deepLink}`;
      await Share.share({ 
        message: shareMessage, 
        title: "Tureesly - Түрээсийн нэгдсэн платформ" 
      });
    } catch (error) { console.log("Share error:", error); }
  };
  
  const openRentModal = () => {
    if (!isAuthenticated) { router.push("/auth"); return; }
    if (isOwnJob) { Alert.alert("Анхаар", "Өөрийн зарыг түрээслэх боломжгүй"); return; }
    if (Number.isFinite(availableQuantity) && availableQuantity <= 0) { Alert.alert("Анхаар", "Энэ зар одоогоор боломжгүй байна"); return; }
    setRentQuantity(1); 
    setStartDate(new Date());
    setEndDate(new Date(Date.now() + 86400000));
    setHasTime(false);
    setAgreeTerms(false); 
    setRentModalVisible(true);
  };
  
  const handleRentSubmit = () => {
    if (!agreeTerms) { Alert.alert("Анхаар", "Та хариуцлагын санамжтай танилцаж, хүлээн зөвшөөрөх ёстой."); return; }
    if (rentSubmitting) return;
    const rentalStart = new Date(startDate);
    const rentalEnd = new Date(endDate);
    if (hasTime) {
      rentalStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
      rentalEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    } else {
      rentalStart.setHours(0, 0, 0, 0);
      rentalEnd.setHours(0, 0, 0, 0);
    }
    if (rentalEnd <= rentalStart) { Alert.alert("Анхаар", "Дуусах огноо эхлэх огнооноос хойш байх ёстой."); return; }

    setRentModalVisible(false);
    setInsuranceModalVisible(true);
  };

  const submitRentalRequest = async (withInsurance: boolean) => {
    const computedTotalPrice = jobPrice * rentQuantity * calculatedDuration;
    const insurancePremium = calculateRentalInsurancePremium(computedTotalPrice);
    if (withInsurance && insurancePremium <= 0) {
      Alert.alert("Анхаар", "Даатгалын дүн тооцоологдсонгүй. Түрээсийн үнийг шалгана уу.");
      return;
    }

    try {
      setRentSubmitting(true);
      const requesterId = user?.id;
      if (!requesterId) throw new Error("Нэвтэрсэн хэрэглэгч олдсонгүй");

      const { data: existingRequests, error: existingRequestError } = await supabase
        .from("rental_requests")
        .select("id")
        .eq("job_id", job.id)
        .eq("requester_id", requesterId)
        .eq("status", "pending")
        .limit(1);
      if (existingRequestError) throw existingRequestError;
      if ((existingRequests ?? []).length > 0) {
        throw new Error("Та энэ зарт хүлээгдэж буй хүсэлт илгээсэн байна.");
      }

      const { data: requestData, error: requestError } = await supabase
        .from("rental_requests")
        .insert([
          {
            job_id: job.id,
            requester_id: requesterId,
            owner_id: postedBy?.id,
            quantity: rentQuantity,
            rent_days: calculatedDuration,
            total_price: computedTotalPrice,
            status: "pending",
            message: "Түрээслэх хүсэлт илгээлээ",
            start_date: formatDateLabel(startDate),
            end_date: formatDateLabel(endDate),
            has_time: hasTime,
            start_time: hasTime ? formatTimeLabel(startTime) : null,
            end_time: hasTime ? formatTimeLabel(endTime) : null,
            requester_name: user?.name,
            requester_phone: user?.phone,
            requester_photo: user?.photoUri,
            insurance_status: withInsurance ? "not_requested" : "requester_declined",
            insurance_premium: insurancePremium || null,
            insurance_rate_percent: RENTAL_INSURANCE_RATE_PERCENT,
          }
        ])
        .select()
        .single();

      if (requestError) throw requestError;

      if (requestData && withInsurance) {
        const { error: insuranceError } = await supabase.rpc("prepare_rental_insurance_demo_payment", {
          p_request_id: requestData.id,
          p_premium: insurancePremium,
          p_rate_percent: RENTAL_INSURANCE_RATE_PERCENT,
        });
        if (insuranceError) {
          await supabase
            .from("rental_requests")
            .delete()
            .eq("id", requestData.id)
            .eq("requester_id", requesterId)
            .eq("status", "pending");
          throw insuranceError;
        }

        setInsuranceModalVisible(false);
        router.push({
          pathname: "/insurance-payment",
          params: {
            requestId: requestData.id,
            flow: "requester",
            premium: String(insurancePremium),
            title: String(job.title || job.subcategory || job.category || "Зар"),
          },
        });
        return;
      }

      if (requestData) {
        const { error: inAppNotificationError } = await supabase.from("notifications").insert([
          {
            user_id: postedBy?.id,
            title: "Шинэ түрээсийн хүсэлт",
            content: `${user?.name || "Хэрэглэгч"} таны ${job.title || "бараа"}-г түрээслэх хүсэлт илгээлээ.`,
            is_read: false,
            type: "rental_request",
            reference_id: requestData.id
          }
        ]);
        if (inAppNotificationError) {
          console.log("IN-APP NOTIFICATION ERROR:", inAppNotificationError);
        }

        const { error: pushNotificationError } = await supabase.functions.invoke(
          "send-rental-request-push",
          { body: { rentalRequestId: requestData.id } },
        );

        if (pushNotificationError) {
          console.log("PUSH NOTIFICATION ERROR:", pushNotificationError);
        }
      }

      setInsuranceModalVisible(false);
      Alert.alert("Амжилттай", "Түрээслэх хүсэлт илгээгдлээ. Зарын эзэн зөвшөөрөх үед танд мэдэгдэл очино.", [{ text: "ОК", onPress: () => router.replace("/(tabs)") }]);
    } catch (e: any) { Alert.alert("Алдаа", e?.message ?? "Түрээслэх хүсэлт илгээхөд алдаа гарлаа"); } finally { setRentSubmitting(false); }
  };

  const activeImage = imageUrls[activeImageIndex] ?? imageUrls[0] ?? null;
  const mainImageHeight = Math.min(Math.max(width * 0.62, 220), 340);
  const totalPrice = jobPrice * rentQuantity * calculatedDuration;
  const insurancePremiumForDisplay = calculateRentalInsurancePremium(totalPrice);
  
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["bottom"]}>
        
        <AppHeader title="Зарын дэлгэрэнгүй" />

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
          <TouchableOpacity style={[styles.posterSection, { backgroundColor: colors.background }]} activeOpacity={0.7} onPress={() => { if (!posterId) return; router.push(`/user-profile?userId=${encodeURIComponent(String(posterId))}`); }}>
            {postedBy?.photoUri ? (
              <Image source={{ uri: postedBy.photoUri }} style={styles.posterAvatar} contentFit="cover" transition={200} />
            ) : (
              <View style={[styles.posterAvatar, { backgroundColor: colors.primary }]}><Text style={[styles.posterInitial, { color: colors.buttonText }]}>{initial}</Text></View>
            )}
            <View style={styles.posterInfo}>
              <Text style={[styles.posterName, { color: colors.text }]}>{posterName}</Text>
              <Text style={[styles.posterPhone, { color: colors.textSecondary }]}>{posterPhone || "Утасны дугааргүй"}</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.titleSection, { backgroundColor: colors.background }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={[styles.jobTitle, { color: colors.text, flex: 1, paddingRight: 10 }]}>{job.title || job.subcategory || job.category || "Зар"}</Text>
              <TouchableOpacity onPress={handleSharePress} style={[styles.shareIconWrap, { backgroundColor: colors.backgroundSecondary }]} activeOpacity={0.7}><Share2 size={22} color={colors.text} /></TouchableOpacity>
            </View>
            <View style={styles.priceContainer}>
              <Tag size={20} color="#6E0AB0" />
              <Text style={[styles.jobPrice, { color: "#6E0AB0" }]}>
                {jobPrice > 0 ? `${jobPrice.toLocaleString()} ₮` : "Үнэ тохиролцоно"}
                {jobPrice > 0 && <Text style={[styles.priceUnit, { color: "#6E0AB0" }]}> / {priceTypeLabel}</Text>}
              </Text>
            </View>
            <View style={styles.badgesRow}>
              {job.isSponsored ? (<View style={[styles.sponsoredBadge, { backgroundColor: currentTheme === "navy" ? "#2A2A2A" : "#FFF5CC" }]}><Text style={[styles.sponsoredBadgeText, { color: currentTheme === "navy" ? "#F8E75D" : "#8A6500" }]}>Sponsored</Text></View>) : null}
            </View>
          </View>

          {imageUrls.length > 0 ? (
            <View style={[styles.imagesSection, { backgroundColor: colors.background }]}>
              <View style={styles.imageHeaderRow}>
                <View style={styles.imageHeaderLeft}>
                  <Images size={18} color={colors.text} />
                  <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Зураг</Text>
                </View>
                <Text style={[styles.imageCountText, { color: colors.textSecondary }]}>{activeImageIndex + 1}/{imageUrls.length}</Text>
              </View>
              {activeImage ? (
                <Image source={{ uri: activeImage }} style={[styles.mainImage, { height: mainImageHeight }]} contentFit="cover" transition={300} />
              ) : null}
              {imageUrls.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailScroll}>
                  {imageUrls.map((uri, index) => {
                    const selected = index === activeImageIndex;
                    return (
                      <TouchableOpacity key={`${uri}-${index}`} activeOpacity={0.8} onPress={() => setActiveImageIndex(index)} style={[styles.thumbnailWrap, { borderColor: selected ? colors.primary : colors.border, backgroundColor: colors.backgroundSecondary }]}>
                        <Image source={{ uri }} style={styles.thumbnailImage} contentFit="cover" transition={200} />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.metaSection, { backgroundColor: colors.background }]}>
            <View style={styles.metaItem}><CalendarIcon size={16} color={colors.textSecondary} /><Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatDate(safePostedDate)}</Text></View>
            <View style={styles.metaItem}><Briefcase size={16} color={colors.textSecondary} /><Text style={[styles.metaTextBold, { color: colors.textSecondary }]}>{job.category || "Категори"}</Text>{!!job.subcategory && <Text style={[styles.metaText, { color: colors.textSecondary }]}> - {job.subcategory}</Text>}</View>
            <View style={styles.metaItem}><Layers size={16} color={colors.textSecondary} /><Text style={[styles.metaText, { color: colors.textSecondary }]}>Боломжит тоо ширхэг: <Text style={styles.metaTextBold}>{availableQuantity}</Text></Text></View>
            {job.location ? (<View style={styles.metaItem}><MapPin size={16} color={colors.textSecondary} /><Text style={[styles.metaText, { color: colors.textSecondary, flex: 1 }]}>{job.location?.address || "Байршил сонгосон"}</Text></View>) : null}
          </View>

          {Object.keys(dynamicData).length > 0 && (
            <View style={[styles.descriptionSection, { backgroundColor: colors.background }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Settings2 size={18} color={colors.text} />
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Нэмэлт үзүүлэлтүүд</Text>
              </View>
              <View style={styles.dynamicDataGrid}>
                {Object.entries(dynamicData).map(([key, value]) => {
                  if (value === "" || value == null) return null;
                  return (
                    <View key={key} style={[styles.dynamicDataRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.dynamicDataKey, { color: colors.textSecondary }]}>{key}</Text>
                      <Text style={[styles.dynamicDataValue, { color: colors.text }]}>{String(value)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View style={[styles.ratingSection, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Үнэлгээ</Text>
            <View style={styles.ratingRows}>
              <View style={styles.ratingLine}>
                <View style={styles.ratingLineLeft}>
                  <Star size={17} color={colors.text} fill="none" />
                  <View style={styles.ratingLineTextWrap}>
                    <Text style={[styles.ratingLineTitle, { color: colors.text }]}>Хэрэглэгчдийн үнэлгээ</Text>
                    <Text style={[styles.ratingLineSub, { color: colors.textSecondary }]}>{itemReviewCount} үнэлгээ · {rentalCount} түрээслэлт</Text>
                  </View>
                </View>
                <Text style={[styles.ratingLineValue, { color: colors.text }]}>{formatRatingValue(itemRatingAvg, itemReviewCount)}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.descriptionSection, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Дэлгэрэнгүй мэдээлэл</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{job.description || "-"}</Text>
          </View>

          <TouchableOpacity style={[styles.callButton, { backgroundColor: colors.primary }]} onPress={handleCallPress} activeOpacity={0.8}>
            <Phone size={20} color={buttonTextColor} />
            <Text style={[styles.callButtonText, { color: buttonTextColor }]}>{posterPhone ? `Залгах: ${posterPhone}` : "Утасны дугаар алга"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.reviewButton, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: isOwnJob ? 0.55 : 1 }]} onPress={openRentModal} activeOpacity={0.8} disabled={isOwnJob}>
            <Text style={[styles.reviewButtonText, { color: buttonTextColor }]}>Түрээслэх</Text>
            <Text style={[styles.reviewButtonSubText, { color: buttonTextColor, opacity: 0.8 }]}>Түрээслэх хугацаа болон тоог сонгох</Text>
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </ScrollView>

        <Modal visible={rentModalVisible} transparent animationType="slide" onRequestClose={() => setRentModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.reviewModal, { backgroundColor: colors.background }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Түрээсийн мэдээлэл</Text>
              <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>Та энэхүү барааг хэдэн хугацаагаар, хэдэн ширхэгийг түрээслэхээ сонгоно уу.</Text>

              <View style={styles.counterRow}>
                <View style={styles.counterLabelWrap}><Layers size={18} color={colors.text} /><Text style={[styles.counterLabel, { color: colors.text }]}>Тоо ширхэг</Text></View>
                <View style={styles.counterControls}>
                  <TouchableOpacity style={[styles.counterBtn, { backgroundColor: colors.backgroundSecondary }]} onPress={() => setRentQuantity(Math.max(1, rentQuantity - 1))}><Minus size={18} color={colors.text} /></TouchableOpacity>
                  <Text style={[styles.counterValue, { color: colors.text }]}>{rentQuantity}</Text>
                  <TouchableOpacity style={[styles.counterBtn, { backgroundColor: colors.backgroundSecondary }]} onPress={() => setRentQuantity(Math.min(availableQuantity, rentQuantity + 1))}><Plus size={18} color={colors.text} /></TouchableOpacity>
                </View>
              </View>

              <View style={styles.dateInputSection}>
                <View style={styles.dateField}>
                  <Text style={[styles.dateFieldLabel, { color: colors.textSecondary }]}>Эхлэх өдөр</Text>
                  <TouchableOpacity 
                    style={[styles.datePickerSelector, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => setShowStartPicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.text, fontSize: 14 }}>{formatDateLabel(startDate)}</Text>
                  </TouchableOpacity>
                  {showStartPicker && (
                    <DateTimePicker
                      value={startDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      minimumDate={new Date()}
                      onChange={(event, selectedDate) => {
                        setShowStartPicker(Platform.OS === 'ios');
                        if (selectedDate) setStartDate(selectedDate);
                      }}
                    />
                  )}
                </View>

                <View style={styles.dateField}>
                  <Text style={[styles.dateFieldLabel, { color: colors.textSecondary }]}>Дуусах өдөр</Text>
                  <TouchableOpacity 
                    style={[styles.datePickerSelector, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => setShowEndPicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.text, fontSize: 14 }}>{formatDateLabel(endDate)}</Text>
                  </TouchableOpacity>
                  {showEndPicker && (
                    <DateTimePicker
                      value={endDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      minimumDate={startDate}
                      onChange={(event, selectedDate) => {
                        setShowEndPicker(Platform.OS === 'ios');
                        if (selectedDate) setEndDate(selectedDate);
                      }}
                    />
                  )}
                </View>
              </View>

              <TouchableOpacity 
                style={styles.timeCheckRow}
                activeOpacity={0.8}
                onPress={() => setHasTime(!hasTime)}
              >
                {hasTime ? <CheckSquare size={20} color={colors.primary} /> : <Square size={20} color={colors.textSecondary} />}
                <Text style={[styles.timeCheckText, { color: colors.text }]}>Тодорхой цаг сонгох</Text>
              </TouchableOpacity>

              {hasTime && (
                <View style={styles.timeInputSection}>
                  <View style={styles.dateField}>
                    <Text style={[styles.dateFieldLabel, { color: colors.textSecondary }]}>Авах цаг</Text>
                    <TouchableOpacity 
                      style={[styles.datePickerSelector, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                      onPress={() => setShowStartTimePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: colors.text, fontSize: 14 }}>{formatTimeLabel(startTime)}</Text>
                    </TouchableOpacity>
                    {showStartTimePicker && (
                      <DateTimePicker
                        value={startTime}
                        mode="time"
                        is24Hour={true}
                        display="spinner"
                        onChange={(event, selectedTime) => {
                          setShowStartTimePicker(Platform.OS === 'ios');
                          if (selectedTime) setStartTime(selectedTime);
                        }}
                      />
                    )}
                  </View>

                  <View style={styles.dateField}>
                    <Text style={[styles.dateFieldLabel, { color: colors.textSecondary }]}>Тушаах цаг</Text>
                    <TouchableOpacity 
                      style={[styles.datePickerSelector, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                      onPress={() => setShowEndTimePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: colors.text, fontSize: 14 }}>{formatTimeLabel(endTime)}</Text>
                    </TouchableOpacity>
                    {showEndTimePicker && (
                      <DateTimePicker
                        value={endTime}
                        mode="time"
                        is24Hour={true}
                        display="spinner"
                        onChange={(event, selectedTime) => {
                          setShowEndTimePicker(Platform.OS === 'ios');
                          if (selectedTime) setEndTime(selectedTime);
                        }}
                      />
                    )}
                  </View>
                </View>
              )}

              <View style={[styles.totalPriceWrap, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.totalPriceLabel, { color: colors.textSecondary }]}>Нийт төлөх дүн:</Text>
                <Text style={[styles.totalPriceValue, { color: colors.primary }]}>{totalPrice.toLocaleString()} ₮</Text>
                <Text style={[styles.calculationHint, { color: colors.textSecondary }]}>({jobPrice.toLocaleString()} ₮ × {rentQuantity} ш × {calculatedDuration} {priceTypeLabel})</Text>
              </View>

              <TouchableOpacity style={[styles.termsWrap, { backgroundColor: agreeTerms ? 'rgba(0,180,90,0.08)' : colors.backgroundSecondary, borderColor: agreeTerms ? '#00B45A' : colors.border }]} activeOpacity={0.8} onPress={() => setAgreeTerms(!agreeTerms)}>
                <View style={styles.termsHeader}>{agreeTerms ? <CheckSquare size={20} color="#00B45A" /> : <Square size={20} color={colors.textSecondary} />}<Text style={[styles.termsTitle, { color: agreeTerms ? '#00B45A' : colors.text }]}>Хариуцлагын санамж зөвшөөрөх</Text></View>
                <Text style={[styles.termsDesc, { color: colors.textSecondary }]}>Tureesly апп нь зөвхөн холбон зуучлах үүрэгтэй бөгөөд барааны бүрэн бүтэн байдал, эвдрэл гэмтэл болон төлбөрийн эрсдэлийг талууд 100% өөрсдөө хариуцна.</Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalCancelButton, { borderColor: colors.border }]} onPress={() => setRentModalVisible(false)} disabled={rentSubmitting}>
                  <Text style={[styles.modalCancelText, { color: colors.text }]}>Болих</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSubmitButton, { backgroundColor: agreeTerms ? colors.primary : colors.border }]} onPress={handleRentSubmit} disabled={rentSubmitting || !agreeTerms}>
                  {rentSubmitting ? <ActivityIndicator color={agreeTerms ? buttonTextColor : colors.textSecondary} /> : <Text style={[styles.modalSubmitText, { color: agreeTerms ? buttonTextColor : colors.textSecondary }]}>Хүсэлт илгээх</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <Modal visible={insuranceModalVisible} transparent animationType="slide" onRequestClose={() => setInsuranceModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.reviewModal, { backgroundColor: colors.background }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Бараагаа даатгуулах уу?</Text>
              <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>Даатгал нь сонголттой. Нэг түрээсийн хүсэлтэд зөвхөн нэг тал л төлөх боломжтой.</Text>

              <View style={[styles.totalPriceWrap, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.totalPriceLabel, { color: colors.textSecondary }]}>Даатгалын test хураамж ({RENTAL_INSURANCE_RATE_PERCENT}%):</Text>
                <Text style={[styles.totalPriceValue, { color: colors.primary }]}>{insurancePremiumForDisplay.toLocaleString()} ₮</Text>
                <Text style={[styles.calculationHint, { color: colors.textSecondary }]}>Нийт түрээсийн дүнгээс тооцсон; доод 1,000₮, дээд 15,000₮.</Text>
              </View>

              <View style={[styles.termsWrap, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Text style={[styles.termsDesc, { color: colors.textSecondary }]}>Энэ нь QPay урсгалыг шалгах demo юм. Бодит даатгалын түнш, нөхцөл батлагдсаны дараа жинхэнэ бодлого үүснэ.</Text>
              </View>

              <TouchableOpacity style={[styles.insuranceBackButton, { borderColor: colors.border }]} onPress={() => { setInsuranceModalVisible(false); setRentModalVisible(true); }} disabled={rentSubmitting}>
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Буцах</Text>
              </TouchableOpacity>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalCancelButton, { borderColor: colors.border }]} onPress={() => void submitRentalRequest(false)} disabled={rentSubmitting}>
                  <Text style={[styles.modalCancelText, { color: colors.text }]}>Даатгалгүй үргэлжлүүлэх</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSubmitButton, { backgroundColor: insurancePremiumForDisplay > 0 ? colors.primary : colors.border }]} onPress={() => void submitRentalRequest(true)} disabled={rentSubmitting || insurancePremiumForDisplay <= 0}>
                  {rentSubmitting ? <ActivityIndicator color={buttonTextColor} /> : <Text style={[styles.modalSubmitText, { color: insurancePremiumForDisplay > 0 ? buttonTextColor : colors.textSecondary }]}>Даатгуулах</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 20 },
  posterSection: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  posterAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginRight: 16, backgroundColor: "#EAEAEA" },
  posterInitial: { fontSize: 28, fontWeight: "700" },
  posterInfo: { flex: 1 },
  posterName: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  posterPhone: { fontSize: 14 },
  titleSection: { padding: 16, borderRadius: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  shareIconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  jobTitle: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  priceContainer: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: 14 },
  jobPrice: { fontSize: 22, fontWeight: "800" },
  priceUnit: { fontSize: 14, fontWeight: "500" },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sponsoredBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  sponsoredBadgeText: { fontSize: 12, fontWeight: "700" },
  imagesSection: { padding: 16, borderRadius: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  imageHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10 },
  imageHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  imageCountText: { fontSize: 13, fontWeight: "600" },
  mainImage: { width: "100%", borderRadius: 16, backgroundColor: "#E9E9E9", marginBottom: 12 },
  thumbnailScroll: { paddingRight: 4, gap: 8 },
  thumbnailWrap: { width: 78, height: 78, borderRadius: 12, borderWidth: 2, overflow: "hidden" },
  thumbnailImage: { width: "100%", height: "100%" },
  metaSection: { padding: 16, borderRadius: 16, marginBottom: 16, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaText: { fontSize: 14 },
  metaTextBold: { fontSize: 14, fontWeight: "700" },
  ratingSection: { padding: 16, borderRadius: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  ratingRows: { gap: 12 },
  ratingLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  ratingLineLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  ratingLineTextWrap: { flex: 1 },
  ratingLineTitle: { fontSize: 14, fontWeight: "700" },
  ratingLineSub: { fontSize: 12, marginTop: 3 },
  ratingLineValue: { fontSize: 13, fontWeight: "800", textAlign: "right", maxWidth: 120 },
  ratingDivider: { height: StyleSheet.hairlineWidth, width: "100%" },
  descriptionSection: { padding: 16, borderRadius: 16, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  description: { fontSize: 15, lineHeight: 22 },
  dynamicDataGrid: { borderRadius: 8, overflow: 'hidden' },
  dynamicDataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dynamicDataKey: { fontSize: 14, fontWeight: '500', flex: 1 },
  dynamicDataValue: { fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'right' },
  callButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, paddingHorizontal: 14, borderRadius: 12, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  callButtonText: { fontSize: 17, fontWeight: "700" },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  notFoundText: { fontSize: 18, fontWeight: "600", marginBottom: 20 },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { fontSize: 16, fontWeight: "600" },
  reviewButton: { marginTop: 12, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, alignItems: "center", gap: 4 },
  reviewButtonText: { fontSize: 16, fontWeight: "800" },
  reviewButtonSubText: { fontSize: 12, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  reviewModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  modalDesc: { fontSize: 13, lineHeight: 19, marginBottom: 20 },
  counterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ccc" },
  counterLabelWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  counterLabel: { fontSize: 16, fontWeight: "600" },
  counterControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  counterBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  counterValue: { fontSize: 18, fontWeight: "700", minWidth: 24, textAlign: "center" },
  dateInputSection: { flexDirection: "row", gap: 12, marginTop: 14, paddingVertical: 10 },
  dateField: { flex: 1 },
  dateFieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  datePickerSelector: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", justifyContent: "center", minHeight: 46 },
  timeCheckRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingVertical: 6 },
  timeCheckText: { fontSize: 15, fontWeight: "600" },
  timeInputSection: { flexDirection: "row", gap: 12, marginTop: 8 },
  totalPriceWrap: { marginTop: 16, padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 10 },
  totalPriceLabel: { fontSize: 14, marginBottom: 4 },
  totalPriceValue: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  calculationHint: { fontSize: 12 },
  termsWrap: { marginTop: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  termsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  termsTitle: { fontSize: 14, fontWeight: "700" },
  termsDesc: { fontSize: 12, lineHeight: 18 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  modalCancelButton: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  modalSubmitButton: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center", minHeight: 48 },
  modalCancelText: { fontSize: 15, fontWeight: "700" },
  modalSubmitText: { fontSize: 15, fontWeight: "800", textAlign: "center" },
  insuranceBackButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginBottom: 10 },
  bottomPadding: { height: 30 },
});