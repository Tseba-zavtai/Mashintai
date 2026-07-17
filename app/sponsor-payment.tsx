// app/sponsor-payment.tsx
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Check, CreditCard } from "lucide-react-native";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader"; // 🎯 НЭМСЭН: Нэгдсэн стандартын толгой

type SponsorPlan = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  description: string;
};

const ALL_PLANS: SponsorPlan[] = [
  { id: "credit", name: "Зар оруулах 3 эрх", price: 5000, durationDays: 0, description: "Та 5,000₮-өөр зарын эрхээ цэнэглэж, дахин 3 шинэ зар байршуулах боломжтой болно." },
  { id: "bump", name: "Зараа дээш гаргах", price: 1000, durationDays: 0, description: "Та нийтэлсэн зараа заруудын хамгийн эхэнд гаргах боломжтой." },
  { id: "daily", name: "1 хоног", price: 4500, durationDays: 1, description: "Та өөрийн нийтэлсэн зараа Sponsored зар болгон 1 хоногийн турш заруудын эхэнд болон хайлтын эхэнд санал болгон харагдуулах боломжтой" },
  { id: "weekly", name: "7 хоног", price: 21000, durationDays: 7, description: "Та өөрийн нийтэлсэн зараа Sponsored зар болгон 7 хоногийн турш заруудын эхэнд болон хайлтын эхэнд санал болгон харагдуулах боломжтой" },
  { id: "monthly", name: "30 хоног", price: 45000, durationDays: 30, description: "Та өөрийн нийтэлсэн зараа Sponsored зар болгон 30 хоногийн турш заруудын эхэнд болон хайлтын эхэнд санал болгон харагдуулах боломжтой" },
];

const PAYMENTS_AVAILABLE = false;

export default function SponsorPaymentScreen() {
  const router = useRouter();
  const { jobId, targetType } = useLocalSearchParams<{ jobId?: string; targetType?: "bump" | "sponsor" | "credit" }>();
  const { jobs, loadJobs } = useJobs() as any;
  const { user, refetchProfile } = useAuth() as any;
  const { colors } = useTheme();
  const [step, setStep] = useState<"info" | "invoice" | "success">("info");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payType, setPayType] = useState<"qpay" | "apple_google">("qpay");

  const dummyBanks = [
    { name: "Хаан Банк", logo: "https://r2-pub.rork.com/attachments/7h0ju4xu59gyen0tzh8ns" },
    { name: "Голомт Банк", logo: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/0rqqd3riktgmfxudfl0s8" },
    { name: "Төрийн Банк", logo: "https://r2-pub.rork.com/attachments/7h0ju4xu59gyen0tzh8ns" },
    { name: "ХАС Банк", logo: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/0rqqd3riktgmfxudfl0s8" }
  ];

  useEffect(() => {
    if (targetType === "bump") setSelectedPlan("bump");
    else if (targetType === "credit") setSelectedPlan("credit");
    else setSelectedPlan("daily");
  }, [targetType]);

  const selectedPlanData = useMemo(() => ALL_PLANS.find((p) => p.id === selectedPlan) ?? null, [selectedPlan]);
  const selectedJob = useMemo(() => (jobs as any[]).find((j) => String(j?.id) === String(jobId)) ?? null, [jobs, jobId]);
  const screenTitle = "Төлбөр төлөлт";


  const handleGenerateInvoice = () => {
    if (!selectedPlanData) return;
    setPayType("qpay");
    setIsSubmitting(true);
    setTimeout(() => {
      setStep("invoice");
      setIsSubmitting(false);
    }, 800);
  };

  const handleFakePayment = async () => {
    if (!selectedPlanData) return;
    try {
      setIsSubmitting(true);
      
      const { error: historyError } = await supabase
        .from("payments")
        .insert([
          {
            user_id: user?.id,
            amount: selectedPlanData.price,
            payment_method: payType === "apple_google" ? (Platform.OS === "ios" ? "apple_pay" : "google_pay") : "qpay",
            status: "success",
            paid_at: new Date().toISOString()
          }
        ]);
        
      if (historyError) {
        console.log("Төлбөрийн түүх хадгалахад алдаа гарлаа (SQL RLS-ээ шалгана уу):", historyError);
      }
      
      if (selectedPlanData.id === "credit") {
        const currentCredits = user?.available_post_credits ?? 0;
        const { error } = await supabase.from("users").update({ available_post_credits: currentCredits + 3 }).eq("id", user?.id);
        if (error) throw error;
        if (refetchProfile) await refetchProfile();
      } 
      else if (selectedPlanData.id === "bump" && jobId) {
        const { error } = await supabase.from("jobs").update({ bumped_at: new Date().toISOString() }).eq("id", jobId);
        if (error) throw error;
        if (loadJobs) await loadJobs();
      } 
      else if (jobId) {
        const durationMs = selectedPlanData.durationDays * 24 * 60 * 60 * 1000;
        const { error } = await supabase.from("jobs").update({ is_sponsored: true, sponsored_until: new Date(Date.now() + durationMs).toISOString() }).eq("id", jobId);
        if (error) throw error;
        if (loadJobs) await loadJobs();
      }
      setStep("success");
    } catch (error: any) {
      console.log("PAYMENT ERROR:", error);
      Alert.alert("Алдаа", error?.message ?? "Төлбөр гүйцэтгэхэд алдаа гарлаа. (Баазын эрх шалгана уу)");
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkPaymentStatus = async () => {
    setIsSubmitting(true);
    setTimeout(() => { 
      handleFakePayment(); 
    }, 1500);
  };

  return (
    // 🎯 ЗАССАН: AppHeader дотор утасны цагны зай (insets.top) тооцоолсон тул эндээс edges=["top"] хэсгийг "bottom" болгож өөрчиллөө
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* 🎯 ЗАССАН: Бидний шинээр хийсэн стандартын толгойг дуудсан */}
      <AppHeader title={screenTitle} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {step === "info" && (
          <View style={styles.stepContainer}>
            {targetType !== "credit" && selectedJob && (
              <View style={[styles.jobSummaryCard, { backgroundColor: colors.background }]}>
                <Text style={[styles.jobSummaryLabel, { color: colors.textSecondary }]}>Сонгосон зар</Text>
                <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={1}>{selectedJob.category || "Ангилал"}</Text>
                <Text style={[styles.jobSub, { color: colors.textSecondary }]} numberOfLines={1}>{selectedJob.title || "Зар"}</Text>
              </View>
            )}

            {(targetType === "sponsor" || targetType === "bump" || targetType === "credit") && (
              <View style={styles.plansContainer}>
                {ALL_PLANS.filter(p => {
                  if (targetType === "bump") return p.id === "bump";
                  if (targetType === "credit") return p.id === "credit";
                  return p.id === "daily" || p.id === "weekly" || p.id === "monthly";
                }).map((plan) => {
                  const selected = selectedPlan === plan.id;
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[
                        styles.planCard, 
                        { backgroundColor: colors.background, borderColor: selected ? "#6E0AB0" : colors.border },
                        selected && { backgroundColor: colors.backgroundSecondary } 
                      ]}
                      activeOpacity={0.9}
                      onPress={() => setSelectedPlan(plan.id)}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                        {selected ? (
                          <View style={styles.radioChecked}>
                            <Check size={14} color="#FFF" />
                          </View>
                        ) : (
                          <View style={[styles.radioUnchecked, { borderColor: colors.textSecondary }]} />
                        )}
                      </View>
                      <Text style={[styles.planPrice, { color: "#6E0AB0" }]}>{plan.price.toLocaleString()}₮</Text>
                      <Text style={[styles.planDescription, { color: colors.textSecondary }]}>{plan.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {selectedPlanData && (
              <>
                <View style={[styles.summaryCard, { backgroundColor: colors.background }]}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Төлбөр</Text>
                  <Text style={[styles.summaryPrice, { color: "#6E0AB0" }]}>
                    {selectedPlanData.price.toLocaleString()}₮
                  </Text>
                  <Text style={[styles.summaryDesc, { color: colors.textSecondary }]}>Хугацаа: {selectedPlanData.name}</Text>
                </View>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>Төлбөрийн аргаа сонгоно уу</Text>
                
                <View style={{ gap: 12 }}>
                  <TouchableOpacity 
                    style={[styles.payMethodBtn, { backgroundColor: "#111111", opacity: PAYMENTS_AVAILABLE ? 1 : 0.55 }]} 
                    activeOpacity={0.85}
                    onPress={undefined}
                    disabled={!PAYMENTS_AVAILABLE || isSubmitting}
                  >
                    {isSubmitting && payType === "apple_google" ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={styles.payMethodBtnContent}>
                        <CreditCard size={24} color="#FFFFFF" />
                        <Text style={[styles.payMethodBtnText, { color: "#FFFFFF" }]}>
                          {`${Platform.OS === "ios" ? "Apple Pay" : "Google Pay"} — Coming soon`}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.qpayBtn, { backgroundColor: colors.background }]} 
                    activeOpacity={0.8}
                    onPress={handleGenerateInvoice}
                    disabled={isSubmitting}
                  >
                    {isSubmitting && payType === "qpay" ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <>
                        <View style={styles.qpayLogoWrap}>
                           <Text style={styles.qpayLogoText}>Q<Text style={{color: '#00B45A'}}>Pay</Text></Text>
                        </View>
                        <Text style={[styles.qpayTitle, { color: colors.text }]}>QPay Mongolia</Text>
                        <Text style={[styles.qpaySub, { color: colors.textSecondary }]}>Банкны апп-аар төлөх</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {step === "invoice" && (
          <View style={[styles.invoiceCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.invoiceTitle, { color: colors.text }]}>QPay invoice бэлэн боллоо</Text>
            <Text style={[styles.invoiceDesc, { color: colors.textSecondary }]}>
               Доорх сувгуудаас өөрийн ашигладаг банкны аппликейшнийг сонгон төлбөрөө баталгаажуулна уу.
            </Text>

            <View style={styles.qrContainer}>
              <View style={[styles.dummyQr, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: 'bold', fontSize: 13 }}>
                  [ ТЕСТ QR КОД ]{"\n\n"}Банкны апп сонгож төлбөрөө баталгаажуулна уу
                 </Text>
              </View>
            </View>

            <View style={styles.banksGrid}>
              {dummyBanks.map((bank, idx) => (
                <TouchableOpacity key={idx} style={[styles.bankItem, { backgroundColor: colors.backgroundSecondary }]} onPress={checkPaymentStatus} disabled={isSubmitting}>
                  <Image source={{ uri: bank.logo }} style={styles.bankLogo} />
                  <Text style={[styles.bankName, { color: colors.text }]} numberOfLines={1}>{bank.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.invoiceActions}>
              <TouchableOpacity style={[styles.actionBtnCheck, { backgroundColor: colors.backgroundSecondary }]} onPress={checkPaymentStatus} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color={colors.text} size="small" /> : <Text style={[styles.actionBtnCheckText, { color: colors.text }]}>↻ Төлөв шалгах</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtnClose, { backgroundColor: colors.backgroundSecondary }]} onPress={() => setStep("info")} disabled={isSubmitting}>
                <Text style={[styles.actionBtnCloseText, { color: colors.text }]}>Хаах</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === "success" && (
          <View style={[styles.successBox, { backgroundColor: colors.background }]}>
            <CheckCircle size={64} color="#34C759" />
            <Text style={[styles.successTitle, { color: colors.text }]}>Төлбөр амжилттай!</Text>
            <Text style={[styles.successText, { color: colors.textSecondary }]}>
               {targetType === "credit" ? "Таны зарын эрх амжилттай 3-аар нэмэгдлээ." : "Үйлчилгээ амжилттай идэвхжлээ."}
            </Text>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={() => router.replace(targetType === "credit" ? "/profile" : "/my-jobs")}>
              <Text style={[styles.doneBtnText, { color: colors.headerText }]}>Дуусгах</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // 🎯 ЗАССАН: Хуучин гараар бичсэн header стилиудийг устгав
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  stepContainer: { gap: 16 },
  jobSummaryCard: { borderRadius: 16, padding: 18, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  jobSummaryLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  jobTitle: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  jobSub: { fontSize: 13 },
  plansContainer: { gap: 12 },
  planCard: { borderRadius: 16, padding: 18, borderWidth: 1.5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  planName: { fontSize: 16, fontWeight: "800" },
  planPrice: { fontSize: 18, fontWeight: "900", marginBottom: 8 },
  planDescription: { fontSize: 13, lineHeight: 18 },
  radioUnchecked: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  radioChecked: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#6E0AB0", alignItems: "center", justifyContent: "center" },
  summaryCard: { borderRadius: 16, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginTop: 4 },
  summaryLabel: { fontSize: 14, marginBottom: 8 },
  summaryPrice: { fontSize: 32, fontWeight: "900", marginBottom: 8 },
  summaryDesc: { fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginLeft: 4, marginTop: 8 },
  payMethodBtn: { borderRadius: 16, padding: 20, height: 72, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  payMethodBtnContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  payMethodBtnText: { fontSize: 18, fontWeight: "800" },
  qpayBtn: { borderRadius: 16, padding: 20, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  qpayLogoWrap: { marginBottom: 4 },
  qpayLogoText: { fontSize: 32, fontWeight: "900", color: "#003366", letterSpacing: -1 },
  qpayTitle: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  qpaySub: { fontSize: 13 },
  invoiceCard: { borderRadius: 16, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  invoiceTitle: { fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  invoiceDesc: { fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 20 },
  qrContainer: { alignItems: "center", marginBottom: 24 },
  dummyQr: { width: 220, height: 220, borderRadius: 16, padding: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  banksGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  bankItem: { width: "48%", padding: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  bankLogo: { width: 28, height: 28, borderRadius: 8 },
  bankName: { fontSize: 12, fontWeight: "600", flex: 1 },
  invoiceActions: { flexDirection: "row", gap: 12 },
  actionBtnCheck: { flex: 2, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionBtnCheckText: { fontSize: 14, fontWeight: "700" },
  actionBtnClose: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionBtnCloseText: { fontSize: 14, fontWeight: "700" },
  successBox: { borderRadius: 16, padding: 32, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  successTitle: { fontSize: 20, fontWeight: "800", marginTop: 16, marginBottom: 8 },
  successText: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  doneBtn: { width: "100%", height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  doneBtnText: { fontSize: 15, fontWeight: "800" }
});