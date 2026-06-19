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
  Linking,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ChevronLeft,
  Check,
  BadgeDollarSign,
  RefreshCw,
  AlertTriangle,
  Star,
  CheckCircle,
  Package
} from "lucide-react-native";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";

type SponsorPlan = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  description: string;
};

const ALL_PLANS: SponsorPlan[] = [
  {
    id: "credit",
    name: "Зар оруулах 3 эрх",
    price: 5000,
    durationDays: 0,
    description: "Та 5,000₮-өөр зарын эрхээ цэнэглэж, дахин 3 шинэ зар системд байршуулах боломжтой болно.",
  },
  {
    id: "bump",
    name: "Зараа дээш гаргах",
    price: 1000,
    durationDays: 0,
    description: "Та өөрийн нийтэлсэн зараа 1 цагийн турш заруудын хамгийн эхэнд ямар нэгэн тусгай тэмдэглэгээ (badge)-гүй харагдуулах боломжтой.",
  },
  {
    id: "daily",
    name: "Sponsored 1 хоног",
    price: 4500,
    durationDays: 1,
    description: "Та өөрийн нийтлэсэн зараа Sponsored зар болгон 1 хоногийн турш заруудын эхэнд болон хайлтын эхэнд санал болгон харагдуулах боломжтой",
  },
  {
    id: "weekly",
    name: "Sponsored 7 хоног",
    price: 21000,
    durationDays: 7,
    description: "Та өөрийн нийтлэсэн зараа Sponsored зар болгон 7 хоногийн турш заруудын эхэнд болон хайлтын эхэнд санал болгон харагдуулах боломжтой",
  },
  {
    id: "monthly",
    name: "Sponsored 30 хоног",
    price: 45000,
    durationDays: 30,
    description: "Та өөрийн нийтлэсэн зараа Sponsored зар болгон 30 хоногийн турш заруудын эхэнд болон хайлтын эхэнд санал болгон харагдуулах боломжтой",
  },
];

export default function SponsorPaymentScreen() {
  const router = useRouter();
  const { jobId, targetType } = useLocalSearchParams<{ jobId?: string; targetType?: "bump" | "sponsor" | "credit" }>();
  const { jobs, loadJobs } = useJobs() as any;
  const { user, refetchProfile } = useAuth() as any;
  const { colors, currentTheme } = useTheme();

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentPaid, setPaymentPaid] = useState(false);

  const dummyBanks = [
    { name: "Хаан Банк", logo: "https://r2-pub.rork.com/attachments/7h0ju4xu59gyen0tzh8ns" },
    { name: "Голомт Банк", logo: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/0rqqd3riktgmfxudfl0s8" },
    { name: "Төрийн Банк", logo: "https://r2-pub.rork.com/attachments/7h0ju4xu59gyen0tzh8ns" },
    { name: "ХАС Банк", logo: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/0rqqd3riktgmfxudfl0s8" }
  ];

  useEffect(() => {
    if (targetType === "bump") {
      setSelectedPlan("bump");
    } else if (targetType === "credit") {
      setSelectedPlan("credit");
    } else {
      setSelectedPlan("daily");
    }
  }, [targetType]);

  const selectedPlanData = useMemo(
    () => ALL_PLANS.find((plan) => plan.id === selectedPlan) ?? null,
    [selectedPlan]
  );

  const selectedJob = useMemo(() => {
    return (jobs as any[]).find((job: any) => String(job?.id) === String(jobId)) ?? null;
  }, [jobs, jobId]);

  const handleFakePayment = async () => {
    if (!selectedPlanData) return;

    try {
      setIsSubmitting(true);

      if (selectedPlanData.id === "credit") {
        const currentCredits = user?.available_post_credits ?? 0;
        const { error } = await supabase
          .from("profiles")
          .update({ available_post_credits: currentCredits + 3 })
          .eq("id", user?.id);
        if (error) throw error;
        await refetchProfile?.();
      } else if (selectedPlanData.id === "bump" && jobId) {
        const { error } = await supabase
          .from("jobs")
          .update({ last_bumped_at: new Date().toISOString() })
          .eq("id", jobId);
        if (error) throw error;
        await loadJobs?.();
      } else if (jobId) {
        const durationMs = selectedPlanData.durationDays * 24 * 60 * 60 * 1000;
        const { error } = await supabase
          .from("jobs")
          .update({
            is_sponsored: true,
            sponsored_until: new Date(Date.now() + durationMs).toISOString()
          })
          .eq("id", jobId);
        if (error) throw error;
        await loadJobs?.();
      }

      setPaymentPaid(true);
    } catch (error: any) {
      Alert.alert("Алдаа", error?.message ?? "Төлбөр гүйцэтгэхэд алдаа гарлаа.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const screenTitle = targetType === "credit" ? "Эрх цэнэглэх" : targetType === "bump" ? "Зараа дээшлүүлэх" : "Sponsored зар";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["top"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: screenTitle,
          headerStyle: { backgroundColor: colors.headerBackground },
          headerTitleStyle: { fontSize: 18, fontWeight: "700", color: colors.headerText },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
              <ChevronLeft size={24} color={colors.headerText} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        
        {paymentPaid ? (
          <View style={[styles.successBox, { backgroundColor: colors.background }]}>
            <CheckCircle size={64} color="#34C759" />
            <Text style={[styles.successTitle, { color: colors.text }]}>Төлбөр амжилттай!</Text>
            <Text style={[styles.successText, { color: colors.textSecondary }]}>
              {targetType === "credit" 
                ? "Таны зарын эрх амжилттай 3-аар нэмэгдлээ." 
                : "Үйлчилгээ амжилттай идэвхжлээ."}
            </Text>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={() => router.replace(targetType === "credit" ? "/profile" : "/my-jobs")}>
              <Text style={[styles.doneBtnText, { color: colors.headerText }]}>Дуусгах</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {targetType !== "credit" && selectedJob && (
              <View style={[styles.jobSummaryCard, { backgroundColor: colors.background }]}>
                <Text style={[styles.jobSummaryLabel, { color: colors.textSecondary }]}>Сонгосон зар</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center" }}>
                    <Package size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.jobTitle, { color: colors.text, flex: 1 }]} numberOfLines={2}>{selectedJob.title || selectedJob.category || "Зар"}</Text>
                </View>
              </View>
            )}

            {targetType === "sponsor" && (
              <View style={styles.plansContainer}>
                {ALL_PLANS.filter(p => p.id === "daily" || p.id === "weekly" || p.id === "monthly").map((plan) => {
                  const selected = selectedPlan === plan.id;
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[styles.planCard, { backgroundColor: colors.background, borderColor: selected ? colors.primary : colors.border }, selected && { backgroundColor: `${colors.primary}10` }]}
                      activeOpacity={0.7}
                      onPress={() => setSelectedPlan(plan.id)}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary }}>{plan.price.toLocaleString()}₮</Text>
                      </View>
                      <Text style={[styles.planDescription, { color: colors.textSecondary }]}>{plan.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {selectedPlanData && (
              <View style={[styles.paymentBox, { backgroundColor: colors.background }]}>
                <Text style={[styles.boxTitle, { color: colors.text }]}>QPay QR кодоор төлөх ({selectedPlanData.price.toLocaleString()}₮)</Text>
                
                <View style={styles.qrContainer}>
                  <View style={[styles.dummyQr, { backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>
                      [ TEST QR CODE ]{"\n\n"}Доорх банкны аль нэг дээр дарж гүйлгээг хуурамчаар баталгаажуулна уу.
                    </Text>
                  </View>
                </View>

                <View style={styles.banksSection}>
                  <Text style={[styles.banksTitle, { color: colors.text }]}>Банкны апп сонгох:</Text>
                  <View style={styles.banksGrid}>
                    {dummyBanks.map((bank, idx) => (
                      <TouchableOpacity key={idx} style={[styles.bankItem, { backgroundColor: colors.backgroundSecondary }]} onPress={handleFakePayment}>
                        <Image source={{ uri: bank.logo }} style={styles.bankLogo} />
                        <Text style={[styles.bankName, { color: colors.text }]} numberOfLines={1}>{bank.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity style={[styles.checkBtn, { backgroundColor: colors.primary }]} onPress={handleFakePayment} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator size="small" color={colors.headerText} /> : <Text style={[styles.checkBtnText, { color: colors.headerText }]}>Төлбөр шалгах</Text>}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  content: { flex: 1 },
  contentContainer: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 40 },
  jobSummaryCard: { borderRadius: 16, padding: 16, marginBottom: 18, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  jobSummaryLabel: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  jobTitle: { fontSize: 16, fontWeight: "700" },
  plansContainer: { gap: 12, marginBottom: 24 },
  planCard: { borderRadius: 16, padding: 16, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  planName: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  planDescription: { fontSize: 12, lineHeight: 18 },
  paymentBox: { borderRadius: 16, padding: 16, alignItems: "center", width: "100%" },
  boxTitle: { fontSize: 15, fontWeight: "700", marginBottom: 16 },
  qrContainer: { alignItems: "center", width: "100%" },
  dummyQr: { width: 180, height: 180, borderRadius: 12, padding: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
  banksSection: { width: "100%", marginTop: 20 },
  banksTitle: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  banksGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bankItem: { width: "48%", padding: 10, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  bankLogo: { width: 24, height: 24, borderRadius: 6 },
  bankName: { fontSize: 12, fontWeight: "600", flex: 1 },
  checkBtn: { width: "100%", height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 20 },
  checkBtnText: { fontSize: 14, fontWeight: "800" },
  successBox: { borderRadius: 16, padding: 24, alignItems: "center" },
  successTitle: { fontSize: 18, fontWeight: "800", marginTop: 12, marginBottom: 6 },
  successText: { fontSize: 13, textAlign: "center", marginBottom: 20 },
  doneBtn: { width: "100%", height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  doneBtnText: { fontSize: 14, fontWeight: "800" },
  bottomPadding: { height: 40 }
});