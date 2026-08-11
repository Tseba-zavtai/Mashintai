import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, CreditCard, ShieldCheck } from "lucide-react-native";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { RENTAL_INSURANCE_ENABLED } from "@/constants/features";

type InsuranceRequest = {
  id: string;
  insurance_status: string;
  insurance_payer_id: string | null;
  insurance_payer_role: "requester" | "owner" | null;
  insurance_premium: number | string | null;
  owner_id: string;
  requester_id: string;
  jobs?: { title?: string | null; subcategory?: string | null; category?: string | null } | null;
};

const BANKS = ["Хаан Банк", "Голомт Банк", "Төрийн Банк", "ХАС Банк"];

export default function InsurancePaymentScreen() {
  const router = useRouter();
  const { user } = useAuth() as any;
  const { colors } = useTheme();
  const { requestId, title } = useLocalSearchParams<{ requestId?: string; title?: string }>();
  const [request, setRequest] = useState<InsuranceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"info" | "invoice" | "success">("info");
  const [submitting, setSubmitting] = useState(false);
  const [approvalPending, setApprovalPending] = useState(false);

  const loadRequest = useCallback(async () => {
    if (!requestId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("rental_requests")
        .select("id,insurance_status,insurance_payer_id,insurance_payer_role,insurance_premium,owner_id,requester_id,jobs(title,subcategory,category)")
        .eq("id", requestId)
        .single();
      if (error) throw error;
      setRequest(data as InsuranceRequest);
    } catch (error: any) {
      Alert.alert("Алдаа", error?.message ?? "Даатгалын төлбөрийн мэдээлэл олдсонгүй.", [
        { text: "Буцах", onPress: () => router.replace("/(tabs)/rental-requests") },
      ]);
    } finally {
      setLoading(false);
    }
  }, [requestId, router]);

  useEffect(() => {
    if (!RENTAL_INSURANCE_ENABLED) {
      setLoading(false);
      return;
    }
    void loadRequest();
  }, [loadRequest]);

  const premium = useMemo(() => Math.max(0, Number(request?.insurance_premium ?? 0)), [request?.insurance_premium]);
  const itemTitle = request?.jobs?.title || request?.jobs?.subcategory || request?.jobs?.category || title || "Түрээсийн хүсэлт";
  const payerLabel = request?.insurance_payer_role === "owner" ? "Эзэмшигч" : "Түрээслэгч";
  const expectedPendingStatus = request?.insurance_payer_role === "owner" ? "payment_pending_owner" : "payment_pending_requester";
  const isAuthorizedPayer = !!user?.id && request?.insurance_payer_id === user.id && request?.insurance_status === expectedPendingStatus;

  if (!RENTAL_INSURANCE_ENABLED) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader title="Даатгал" />
        <View style={styles.center}>
          <ShieldCheck size={34} color={colors.textSecondary} />
          <Text style={[styles.heroTitle, { color: colors.text }]}>Даатгал түр идэвхгүй байна</Text>
          <Text style={[styles.muted, { color: colors.textSecondary, textAlign: "center" }]}>Энэ боломж дараагийн шинэчлэлтээр дахин нээгдэнэ.</Text>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary, width: 220 }]} onPress={() => router.replace("/(tabs)/rental-requests")}>
            <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>Мэдэгдэл рүү буцах</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const generateInvoice = () => {
    if (!isAuthorizedPayer || submitting) {
      Alert.alert("Анхаар", "Энэ test төлбөрийг үргэлжлүүлэх эрхгүй эсвэл төлбөр аль хэдийн баталгаажсан байна.");
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setStep("invoice");
    }, 500);
  };

  const completeDemoPayment = async () => {
    if (!requestId || !isAuthorizedPayer || submitting) return;

    try {
      setSubmitting(true);
      const { data, error } = await supabase.rpc("complete_rental_insurance_demo_payment", {
        p_request_id: requestId,
      });
      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.insurance_status) throw new Error("Даатгалын төлбөрийн төлөв баталгаажаагүй байна.");

      if (result.payer_role === "requester") {
        const { error: pushError } = await supabase.functions.invoke("send-rental-request-push", {
          body: { rentalRequestId: requestId },
        });
        if (pushError) console.log("INSURANCE PUSH ERROR:", pushError);
      } else {
        const { error: approvalError } = await supabase.rpc("approve_rental_request", {
          p_request_id: requestId,
        });
        if (approvalError) {
          console.log("INSURANCE APPROVAL ERROR:", approvalError);
          setApprovalPending(true);
        }
      }

      setRequest((current) => current ? {
        ...current,
        insurance_status: result.insurance_status,
      } : current);
      setStep("success");
    } catch (error: any) {
      Alert.alert("Алдаа", error?.message ?? "Test төлбөр баталгаажуулахад алдаа гарлаа.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title="Даатгалын төлбөр" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.muted, { color: colors.textSecondary }]}>Төлбөрийн мэдээлэл уншиж байна...</Text>
          </View>
        ) : !request ? null : step === "info" ? (
          <>
            <View style={[styles.hero, { backgroundColor: colors.background }]}>
              <View style={[styles.iconWrap, { backgroundColor: colors.backgroundSecondary }]}>
                <ShieldCheck size={28} color={colors.primary} />
              </View>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Нэмэлт даатгал</Text>
              <Text style={[styles.heroDesc, { color: colors.textSecondary }]}>Энэ төлбөрийг зөвхөн {payerLabel.toLowerCase()} нэг удаа хийнэ.</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>ТҮРЭЭСЛЭХ БАРАА</Text>
              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>{itemTitle}</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>ДААТГАЛЫН TEST ХУРААМЖ</Text>
              <Text style={[styles.amount, { color: colors.primary }]}>{premium.toLocaleString()} ₮</Text>
              <Text style={[styles.muted, { color: colors.textSecondary }]}>Нийт түрээсийн дүнгийн 1% · Доод 1,000₮ · Дээд 15,000₮</Text>
            </View>

            <View style={[styles.notice, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.noticeText, { color: colors.textSecondary }]}>QPay-ийн энэ дэлгэц test горимд ажиллаж байна. Бодит даатгалын түншийн гэрээ, нөхцөл болон жинхэнэ invoice холбогдоогүй.</Text>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Төлбөрийн арга</Text>
            <TouchableOpacity style={[styles.comingSoon, { opacity: 0.55 }]} disabled>
              <CreditCard size={22} color="#FFFFFF" />
              <Text style={styles.comingSoonText}>{Platform.OS === "ios" ? "Apple Pay" : "Google Pay"} — Coming soon</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.qpayButton, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={generateInvoice} disabled={submitting || !isAuthorizedPayer}>
              {submitting ? <ActivityIndicator color={colors.primary} /> : <>
                <Text style={styles.qpayMark}>Q<Text style={styles.qpayAccent}>Pay</Text></Text>
                <View style={styles.qpayTextWrap}>
                  <Text style={[styles.qpayTitle, { color: colors.text }]}>QPay Mongolia</Text>
                  <Text style={[styles.muted, { color: colors.textSecondary }]}>Банкны апп-аар төлөх</Text>
                </View>
              </>}
            </TouchableOpacity>
          </>
        ) : step === "invoice" ? (
          <View style={[styles.invoiceCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>QPay invoice бэлэн боллоо</Text>
            <Text style={[styles.invoiceDesc, { color: colors.textSecondary }]}>Доорх нь test QR. Аль нэг банкны товчийг дарж test төлбөрийг баталгаажуулна уу.</Text>
            <View style={[styles.qr, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Text style={[styles.qrTitle, { color: colors.text }]}>[ TEST QR ]</Text>
              <Text style={[styles.muted, { color: colors.textSecondary }]}>{premium.toLocaleString()} ₮</Text>
            </View>
            <View style={styles.banks}>
              {BANKS.map((bank) => (
                <TouchableOpacity key={bank} style={[styles.bankButton, { borderColor: colors.border }]} onPress={() => void completeDemoPayment()} disabled={submitting}>
                  <Text style={[styles.bankText, { color: colors.text }]}>{bank}</Text>
                  {submitting ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.bankPay, { color: colors.primary }]}>Төлөх</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={[styles.successCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <CheckCircle2 size={58} color="#00B45A" />
            <Text style={[styles.heroTitle, { color: colors.text }]}>Test төлбөр баталгаажлаа</Text>
            <Text style={[styles.successText, { color: colors.textSecondary }]}>
              {request.insurance_payer_role === "requester"
                ? "Эзэмшигч рүү даатгалтай түрээсийн хүсэлт илгээгдлээ."
                : approvalPending
                  ? "Даатгалын test төлбөр баталгаажлаа. Хүсэлтийг Мэдэгдэл хэсгээс дахин зөвшөөрнө үү."
                  : "Даатгалтайгаар түрээслэх хүсэлтийг зөвшөөрлөө. Түрээслэгчид мэдэгдэл очно."}
            </Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => router.replace("/(tabs)/rental-requests")}>
              <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>Мэдэгдэл рүү очих</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 44 },
  center: { paddingVertical: 70, alignItems: "center", gap: 12 },
  hero: { borderRadius: 20, padding: 22, alignItems: "center", marginBottom: 14 },
  iconWrap: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  heroTitle: { fontSize: 21, fontWeight: "800", textAlign: "center" },
  heroDesc: { marginTop: 8, fontSize: 14, lineHeight: 20, textAlign: "center" },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  itemTitle: { marginTop: 6, fontSize: 17, fontWeight: "800" },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  amount: { marginTop: 5, fontSize: 30, fontWeight: "900" },
  muted: { marginTop: 5, fontSize: 13, lineHeight: 19 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 22 },
  noticeText: { fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 10 },
  comingSoon: { height: 54, borderRadius: 14, backgroundColor: "#111111", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, marginBottom: 10 },
  comingSoonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  qpayButton: { minHeight: 72, borderRadius: 14, borderWidth: 1, paddingHorizontal: 18, flexDirection: "row", alignItems: "center" },
  qpayMark: { fontSize: 25, color: "#20315D", fontWeight: "900", marginRight: 14 },
  qpayAccent: { color: "#00B45A" },
  qpayTextWrap: { flex: 1 },
  qpayTitle: { fontSize: 16, fontWeight: "800" },
  invoiceCard: { borderRadius: 20, borderWidth: 1, padding: 20 },
  invoiceDesc: { marginTop: 10, fontSize: 14, lineHeight: 20, textAlign: "center" },
  qr: { width: 190, height: 190, borderRadius: 14, borderWidth: 1, alignSelf: "center", marginVertical: 22, alignItems: "center", justifyContent: "center" },
  qrTitle: { fontSize: 20, fontWeight: "900" },
  banks: { gap: 10 },
  bankButton: { minHeight: 52, borderRadius: 13, borderWidth: 1, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bankText: { fontSize: 15, fontWeight: "800" },
  bankPay: { fontSize: 14, fontWeight: "800" },
  successCard: { borderRadius: 20, borderWidth: 1, padding: 26, alignItems: "center", marginTop: 24 },
  successText: { marginTop: 12, fontSize: 14, lineHeight: 21, textAlign: "center" },
  primaryButton: { width: "100%", minHeight: 52, marginTop: 24, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { fontSize: 15, fontWeight: "800" },
});
