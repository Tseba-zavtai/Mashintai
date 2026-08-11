// app/rental-requests.tsx
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Check, X, ClipboardList, RefreshCw, PhoneCall, CheckSquare, Square, ShieldAlert } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  calculateRentalInsurancePremium,
  isRentalInsurancePaid,
  rentalInsurancePayerLabel,
  RENTAL_INSURANCE_RATE_PERCENT,
} from "@/lib/rentalInsurance";
import AppHeader from "@/components/AppHeader";
import { RENTAL_INSURANCE_ENABLED } from "@/constants/features"; // 🎯 НЭМСЭН: Нэгдсэн стандартын толгой

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
  insurance_status?: string | null;
  insurance_payer_id?: string | null;
  insurance_payer_role?: "requester" | "owner" | null;
  insurance_premium?: number | null;
  deposit_amount?: number | null;
  agreement_snapshot?: Record<string, any> | null;
  owner_agreed_at?: string | null;
  requester_agreed_at?: string | null;
  agreement_completed_at?: string | null;
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
  if (status === "paid") return "Бараа хүлээж байгаа";
  if (status === "handover_requested") return "Хүлээлгэж өгөх хүсэлт";
  if (status === "in_rent") return "Түрээсэлж байгаа";
  if (status === "completed") return "Дууссан";
  return "Цуцалсан";
}

export default function RentalRequestsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { rentalRequests, rentalRequestsError, loadRentalRequests, rejectRentalRequest } = useJobs() as any;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [depositAmountInput, setDepositAmountInput] = useState("0");
  const [agreementModalVisible, setAgreementModalVisible] = useState(false);
  const [agreementRequestId, setAgreementRequestId] = useState<string | null>(null);
  const [disputeModalVisible, setDisputeModalVisible] = useState(false);
  const [disputeRequestId, setDisputeRequestId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("not_returned");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [openDisputeRequestIds, setOpenDisputeRequestIds] = useState<Set<string>>(new Set());
  const [reviewedRequestIds, setReviewedRequestIds] = useState<Set<string>>(new Set());

  const loadReviewStatuses = useCallback(async () => {
    if (!user?.id) {
      setReviewedRequestIds(new Set());
      return;
    }

    const { data, error } = await supabase
      .from("rental_reviews")
      .select("request_id")
      .eq("reviewer_id", user.id)
      .not("request_id", "is", null);
    if (error) throw error;
    setReviewedRequestIds(new Set((data ?? []).map((row: any) => String(row.request_id))));
  }, [user?.id]);

  const loadOpenDisputeStatuses = useCallback(async () => {
    if (!user?.id) {
      setOpenDisputeRequestIds(new Set());
      return;
    }

    const { data, error } = await supabase
      .from("rental_disputes")
      .select("rental_request_id")
      .eq("reporter_id", user.id)
      .in("status", ["open", "under_review"]);
    if (error) throw error;
    setOpenDisputeRequestIds(new Set((data ?? []).map((row: any) => String(row.rental_request_id))));
  }, [user?.id]);
  const load = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadRentalRequests?.(), loadReviewStatuses(), loadOpenDisputeStatuses()]);
    } catch (e: any) {
      Alert.alert("Алдаа", e?.message ?? "Хүсэлтүүд татахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }, [loadRentalRequests, loadReviewStatuses, loadOpenDisputeStatuses]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadRentalRequests?.(), loadReviewStatuses(), loadOpenDisputeStatuses()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadRentalRequests, loadReviewStatuses, loadOpenDisputeStatuses]);

  useEffect(() => {
    const clearAllBadges = async () => {
      if (!user?.id) return;
      try {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", user.id)
          .eq("is_read", false);
      } catch (err) {
        console.log("Badge clear error:", err);
      }
    };

    clearAllBadges();
  }, [user]);

  const handleMarkAsRead = async (requestId: string) => {
    if (!user?.id) return;
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("reference_id", requestId)
        .eq("user_id", user.id);
    } catch (err) {
      console.log("Notification update error:", err);
    }
  };

  const openApproveModal = (id: string) => {
    handleMarkAsRead(id);
    setSelectedRequestId(id);
    setDepositAmountInput("0");
    setAgreeTerms(false);
    setTermsModalVisible(true);
  };

  const continueOwnerInsurancePayment = (request: RentalRequest) => {
    const premium = Math.max(0, Number(request.insurance_premium ?? calculateRentalInsurancePremium(request.total_price)));
    if (premium <= 0) {
      Alert.alert("Анхаар", "Даатгалын дүн тооцоологдсонгүй.");
      return;
    }
    setTermsModalVisible(false);
    setSelectedRequestId(null);
    router.push({
      pathname: "/insurance-payment",
      params: {
        requestId: request.id,
        flow: "owner",
        premium: String(premium),
        title: String(request.jobs?.title || request.jobs?.subcategory || request.jobs?.category || "Түрээсийн хүсэлт"),
      },
    });
  };

  const startOwnerInsurancePayment = async (request: RentalRequest) => {
    const premium = calculateRentalInsurancePremium(request.total_price);
    if (premium <= 0) {
      Alert.alert("Анхаар", "Даатгалын дүн тооцоологдсонгүй.");
      return;
    }

    try {
      setBusyId(request.id);
      const { error } = await supabase.rpc("prepare_rental_insurance_demo_payment", {
        p_request_id: request.id,
        p_premium: premium,
        p_rate_percent: RENTAL_INSURANCE_RATE_PERCENT,
      });
      if (error) throw error;
      await loadRentalRequests?.();
      continueOwnerInsurancePayment({
        ...request,
        insurance_status: "payment_pending_owner",
        insurance_payer_role: "owner",
        insurance_premium: premium,
      });
    } catch (e: any) {
      Alert.alert("Алдаа", e?.message ?? "Даатгалын test төлбөр үүсгэхэд алдаа гарлаа.");
    } finally {
      setBusyId(null);
    }
  };

  const finishApprove = async (request: RentalRequest, recordInsuranceDecline: boolean) => {
    if (busyId) return;
    try {
      setBusyId(request.id);
      if (recordInsuranceDecline) {
        const premium = calculateRentalInsurancePremium(request.total_price);
        const { error: insuranceError } = await supabase.rpc("decline_rental_insurance", {
          p_request_id: request.id,
          p_premium: premium,
          p_rate_percent: RENTAL_INSURANCE_RATE_PERCENT,
        });
        if (insuranceError) throw insuranceError;
      }
      const deposit = Number(String(depositAmountInput).replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(deposit) || deposit < 0) {
        throw new Error("Барьцааны дүн 0 эсвэл түүнээс их бүхэл тоо байна.");
      }
      const { error: agreementError } = await supabase.rpc("approve_rental_with_agreement", {
        p_request_id: request.id,
        p_deposit_amount: Math.round(deposit),
      });
      if (agreementError) throw agreementError;
      await loadRentalRequests?.();
      setTermsModalVisible(false);
      Alert.alert("Мэдэгдэл", "Нөхцөлийг илгээлээ. Түрээслэгч барьцаа, гэрээний нөхцөлийг зөвшөөрсний дараа бараа хүлээж авна.");
    } catch (e: any) {
      Alert.alert("Алдаа", e?.message ?? "Зөвшөөрөхөд алдаа гарлаа");
    } finally {
      setBusyId(null);
      setSelectedRequestId(null);
    }
  };

  const confirmApprove = async () => {
    if (!selectedRequestId || busyId) return;
    const request = (Array.isArray(rentalRequests) ? rentalRequests : []).find((item: RentalRequest) => item.id === selectedRequestId) as RentalRequest | undefined;
    if (!request) {
      Alert.alert("Алдаа", "Түрээсийн хүсэлт олдсонгүй.");
      return;
    }

    if (!RENTAL_INSURANCE_ENABLED) {
      await finishApprove(request, false);
      return;
    }

    const insuranceStatus = request.insurance_status ?? "not_requested";
    if (isRentalInsurancePaid(insuranceStatus)) {
      await finishApprove(request, false);
      return;
    }

    if (insuranceStatus === "payment_pending_owner") {
      continueOwnerInsurancePayment(request);
      return;
    }

    if (insuranceStatus === "payment_pending_requester") {
      Alert.alert("Мэдэгдэл", "Түрээслэгч даатгалын test төлбөрөө баталгаажуулсны дараа хүсэлт танд ирнэ.");
      return;
    }

    const premium = calculateRentalInsurancePremium(request.total_price);
    setTermsModalVisible(false);
    Alert.alert(
      "Бараагаа даатгуулах уу?",
      `Даатгал нь сонголттой. Test хураамж: ${premium.toLocaleString()} ₮ (нийт түрээсийн дүнгийн ${RENTAL_INSURANCE_RATE_PERCENT}%). Нэг хүсэлтэд зөвхөн нэг тал л төлнө.`,
      [
        { text: "Буцах", style: "cancel" },
        { text: "Даатгалгүй зөвшөөрөх", onPress: () => void finishApprove(request, true) },
        { text: "Даатгуулах", onPress: () => void startOwnerInsurancePayment(request) },
      ],
    );
  };

  const openAgreementModal = (requestId: string) => {
    setAgreementRequestId(requestId);
    setAgreementModalVisible(true);
  };

  const acceptAgreement = async () => {
    if (!agreementRequestId || busyId) return;
    try {
      setBusyId(agreementRequestId);
      const { error } = await supabase.rpc("accept_rental_agreement", { p_request_id: agreementRequestId });
      if (error) throw error;
      await loadRentalRequests?.();
      setAgreementModalVisible(false);
      Alert.alert("Амжилттай", "Гэрээ, барьцааны нөхцөлийг зөвшөөрлөө. Одоо бараа хүлээж авах хүсэлтээ илгээнэ үү.");
    } catch (e: any) {
      Alert.alert("Алдаа", e?.message ?? "Нөхцөлийг зөвшөөрөхөд алдаа гарлаа.");
    } finally {
      setBusyId(null);
      setAgreementRequestId(null);
    }
  };

  const openDisputeModal = (requestId: string) => {
    setDisputeRequestId(requestId);
    setDisputeReason("not_returned");
    setDisputeDescription("");
    setDisputeModalVisible(true);
  };

  const submitDispute = async () => {
    if (!disputeRequestId || !user?.id || busyId) return;
    const request = (Array.isArray(rentalRequests) ? rentalRequests : []).find((item: RentalRequest) => item.id === disputeRequestId) as RentalRequest | undefined;
    if (!request) {
      Alert.alert("Алдаа", "Түрээсийн хүсэлт олдсонгүй.");
      return;
    }
    const description = disputeDescription.trim();
    if (description.length < 10) {
      Alert.alert("Тайлбар дутуу", "Маргааны талаар дор хаяж 10 тэмдэгтээр тайлбарлана уу.");
      return;
    }
    const reportedUserId = request.requester_id === user.id ? request.owner_id : request.requester_id;
    try {
      setBusyId(disputeRequestId);
      const { error } = await supabase.from("rental_disputes").insert({
        rental_request_id: disputeRequestId,
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        reason: disputeReason,
        description,
      });
      if (error) throw error;
      await loadOpenDisputeStatuses();
      setDisputeModalVisible(false);
      Alert.alert("Маргаан бүртгэгдлээ", "Админ шалгаж, шаардлагатай бол account-д түр хязгаарлалт тавина. Та баримт, чат болон хүлээлцсэн мэдээллээ хадгална уу.");
    } catch (e: any) {
      Alert.alert("Алдаа", e?.message ?? "Маргааныг бүртгэж чадсангүй.");
    } finally {
      setBusyId(null);
      setDisputeRequestId(null);
    }
  };
  const handleReject = async (id: string) => {
    if (busyId) return;
    handleMarkAsRead(id);
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

  const handleReceiveItem = async (requestId: string) => {
    handleMarkAsRead(requestId);
    try {
      setBusyId(requestId);
      const { error } = await supabase.from("rental_requests").update({ status: "handover_requested" }).eq("id", requestId);
      if (error) throw error;
      Alert.alert("Амжилттай", "Барааг хүлээж авсан хүсэлтийг эзэнд нь илгээлээ.");
      loadRentalRequests?.();
    } catch (e: any) {
      Alert.alert("Алдаа", e.message || "Алдаа гарлаа");
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmHandover = async (requestId: string) => {
    handleMarkAsRead(requestId);
    try {
      setBusyId(requestId);
      const { error } = await supabase.from("rental_requests").update({ status: "in_rent" }).eq("id", requestId);
      if (error) throw error;
      Alert.alert("Амжилттай", "Түрээс албан ёсоор эхэллээ.");
      loadRentalRequests?.();
    } catch (e: any) {
      Alert.alert("Алдаа", e.message || "Баталгаажуулахад алдаа гарлаа");
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectHandover = async (requestId: string) => {
    handleMarkAsRead(requestId);
    try {
      setBusyId(requestId);
      const { error } = await supabase.from("rental_requests").update({ status: "approved" }).eq("id", requestId);
      if (error) throw error;
      Alert.alert("Мэдэгдэл", "Бараа хүлээлгэж өгөх хүсэлтийг буцаалаа.");
      loadRentalRequests?.();
    } catch (e: any) {
      Alert.alert("Алдаа", e.message || "Алдаа гарлаа");
    } finally {
      setBusyId(null);
    }
  };

  const openReviewForRequest = (requestId: string, jobId: string, targetUserId: string, isOwnerView: boolean) => {
    router.push({
      pathname: "/review" as any,
      params: {
        jobId,
        ownerId: targetUserId,
        requestId,
        isOwnerView: isOwnerView ? "true" : "false",
      },
    });
  };
  const handleEarlyReturnRequest = async (requestId: string, jobId: string, ownerId: string) => {
    handleMarkAsRead(requestId);
    Alert.alert("Бараагаа буцааж тушаах уу?", "Бараагаа эзэнд нь буцааж өгсөн бол энэ үйлдлийг баталгаажуулна уу.", [
      { text: "Болих", style: "cancel" },
      {
        text: "Буцааж өгсөн",
        onPress: async () => {
          try {
            setBusyId(requestId);
            const { error } = await supabase.from("rental_requests").update({ status: "paid" }).eq("id", requestId);
            if (error) throw error;
            await loadRentalRequests?.();
            Alert.alert("Амжилттай", "Эзэнд нь бараа буцсан тухай мэдэгдлээ. Эзнийг үнэлэх үү?", [
              { text: "Дараа", style: "cancel" },
              { text: "Үнэлгээ өгөх", onPress: () => openReviewForRequest(requestId, jobId, ownerId, false) },
            ]);
          } catch (e: any) {
            Alert.alert("Алдаа", e.message || "Алдаа гарлаа");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };
  const handleCompleteRental = async (requestId: string) => {
    handleMarkAsRead(requestId);
    Alert.alert("Түрээс дуусгах уу?", "Бараагаа бүрэн бүтэн хүлээж авсан бол гэрээг хааж, түрээслэгчийг үнэлнэ үү.", [
      { text: "Болих", style: "cancel" },
      {
        text: "Дуусгах & Үнэлэх",
        onPress: async () => {
          try {
            setBusyId(requestId);
            const { data: requestData, error: reqError } = await supabase.from("rental_requests").select("job_id, quantity, requester_id").eq("id", requestId).single();
            if (reqError) throw reqError;

            if (requestData) {
              const { error: statusError } = await supabase.from("rental_requests").update({ status: "completed" }).eq("id", requestId);
              if (statusError) throw statusError;

              const { data: jobData, error: jobFetchError } = await supabase.from("jobs").select("quantity").eq("id", requestData.job_id).single();
              if (jobFetchError) throw jobFetchError;

              const currentQty = jobData?.quantity ? Number(jobData.quantity) : 0;
              const returnQty = requestData?.quantity ? Number(requestData.quantity) : 1;
              await supabase.from("jobs").update({ quantity: currentQty + returnQty }).eq("id", requestData.job_id);
              openReviewForRequest(requestId, requestData.job_id, requestData.requester_id, true);
            }
            loadRentalRequests?.();
          } catch (e: any) {
            Alert.alert("Алдаа", e.message || "Алдаа гарлаа");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const allRequests: RentalRequest[] = Array.isArray(rentalRequests) ? rentalRequests : [];
  const currentUserId = user?.id;
  // A renter can start the test payment before notifying the owner. Do not expose
  // that draft to the owner until the payment is confirmed.
  const list = allRequests.filter((item) => !(
    RENTAL_INSURANCE_ENABLED &&
    item.owner_id === currentUserId && item.insurance_status === "payment_pending_requester"
  ));

  const agreementRequest = agreementRequestId
    ? allRequests.find((item) => item.id === agreementRequestId) ?? null
    : null;
  const agreementTerms = (agreementRequest?.agreement_snapshot ?? {}) as Record<string, any>;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {/* 🎯 ЗАССАН: edges=["bottom"] болгож цагаан зай гаргадаг алдааг засав */}
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["bottom"]}>
        
        {/* 🎯 ЗАССАН: Хуучин гараар зурсан толгойг устгаад, нэгдсэн AppHeader-ийг дуудав */}
        <AppHeader title="Мэдэгдэл" />

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Таны хүсэлтүүд</Text>
            <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}><RefreshCw size={18} color={colors.primary} /></TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.centerText, { color: colors.textSecondary }]}>Уншиж байна...</Text>
            </View>
          ) : rentalRequestsError && list.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card }]}>
              <ClipboardList size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Хүсэлтүүдийг татаж чадсангүй</Text>
              <Text style={[styles.centerText, { color: colors.textSecondary, textAlign: "center" }]}>{rentalRequestsError}</Text>
              <TouchableOpacity
                onPress={onRefresh}
                style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary }}
              >
                <RefreshCw size={16} color={colors.buttonText} />
                <Text style={{ color: colors.buttonText, fontWeight: "700" }}>Дахин оролдох</Text>
              </TouchableOpacity>
            </View>
          ) : list.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card }]}>
              <ClipboardList size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Хүсэлт алга байна</Text>
            </View>
          ) : (
            list.map((item) => {
              const job = item.jobs ?? {};
              const imageUrls = Array.isArray(job.image_urls) ? job.image_urls : [];
              const imageUrl = job.image_url ?? imageUrls[0] ?? null;
              
              const isOwner = currentUserId === item.owner_id;
              const isRequester = currentUserId === item.requester_id;
              const isApprovedOrActive = item.status !== "pending" && item.status !== "rejected" && item.status !== "cancelled";
               const hasReviewed = reviewedRequestIds.has(item.id);
               const insuranceStatus = item.insurance_status ?? "not_requested";
               const insurancePaid = isRentalInsurancePaid(insuranceStatus);
               const insurancePayer = rentalInsurancePayerLabel(insuranceStatus);
               const insurancePaymentPending = insuranceStatus === "payment_pending_requester" || insuranceStatus === "payment_pending_owner";
               const agreementPrepared = Boolean(item.owner_agreed_at && item.agreement_snapshot);
               const requesterAcceptedAgreement = Boolean(item.requester_agreed_at);
               const hasOpenDispute = openDisputeRequestIds.has(item.id);

              return (
                <TouchableOpacity 
                  key={item.id} 
                  style={[styles.card, { backgroundColor: colors.card }]}
                  activeOpacity={0.9}
                  onPress={() => handleMarkAsRead(item.id)}
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
                        {isOwner ? `${item.requester_name || "Хэрэглэгч"} таны барааг түрээслэх хүсэлт илгээлээ.` : `Та энэ барааг түрээслэхээр хүсэлт илгээсэн байна.`}
                      </Text>
                      <View style={styles.detailsRow}>
                        <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>Тоо: {item.quantity ?? 1}ш</Text>
                        {item.rent_days ? <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>·  Хугацаа: {item.rent_days} хоног</Text> : null}
                      </View>
                      <Text style={[styles.dateText, { color: colors.textSecondary }]}>{formatDate(item.created_at)}</Text>
                    </View>
                  </View>

                  {isApprovedOrActive && (
                     <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundSecondary, padding: 8, borderRadius: 8 }}>
                       <PhoneCall size={16} color={colors.primary} style={{ marginRight: 8 }} />
                       <Text style={[styles.phoneText, { color: colors.text, marginTop: 0 }]}>
                         {isOwner ? `Түрээслэгч: ${item.requester_phone || "Дугаар алга"}` : `Эзэмшигч: ${job?.postedBy?.phone || job?.posted_by_phone || "Дугаар алга"}`}
                       </Text>
                     </View>
                  )}

                  <View style={styles.statusRow}>
                    <Text style={[styles.statusText, { color: colors.text }]}>
                      Төлөв: <Text style={{ color: '#34C759' }}>{statusLabel(item.status)}</Text>
                    </Text>
                    {item.total_price ? (
                      <Text style={[styles.priceText, { color: "#6E0AB0" }]}>
                        {Number(item.total_price).toLocaleString()} ₮
                      </Text>
                    ) : null}
                  </View>
                  {RENTAL_INSURANCE_ENABLED && (insurancePaid || insurancePaymentPending) && (
                    <View style={[styles.insuranceBadge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                      <Text style={[styles.insuranceBadgeText, { color: insurancePaid ? colors.primary : colors.textSecondary }]}>
                        {insurancePaid
                          ? `Даатгалтай · ${insurancePayer || "Төлөгдсөн"}`
                          : "Даатгалын test төлбөр хүлээгдэж байна"}
                      </Text>
                    </View>
                  )}
                  {agreementPrepared && (
                    <View style={[styles.agreementBadge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                      <Text style={[styles.agreementBadgeText, { color: colors.text }]}>
                        Гэрээний нөхцөл · Барьцаа: {Number(item.deposit_amount ?? 0).toLocaleString()} ₮
                      </Text>
                      <Text style={[styles.agreementStatusText, { color: requesterAcceptedAgreement ? "#00A85A" : colors.textSecondary }]}>
                        {requesterAcceptedAgreement ? "Хоёр тал баталгаажуулсан" : isOwner ? "Түрээслэгчийн баталгаа хүлээгдэж байна" : "Бараа авахын өмнө нөхцөлийг зөвшөөрнө"}
                      </Text>
                    </View>
                  )}
                  {/* ТҮРЭЭСЛҮҮЛЭГЧИЙН ҮЙЛДЛҮҮД */}
                  {isOwner && (
                    <View style={styles.actionsRow}>
                      {RENTAL_INSURANCE_ENABLED && item.status === "pending" && insuranceStatus === "payment_pending_owner" && (
                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={() => continueOwnerInsurancePayment(item)}>
                          <Check size={18} color={colors.buttonText} />
                          <Text style={[styles.actionText, { color: colors.buttonText }]}>Даатгалын төлбөр үргэлжлүүлэх</Text>
                        </TouchableOpacity>
                      )}
                      {item.status === "pending" && (!RENTAL_INSURANCE_ENABLED || insuranceStatus !== "payment_pending_owner") && (
                        <>
                          <TouchableOpacity style={[styles.actionButton, styles.rejectButton, { borderColor: colors.border }]} onPress={() => handleReject(item.id)}>
                            <X size={18} color={colors.text} />
                            <Text style={[styles.actionText, { color: colors.text }]}>Татгалзах</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={() => openApproveModal(item.id)}>
                            <Check size={18} color={colors.buttonText} />
                            <Text style={[styles.actionText, { color: colors.buttonText }]}>Зөвшөөрөх</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      
                      {item.status === "handover_requested" && (
                        <>
                          <TouchableOpacity style={[styles.actionButton, styles.rejectButton, { borderColor: colors.border }]} onPress={() => handleRejectHandover(item.id)}>
                            <X size={18} color={colors.text} />
                            <Text style={[styles.actionText, { color: colors.text }]}>Цуцлах</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={() => handleConfirmHandover(item.id)}>
                            <Check size={18} color={colors.buttonText} />
                            <Text style={[styles.actionText, { color: colors.buttonText }]}>Баталгаажуулах</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {(item.status === "paid") && (
                         <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={() => handleCompleteRental(item.id)}>
                           <Check size={18} color={colors.buttonText} />
                           <Text style={[styles.actionText, { color: colors.buttonText }]}>Түрээс дуусгах</Text>
                         </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* ТҮРЭЭСЛЭГЧИЙН ҮЙЛДЛҮҮД */}
                  {isRequester && (
                    <View style={styles.actionsRow}>
                      {RENTAL_INSURANCE_ENABLED && item.status === "pending" && insuranceStatus === "payment_pending_requester" && item.insurance_payer_id === currentUserId && (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.primary }]}
                          onPress={() => router.push({
                            pathname: "/insurance-payment",
                            params: {
                              requestId: item.id,
                              flow: "requester",
                              premium: String(item.insurance_premium ?? calculateRentalInsurancePremium(item.total_price)),
                              title: String(job.title || job.subcategory || job.category || "Түрээсийн хүсэлт"),
                            },
                          })}
                        >
                          <Check size={18} color={colors.buttonText} />
                          <Text style={[styles.actionText, { color: colors.buttonText }]}>Даатгалын төлбөр үргэлжлүүлэх</Text>
                        </TouchableOpacity>
                      )}
                      {item.status === "approved" && agreementPrepared && !requesterAcceptedAgreement && (
                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={() => openAgreementModal(item.id)}>
                          <CheckSquare size={18} color={colors.buttonText} />
                          <Text style={[styles.actionText, { color: colors.buttonText }]}>Нөхцөл зөвшөөрөх</Text>
                        </TouchableOpacity>
                      )}
                      {item.status === "approved" && (!agreementPrepared || requesterAcceptedAgreement) && (
                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={() => handleReceiveItem(item.id)}>
                          <Check size={18} color={colors.buttonText} />
                          <Text style={[styles.actionText, { color: colors.buttonText }]}>Бараа хүлээж авах</Text>
                        </TouchableOpacity>
                      )}
                      
                      {item.status === "handover_requested" && (
                        <View style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1 }]}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={{ color: colors.textSecondary, marginLeft: 8, fontWeight: '600' }}>Эзнийг хүлээж байна...</Text>
                        </View>
                      )}

                      {item.status === "in_rent" && (
                         <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#FF9500' }]} onPress={() => handleEarlyReturnRequest(item.id, item.job_id, item.owner_id)}>
                           <X size={18} color="#FFFFFF" />
                           <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Бараа буцааж өгөх</Text>
                         </TouchableOpacity>
                      )}

                      {item.status === "paid" && (
                        <View style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1 }]}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={{ color: colors.textSecondary, marginLeft: 8, fontWeight: '600' }}>Эзнийг хүлээж байна...</Text>
                        </View>
                      )}

                      {(item.status === "paid" || item.status === "completed") && !hasReviewed && (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.primary }]}
                          onPress={() => openReviewForRequest(item.id, item.job_id, item.owner_id, false)}
                        >
                          <Check size={18} color={colors.buttonText} />
                          <Text style={[styles.actionText, { color: colors.buttonText }]}>Эзнийг үнэлэх</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  {isApprovedOrActive && (
                    <TouchableOpacity
                      style={[styles.disputeButton, { borderColor: hasOpenDispute ? colors.border : "#D64545", backgroundColor: hasOpenDispute ? colors.backgroundSecondary : "rgba(214,69,69,0.08)" }]}
                      onPress={() => !hasOpenDispute && openDisputeModal(item.id)}
                      disabled={hasOpenDispute}
                    >
                      <ShieldAlert size={17} color={hasOpenDispute ? colors.textSecondary : "#D64545"} />
                      <Text style={[styles.disputeButtonText, { color: hasOpenDispute ? colors.textSecondary : "#D64545" }]}>{hasOpenDispute ? "Маргаан шалгагдаж байна" : "Маргаан мэдээлэх"}</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        <Modal
          visible={termsModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setTermsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.termsModal, { backgroundColor: colors.background }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Түрээсийн нөхцөл тогтоох
              </Text>
              
              <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
                Барьцааны дүн, түрээсийн нөхцөлийг баталгаажуулна. Барьцааг Tureesly автоматаар татахгүй; талууд биечлэн төлбөр, хүлээлцэх нөхцөлөө тохиролцоно.
              </Text>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Барьцааны дүн (₮)</Text>
              <TextInput
                value={depositAmountInput}
                onChangeText={setDepositAmountInput}
                keyboardType="number-pad"
                placeholder="Жишээ нь: 50000"
                placeholderTextColor={colors.textSecondary}
                style={[styles.depositInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
              />
              <Text style={[styles.depositHint, { color: colors.textSecondary }]}>0 ₮ гэж үлдээвэл барьцаагүй гэсэн нөхцөл болно.</Text>

              <TouchableOpacity 
                style={[styles.termsWrap, { backgroundColor: agreeTerms ? 'rgba(0,180,90,0.08)' : colors.backgroundSecondary, borderColor: agreeTerms ? '#00B45A' : colors.border }]} 
                activeOpacity={0.8}
                onPress={() => setAgreeTerms(!agreeTerms)}
              >
                <View style={styles.termsHeader}>
                  {agreeTerms ? <CheckSquare size={20} color="#00B45A" /> : <Square size={20} color={colors.textSecondary} />}
                  <Text style={[styles.termsTitle, { color: agreeTerms ? '#00B45A' : colors.text }]}>Гэрээ, хариуцлагын нөхцөлийг зөвшөөрөх</Text>
                </View>
                <Text style={[styles.termsDescText, { color: colors.textSecondary }]}>
                  Энэ баталгаажуулалт нь барьцаа, барааны тоо, хугацаа болон нийт түрээсийн дүнг тухайн хүсэлтэд тогтоож үлдээнэ. Tureesly нь барьцааг одоохондоо хүлээн авч, хадгалахгүй.
                </Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalCancelButton, { borderColor: colors.border }]}
                  onPress={() => setTermsModalVisible(false)}
                  disabled={busyId !== null}
                >
                  <Text style={[styles.modalCancelText, { color: colors.text }]}>Болих</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSubmitButton, { backgroundColor: agreeTerms ? colors.primary : colors.border }]}
                  onPress={confirmApprove}
                  disabled={busyId !== null || !agreeTerms}
                >
                  {busyId !== null ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.modalSubmitText, { color: agreeTerms ? "#FFFFFF" : colors.textSecondary }]}>Зөвшөөрөх</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <Modal
          visible={agreementModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setAgreementModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.termsModal, { backgroundColor: colors.background }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Гэрээ, барьцааны нөхцөл</Text>
              <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>Эзэмшигчийн баталгаажуулсан нөхцөлийг хүлээн зөвшөөрсний дараа бараа хүлээж авах хүсэлт илгээнэ.</Text>
              <View style={[styles.agreementPreview, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Text style={[styles.agreementPreviewTitle, { color: colors.text }]}>{String(agreementTerms.title ?? agreementRequest?.jobs?.title ?? "Түрээсийн бараа")}</Text>
                <Text style={[styles.agreementPreviewText, { color: colors.textSecondary }]}>Тоо: {Number(agreementTerms.quantity ?? agreementRequest?.quantity ?? 1)}ш · Хугацаа: {Number(agreementTerms.rent_days ?? agreementRequest?.rent_days ?? 0)} хоног</Text>
                <Text style={[styles.agreementPreviewText, { color: colors.textSecondary }]}>Түрээсийн нийт дүн: {Number(agreementTerms.rental_total ?? agreementRequest?.total_price ?? 0).toLocaleString()} ₮</Text>
                <Text style={[styles.agreementPreviewDeposit, { color: colors.primary }]}>Барьцаа: {Number(agreementTerms.deposit_amount ?? agreementRequest?.deposit_amount ?? 0).toLocaleString()} ₮</Text>
              </View>
              <Text style={[styles.termsDescText, { color: colors.textSecondary }]}>Барьцааг Tureesly автоматаар хүлээн авахгүй. Талууд бодит төлбөр, бараа хүлээлцэх баримтаа өөрсдөө тохиролцож хадгална.</Text>
              <View style={[styles.modalActions, { marginTop: 20 }]}>
                <TouchableOpacity style={[styles.modalCancelButton, { borderColor: colors.border }]} onPress={() => setAgreementModalVisible(false)} disabled={busyId !== null}>
                  <Text style={[styles.modalCancelText, { color: colors.text }]}>Болих</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSubmitButton, { backgroundColor: colors.primary }]} onPress={acceptAgreement} disabled={busyId !== null || !agreementRequest}>
                  {busyId ? <ActivityIndicator color={colors.buttonText} /> : <Text style={[styles.modalSubmitText, { color: colors.buttonText }]}>Зөвшөөрөх</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={disputeModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setDisputeModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.termsModal, { backgroundColor: colors.background }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Маргаан мэдээлэх</Text>
              <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>Зөвхөн бодит асуудлаа тайлбарлаж илгээнэ үү. Админ шалгах хүртэл чат, зураг, хүлээлцсэн баримтаа хадгалаарай.</Text>
              <View style={styles.reasonRow}>
                {[
                  ["not_returned", "Бараа буцаагаагүй"],
                  ["damaged", "Эвдрэл, гэмтэл"],
                  ["payment", "Төлбөр"],
                  ["conduct", "Харилцаа"],
                  ["other", "Бусад"],
                ].map(([value, label]) => (
                  <TouchableOpacity key={value} onPress={() => setDisputeReason(value)} style={[styles.reasonChip, { borderColor: disputeReason === value ? colors.primary : colors.border, backgroundColor: disputeReason === value ? "rgba(110,10,176,0.10)" : colors.backgroundSecondary }]}>
                    <Text style={[styles.reasonChipText, { color: disputeReason === value ? colors.primary : colors.textSecondary }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                value={disputeDescription}
                onChangeText={setDisputeDescription}
                multiline
                maxLength={3000}
                placeholder="Юу болсон, хэзээ болсон, ямар баримт байгаа талаар товч бичнэ үү..."
                placeholderTextColor={colors.textSecondary}
                textAlignVertical="top"
                style={[styles.disputeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalCancelButton, { borderColor: colors.border }]} onPress={() => setDisputeModalVisible(false)} disabled={busyId !== null}>
                  <Text style={[styles.modalCancelText, { color: colors.text }]}>Болих</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSubmitButton, { backgroundColor: "#D64545" }]} onPress={submitDispute} disabled={busyId !== null}>
                  {busyId ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.modalSubmitText, { color: "#FFFFFF" }]}>Илгээх</Text>}
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
  // 🎯 ЗАССАН: Хуучин гараар бичсэн header стилиудийг устгав
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 36 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 14 },
  centerBox: { paddingVertical: 36, alignItems: "center" },
  centerText: { marginTop: 10, fontSize: 14 },
  emptyBox: { borderRadius: 18, padding: 24, alignItems: "center" },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: "800" },
  emptyText: { marginTop: 8, fontSize: 14, textAlign: "center", lineHeight: 20 },
  card: { borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
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
  statusRow: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.1)" },
  statusText: { fontSize: 14, fontWeight: "800" },
  insuranceBadge: { marginTop: 10, borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  insuranceBadgeText: { fontSize: 12, fontWeight: "700" },
  agreementBadge: { marginTop: 10, borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  agreementBadgeText: { fontSize: 13, fontWeight: "800" },
  agreementStatusText: { marginTop: 3, fontSize: 12, fontWeight: "700" },
  disputeButton: { marginTop: 12, minHeight: 42, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  disputeButtonText: { fontSize: 13, fontWeight: "800" },
  priceText: { fontSize: 16, fontWeight: "900" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionButton: { flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  rejectButton: { borderWidth: 1 },
  actionText: { fontSize: 14, fontWeight: "800" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  termsModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  modalDesc: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: "800", marginBottom: 8 },
  depositInput: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, fontWeight: "700" },
  depositHint: { fontSize: 12, marginTop: 6, marginBottom: 14 },
  agreementPreview: { borderWidth: 1, borderRadius: 12, padding: 14 },
  agreementPreviewTitle: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  agreementPreviewText: { fontSize: 13, lineHeight: 20 },
  agreementPreviewDeposit: { fontSize: 16, fontWeight: "900", marginTop: 10 },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  reasonChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  reasonChipText: { fontSize: 12, fontWeight: "700" },
  disputeInput: { minHeight: 120, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  termsWrap: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 20 },
  termsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  termsTitle: { fontSize: 15, fontWeight: "700" },
  termsDescText: { fontSize: 13, lineHeight: 18 },
  modalActions: { flexDirection: "row", gap: 10 },
  modalCancelButton: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  modalSubmitButton: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center", minHeight: 48 },
  modalCancelText: { fontSize: 15, fontWeight: "700" },
  modalSubmitText: { fontSize: 15, fontWeight: "800" },
});