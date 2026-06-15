import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Check, X, ChevronLeft, ClipboardList, CreditCard, Info } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
import { getLogoSource } from "@/constants/logo";
import { supabase } from "@/lib/supabase";

type RentalRequest = {
  id: string;
  job_id: string;
  requester_id: string;
  owner_id: string;
  requester_name?: string | null;
  requester_phone?: string | null;
  requester_photo?: string | null;
  quantity?: number | null;
  rent_days?: number | null;
  total_price?: number | null;
  status: "pending" | "approved" | "rejected" | "cancelled" | "completed" | "paid" | "handover_requested" | "in_rent";
  message?: string | null;
  created_at?: string;
  jobs?: any;
};

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const day = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (day <= 0) return "Өнөөдөр";
  if (day === 1) return "Өчигдөр";
  return `${day} өдрийн өмнө`;
}

function statusLabel(status: RentalRequest["status"]) {
  if (status === "pending") return "Хүлээгдэж байна";
  if (status === "approved") return "Зөвшөөрсөн";
  if (status === "rejected") return "Татгалзсан";
  if (status === "paid") return "Төлбөр төлөгдсөн";
  if (status === "handover_requested") return "Хүлээлгэж өгөх хүсэлт";
  if (status === "in_rent") return "Түрээсэлж байгаа";
  if (status === "completed") return "Дууссан";
  return "Цуцалсан";
}

export default function RentalRequestsScreen() {
  const router = useRouter();
  const { colors, currentTheme } = useTheme();
  const { user } = useAuth();
  const {
    rentalRequests,
    loadRentalRequests,
    approveRentalRequest,
    rejectRentalRequest,
  } = useJobs() as any;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      await loadRentalRequests?.();
    } catch (e: any) {
      Alert.alert("Алдаа", e?.message ?? "Хүсэлтүүд татахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }, [loadRentalRequests]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadRentalRequests?.();
    } finally {
      setRefreshing(false);
    }
  }, [loadRentalRequests]);

  const handleApprove = async (id: string) => {
    if (busyId) return;
    Alert.alert(
      "Зөвшөөрөх үү?",
      "Зөвшөөрвөл энэ зарын боломжит тоо 1-ээр багасна. Түрээслэгч төлбөрөө төлсний дараа баталгаажна.",
      [
        { text: "Болих", style: "cancel" },
        {
          text: "Зөвшөөрөх",
          onPress: async () => {
            try {
              setBusyId(id);
              await approveRentalRequest?.(id);
              Alert.alert("Амжилттай", "Түрээслэх хүсэлтийг зөвшөөрлөө. Түрээслэгч рүү мэдэгдэл илгээгдсэн.");
            } catch (e: any) {
              Alert.alert("Алдаа", e?.message ?? "Зөвшөөрөхөд алдаа гарлаа");
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (id: string) => {
    if (busyId) return;
    Alert.alert("Татгалзах уу?", "Энэ хүсэлт татгалзсан төлөвтэй болно.", [
      { text: "Болих", style: "cancel" },
      {
        text: "Татгалзах",
        style: "destructive",
        onPress: async () => {
          try {
            setBusyId(id);
            await rejectRentalRequest?.(id);
          } catch (e: any) {
            Alert.alert("Алдаа", e?.message ?? "Татгалзахад алдаа гарлаа");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const handlePay = (requestId: string, totalPrice?: number | null) => {
    if (!totalPrice || totalPrice <= 0) {
      Alert.alert("Анхаар", "Төлбөрийн дүн 0 байна.");
      return;
    }

    Alert.alert(
      "Анхаар",
      "Та бараагаа хүлээн авах үедээ төлбөрөө баталгаажуулж шилжүүлээрэй.",
      [
        { text: "Болих", style: "cancel" },
        {
          text: "OK",
          onPress: () => {
            router.push({
              pathname: "/payment" as any,
              params: { requestId, amount: totalPrice },
            });
          },
        },
      ]
    );
  };

  // Түрээслэгч бараа хүлээж авах хүсэлт илгээх
  const handleHandover = async (requestId: string) => {
    try {
      setBusyId(requestId);
      const { error } = await supabase
        .from("rental_requests")
        .update({ status: "handover_requested" })
        .eq("id", requestId);

      if (error) throw error;
      Alert.alert("Амжилттай", "Бараа хүлээлгэж өгөх хүсэлтийг түрээслүүлэгч рүү илгээлээ.");
      loadRentalRequests?.();
    } catch (e: any) {
      Alert.alert("Алдаа", e.message || "Хүсэлт илгээхэд алдаа гарлаа");
    } finally {
      setBusyId(null);
    }
  };

  // Түрээслүүлэгч бараа өгснийг батлах (Түрээс эхлэх)
  const handleConfirmHandover = async (requestId: string) => {
    try {
      setBusyId(requestId);
      const { error } = await supabase
        .from("rental_requests")
        .update({ status: "in_rent" })
        .eq("id", requestId);

      if (error) throw error;
      Alert.alert("Амжилттай", "Барааг хүлээлгэж өгснийг баталгаажууллаа. Түрээс эхэллээ.");
      loadRentalRequests?.();
    } catch (e: any) {
      Alert.alert("Алдаа", e.message || "Баталгаажуулахад алдаа гарлаа");
    } finally {
      setBusyId(null);
    }
  };

  // Түрээслүүлэгч бараа хүлээлгэж өгөхөөс татгалзах
  const handleRejectHandover = async (requestId: string) => {
    try {
      setBusyId(requestId);
      const { error } = await supabase
        .from("rental_requests")
        .update({ status: "paid" })
        .eq("id", requestId);

      if (error) throw error;
      Alert.alert("Мэдэгдэл", "Бараа хүлээлгэж өгөх хүсэлтээс татгалзлаа.");
      loadRentalRequests?.();
    } catch (e: any) {
      Alert.alert("Алдаа", e.message || "Татгалзахад алдаа гарлаа");
    } finally {
      setBusyId(null);
    }
  };

  // 🛠️ ЗАСВАР: Түрээс дуусахад төлөв "completed" болоод, зарын тоо ширхгийг буцааж нэмэх логик
  const handleCompleteRental = async (requestId: string) => {
    Alert.alert(
      "Түрээс дуусгах уу?",
      "Түрээсийг дуусгаснаар зарын тоо ширхэг буцаж нэмэгдэнэ. Мөн хоёр тал бие биедээ үнэлгээ өгөх боломжтой болно.",
      [
        { text: "Болих", style: "cancel" },
        {
          text: "Дуусгах",
          onPress: async () => {
            try {
              setBusyId(requestId);

              // Алхам А: Түрээсийн мэдээллийг татаж авах (job_id болон quantity хэрэгтэй)
              const { data: requestData, error: reqError } = await supabase
                .from("rental_requests")
                .select("job_id, quantity")
                .eq("id", requestId)
                .single();

              if (reqError) throw reqError;

              if (requestData) {
                // Алхам Б: Төлөвийг "completed" болгоно
                const { error: statusError } = await supabase
                  .from("rental_requests")
                  .update({ status: "completed" })
                  .eq("id", requestId);

                if (statusError) throw statusError;

                // Алхам В: Зарын одоогийн тоо ширхгийг унших
                const { data: jobData, error: jobFetchError } = await supabase
                  .from("jobs")
                  .select("quantity")
                  .eq("id", requestData.job_id)
                  .single();

                if (jobFetchError) throw jobFetchError;

                // Алхам Г: Тоо ширхгийг буцааж нэмэгдүүлэн шинэчлэх
                const currentQty = jobData?.quantity ? Number(jobData.quantity) : 0;
                const returnQty = requestData?.quantity ? Number(requestData.quantity) : 1;
                const newQty = currentQty + returnQty;

                const { error: qtyError } = await supabase
                  .from("jobs")
                  .update({ quantity: newQty })
                  .eq("id", requestData.job_id);

                if (qtyError) throw qtyError;
              }

              Alert.alert("Амжилттай", "Түрээсийн хугацаа дууслаа. Одоо профайл хэсгээс үнэлгээгээ өгнө үү.");
              loadRentalRequests?.();
            } catch (e: any) {
              Alert.alert("Алдаа", e.message || "Түрээс хаахад алдаа гарлаа");
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const list: RentalRequest[] = Array.isArray(rentalRequests) ? rentalRequests : [];
  const currentUserId = user?.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
        edges={["top"]}
      >
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75}>
              <ChevronLeft size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: "#FFFFFF" }]}>Мэдэгдэл</Text>
          </View>

          <Image
            source={getLogoSource(currentTheme)}
            style={[styles.logo, { tintColor: "#FFFFFF" }]}
            resizeMode="contain"
          />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Таны хүсэлтүүд</Text>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.centerText, { color: colors.textSecondary }]}>Уншиж байна...</Text>
            </View>
          ) : list.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.background }]}>
              <ClipboardList size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Хүсэлт алга байна</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Түрээслэх эсвэл түрээслүүлэх хүсэлт ирвэл энд харагдана.</Text>
            </View>
          ) : (
            list.map((item) => {
              const job = item.jobs ?? {};
              const imageUrls = Array.isArray(job.image_urls) ? job.image_urls : [];
              const imageUrl = job.image_url ?? imageUrls[0] ?? null;
              
              const isPending = item.status === "pending";
              const isApproved = item.status === "approved";
              const isBusy = busyId === item.id;
              
              const isOwner = currentUserId === item.owner_id;
              const isRequester = currentUserId === item.requester_id;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={isRequester && isApproved ? 0.85 : 1}
                  onPress={() => {
                    if (isRequester && isApproved) {
                      handlePay(item.id, item.total_price);
                    }
                  }}
                  style={[styles.card, { backgroundColor: colors.background }]}
                >
                  <View style={styles.cardTop}>
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                        <ClipboardList size={22} color={colors.textSecondary} />
                      </View>
                    )}

                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                        {job.subcategory || job.category || job.title || "Зар"}
                      </Text>
                      <Text style={[styles.cardSub, { color: colors.textSecondary }]} numberOfLines={2}>
                        {isOwner 
                          ? `${item.requester_name || "Хэрэглэгч"} таны барааг түрээслэх хүсэлт илгээлээ.` 
                          : `Та энэ барааг түрээслэхээр хүсэлт илгээсэн байна.`}
                      </Text>
                      
                      <View style={styles.detailsRow}>
                        <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                          Тоо: {item.quantity ?? 1}ш
                        </Text>
                        {item.rent_days ? (
                          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                            · Хугацаа: {item.rent_days} хоног
                          </Text>
                        ) : null}
                      </View>
                      
                      <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                        {formatDate(item.created_at)}
                      </Text>
                    </View>
                  </View>

                  {isOwner && !!item.requester_phone && (
                    <Text style={[styles.phoneText, { color: colors.textSecondary }]}>Холбогдох утас: {item.requester_phone}</Text>
                  )}

                  <View style={styles.statusRow}>
                    <Text style={[styles.statusText, { color: colors.text }]}>
                      Төлөв: <Text style={{ color: (isApproved || item.status === "paid" || item.status === "handover_requested" || item.status === "in_rent" || item.status === "completed") ? '#34C759' : colors.text }}>{statusLabel(item.status)}</Text>
                    </Text>
                    
                    {item.total_price ? (
                       <Text style={[styles.priceText, { color: colors.primary }]}>
                         Дүн: {Number(item.total_price).toLocaleString()} ₮
                       </Text>
                    ) : null}
                  </View>

                  {/* А. Зарын ЭЗЭНД (Түрээслүүлэгч) харагдах товчлуурууд */}
                  {isOwner && (isPending || item.status === "handover_requested" || item.status === "in_rent") ? (
                    <View style={styles.actionsRow}>
                      {item.status === "pending" ? (
                        <>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.rejectButton, { borderColor: colors.border, opacity: isBusy ? 0.6 : 1 }]}
                            onPress={() => handleReject(item.id)}
                            disabled={isBusy}
                            activeOpacity={0.8}
                          >
                            <X size={18} color={colors.text} />
                            <Text style={[styles.actionText, { color: colors.text }]}>Татгалзах</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: colors.primary, opacity: isBusy ? 0.6 : 1 }]}
                            onPress={() => handleApprove(item.id)}
                            disabled={isBusy}
                            activeOpacity={0.8}
                          >
                            {isBusy ? <ActivityIndicator color={colors.headerText} /> : <Check size={18} color={colors.headerText} />}
                            <Text style={[styles.actionText, { color: colors.headerText }]}>Зөвшөөрөх</Text>
                          </TouchableOpacity>
                        </>
                      ) : item.status === "handover_requested" ? (
                        <>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.rejectButton, { borderColor: colors.border, opacity: isBusy ? 0.6 : 1 }]}
                            onPress={() => handleRejectHandover(item.id)}
                            disabled={isBusy}
                            activeOpacity={0.8}
                          >
                            <X size={18} color={colors.text} />
                            <Text style={[styles.actionText, { color: colors.text }]}>Хүлээж аваагүй</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: colors.primary, opacity: isBusy ? 0.6 : 1 }]}
                            onPress={() => handleConfirmHandover(item.id)}
                            disabled={isBusy}
                            activeOpacity={0.8}
                          >
                            {isBusy ? <ActivityIndicator color={colors.headerText} /> : <Check size={18} color={colors.headerText} />}
                            <Text style={[styles.actionText, { color: colors.headerText }]}>Бараа өгснийг батлах</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        /* Түрээсэлж байгаа (in_rent) үед харагдах Дуусгах товч */
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.primary, opacity: isBusy ? 0.6 : 1 }]}
                          onPress={() => handleCompleteRental(item.id)}
                          disabled={isBusy}
                          activeOpacity={0.8}
                        >
                          {isBusy ? <ActivityIndicator color={colors.headerText} /> : <Check size={18} color={colors.headerText} />}
                          <Text style={[styles.actionText, { color: colors.headerText }]}>Түрээс дуусгах</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null}

                  {/* Б. ТҮРЭЭСЛЭГЧИД (Хүсэлт гаргагч) харагдах товчлуурууд */}
                  {isRequester && (isApproved || item.status === "paid" || item.status === "handover_requested" || item.status === "in_rent") ? (
                    <View style={styles.actionsRow}>
                      {item.status === "approved" ? (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.primary }]}
                          onPress={() => handlePay(item.id, item.total_price)}
                          activeOpacity={0.8}
                        >
                          <CreditCard size={18} color={colors.headerText} />
                          <Text style={[styles.actionText, { color: colors.headerText }]}>Төлбөр төлөх</Text>
                        </TouchableOpacity>
                      ) : item.status === "paid" ? (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.primary, opacity: isBusy ? 0.6 : 1 }]}
                          onPress={() => handleHandover(item.id)}
                          disabled={isBusy}
                          activeOpacity={0.8}
                        >
                          {isBusy ? <ActivityIndicator color={colors.headerText} /> : <Check size={18} color={colors.headerText} />}
                          <Text style={[styles.actionText, { color: colors.headerText }]}>Бараа хүлээлгэж өгөх</Text>
                        </TouchableOpacity>
                      ) : item.status === "handover_requested" ? (
                        <View style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1, gap: 8 }]}>
                          <ActivityIndicator color={colors.textSecondary} size="small" />
                          <Text style={[styles.actionText, { color: colors.textSecondary }]}>Эзэмшигч зөвшөөрөхийг хүлээж байна...</Text>
                        </View>
                      ) : (
                        /* 🛠️ ШИНЭ: Түрээслэгчид "in_rent" үед харагдах ухаалаг хайрцаг */
                        <View style={[styles.infoActiveBox, { backgroundColor: 'rgba(52, 199, 89, 0.1)', borderColor: '#34C759' }]}>
                          <Info size={16} color="#34C759" />
                          <Text style={[styles.infoActiveText, { color: '#24963E' }]}>
                            Түрээс идэвхтэй үргэлжилж байна. Хугацаа дуусахад эзэмшигч хаана. Түүний дараа Профайл хэсгээс үнэлгээгээ өгнө үү.
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : null}

                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  logo: { width: 86, height: 38 },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 36 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 14 },
  centerBox: { paddingVertical: 36, alignItems: "center" },
  centerText: { marginTop: 10, fontSize: 14 },
  emptyBox: { borderRadius: 18, padding: 24, alignItems: "center" },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: "800" },
  emptyText: { marginTop: 8, fontSize: 14, textAlign: "center", lineHeight: 20 },
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: { flexDirection: "row", gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  cardSub: { fontSize: 14, lineHeight: 19 },
  detailsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  cardMeta: { fontSize: 13, fontWeight: "600" },
  dateText: { marginTop: 4, fontSize: 11, fontWeight: "500", opacity: 0.7 },
  phoneText: { marginTop: 10, fontSize: 13, fontWeight: "700" },
  statusRow: { 
    marginTop: 12, 
    flexDirection: "row", 
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.1)"
  },
  statusText: { fontSize: 14, fontWeight: "800" },
  priceText: { fontSize: 16, fontWeight: "900" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  rejectButton: { borderWidth: 1 },
  actionText: { fontSize: 14, fontWeight: "800" },
  // 🛠️ Шинэ хайрцагны загвар
  infoActiveBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start"
  },
  infoActiveText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    flex: 1
  }
});