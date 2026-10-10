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
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CheckCircle, Check } from "lucide-react-native";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { callQPay, type QPayInvoice } from "@/lib/qpayPayments";
import AppHeader from "@/components/AppHeader"; // 🎯 НЭМСЭН: Нэгдсэн стандартын толгой

type SponsorPlan = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  credits?: number;
  description: string;
};

const ALL_PLANS: SponsorPlan[] = [
  { id: "credit", name: "Зар оруулах 1 эрх", price: 3000, durationDays: 0, credits: 1, description: "Та 3,000₮-өөр 1 удаагийн зар оруулах эрх авна." },
  { id: "credit2", name: "Зар оруулах 2 эрх", price: 5000, durationDays: 0, credits: 2, description: "2 эрхийн багц — 1,000₮ хэмнэнэ." },
  { id: "credit3", name: "Зар оруулах 3 эрх", price: 7000, durationDays: 0, credits: 3, description: "3 эрхийн багц — 2,000₮ хэмнэнэ." },
  { id: "bump", name: "Зараа дээш гаргах", price: 1000, durationDays: 0, description: "Зараа нэг удаа жагсаалтын эхэнд гаргана. Үүний дараа шинээр нэмэгдсэн эсвэл дээшлүүлсэн зарууд таны зарын өмнө гарна." },
  { id: "daily", name: "1 хоног", price: 4500, durationDays: 1, description: "Та өөрийн нийтэлсэн зараа Sponsored зар болгон 1 хоногийн турш заруудын эхэнд болон хайлтын эхэнд санал болгон харагдуулах боломжтой" },
  { id: "weekly", name: "7 хоног", price: 21000, durationDays: 7, description: "Та өөрийн нийтэлсэн зараа Sponsored зар болгон 7 хоногийн турш заруудын эхэнд болон хайлтын эхэнд санал болгон харагдуулах боломжтой" },
  { id: "monthly", name: "30 хоног", price: 45000, durationDays: 30, description: "Та өөрийн нийтэлсэн зараа Sponsored зар болгон 30 хоногийн турш заруудын эхэнд болон хайлтын эхэнд санал болгон харагдуулах боломжтой" },
];


export default function SponsorPaymentScreen() {
  const router = useRouter();
  const { jobId, jobIds: idsParam, targetType } = useLocalSearchParams<{ jobId?: string; jobIds?: string; targetType?: "bump" | "sponsor" | "credit" }>();
  const selectedIds = useMemo(() => idsParam ? idsParam.split(',').filter(Boolean) : jobId ? [jobId] : [], [idsParam,jobId]);
  const multiplier = targetType === 'credit' ? 1 : selectedIds.length;
  const { jobs, loadJobs } = useJobs() as any;
  const { user, refetchProfile } = useAuth() as any;
  const { colors } = useTheme();
  const [step, setStep] = useState<"info" | "invoice" | "success">("info");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoice, setInvoice] = useState<QPayInvoice | null>(null);
  const [pendingPayment, setPendingPayment] = useState<{invoice:QPayInvoice;planId:string} | null>(null);
  const busy = useRef(false);
  const refreshers = useRef({refetchProfile,loadJobs});
  refreshers.current = {refetchProfile,loadJobs};
  const storageKey = user?.id ? `qpay-pending:${user.id}:${targetType}:${selectedIds.slice().sort().join(',') || 'credit'}` : null;


  useEffect(() => {
    if (targetType === "bump") setSelectedPlan("bump");
    else if (targetType === "credit") setSelectedPlan("credit");
    else setSelectedPlan("daily");
  }, [targetType]);

  useEffect(() => {
    let mounted = true;
    setStep('info'); setPendingPayment(null); setInvoice(null);
    if (storageKey) AsyncStorage.getItem(storageKey).then(async value => {
      if (!mounted || !value) return;
      try {
        const saved = JSON.parse(value);
        if (saved.invoice?.orderId && saved.planId) {
          const status=await callQPay<{paid:boolean;cancelled?:boolean}>({action:'status',orderId:saved.invoice.orderId});
          if (!mounted) return;
          if(status.paid || status.cancelled) {
            await AsyncStorage.removeItem(storageKey);
            await Promise.allSettled([refreshers.current.refetchProfile?.(),refreshers.current.loadJobs?.()]);
          } else setPendingPayment(saved);
        }
      } catch {
        // Keep an unconfirmed invoice accessible; never assume a network error means paid.
        if(mounted) {
          try {const saved=JSON.parse(value);if(saved.invoice?.orderId && saved.planId) setPendingPayment(saved);} catch { /* Invalid local data. */ }
        }
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [storageKey]);

  const selectedPlanData = useMemo(() => ALL_PLANS.find((p) => p.id === selectedPlan) ?? null, [selectedPlan]);
  const selectedJob = useMemo(() => (jobs as any[]).find((j) => String(j?.id) === String(jobId)) ?? null, [jobs, jobId]);
  const screenTitle = "Төлбөр төлөлт";
  const cancelInvoice = (target:QPayInvoice) => Alert.alert('Нэхэмжлэл цуцлах','Энэ төлбөрийг хийхээ болих уу? Төлбөр аль хэдийн орсон бол цуцлахгүй, үйлчилгээг баталгаажуулна.',[
    {text:'Буцах',style:'cancel'}, {text:'Цуцлах',style:'destructive',onPress:async()=>{
      if(busy.current) return;
      busy.current=true;setIsSubmitting(true);
      try {
        const result=await callQPay<{paid:boolean;cancelled:boolean}>({action:'cancel',orderId:target.orderId});
        if(!result.paid && !result.cancelled) throw new Error('Цуцлалт баталгаажаагүй. Дахин оролдоно уу.');
        if(storageKey) await AsyncStorage.removeItem(storageKey);
        setPendingPayment(null);setInvoice(null);setStep('info');
        if(result.paid) {
          await Promise.allSettled([refetchProfile?.(),loadJobs?.()]);
          Alert.alert('Төлбөр орсон байна','Таны төлбөр баталгаажиж, эрх/үйлчилгээ нэмэгдсэн. Нэхэмжлэлийг цуцлаагүй.');
        } else Alert.alert('Цуцлагдлаа','Нэхэмжлэл цуцлагдсан. Шинэ багц сонгож болно.');
      } catch(e:any) {Alert.alert('Цуцалж чадсангүй',e.message);}
      finally {busy.current=false;setIsSubmitting(false);}
    }}]);


  const handleGenerateInvoice = async () => {
    if (!selectedPlanData || busy.current) return;
    if (!user?.id) { Alert.alert('Төлбөр','Эхлээд нэвтэрнэ үү.'); return; }
    busy.current = true;
    setIsSubmitting(true);
    try {
      const data=await callQPay<QPayInvoice>({action:'create',planId:selectedPlanData.id,jobIds:selectedIds});
      if (!data?.orderId || !data.qr_image) throw new Error('Нэхэмжлэл үүсгэж чадсангүй.');
      setInvoice(data); setStep("invoice");
      setPendingPayment({invoice:data,planId:selectedPlanData.id});
      if (storageKey) await AsyncStorage.setItem(storageKey,JSON.stringify({invoice:data,planId:selectedPlanData.id})).catch(() => {});
    } catch(error:any) { Alert.alert("Төлбөр",error.message); }
    finally { busy.current=false; setIsSubmitting(false); }
  };


  const checkPaymentStatus = useCallback(async (silent = false) => {
    if (!invoice || busy.current) return;
    busy.current=true;
    setIsSubmitting(true);
    try {
      const data=await callQPay<{paid:boolean;cancelled?:boolean}>({action:"status",orderId:invoice.orderId});
      if(data.cancelled) {
        if(storageKey) await AsyncStorage.removeItem(storageKey);
        setInvoice(null);setPendingPayment(null);setStep('info');return;
      }
      if(!data?.paid) { if(!silent) Alert.alert("Төлбөр","Төлбөрийн баталгаажуулалт хараахан ирээгүй байна. Төлсний дараа дахин шалгана уу."); return; }
      setStep("success");
      setPendingPayment(null);
      if(storageKey) await AsyncStorage.removeItem(storageKey).catch(() => {});
      await Promise.allSettled([refetchProfile?.(),loadJobs?.()]);
    } catch(error:any) { if(!silent) Alert.alert("Төлбөр",error.message); }
    finally { busy.current=false; setIsSubmitting(false); }
  }, [invoice,storageKey,refetchProfile,loadJobs]);

  useEffect(() => {
    const subscription=AppState.addEventListener('change',state => {
      if(state === 'active' && step === 'invoice') void checkPaymentStatus(true);
    });
    return () => subscription.remove();
  }, [checkPaymentStatus,step]);

  return (
    // 🎯 ЗАССАН: AppHeader дотор утасны цагны зай (insets.top) тооцоолсон тул эндээс edges=["top"] хэсгийг "bottom" болгож өөрчиллөө
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* 🎯 ЗАССАН: Бидний шинээр хийсэн стандартын толгойг дуудсан */}
      <AppHeader title={screenTitle} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {step === "info" && (
          <View style={styles.stepContainer}>
            {pendingPayment && <View style={[styles.jobSummaryCard,{backgroundColor:colors.background}]}>
              <Text style={{color:colors.text}}>Өмнөх төлбөрийн нэхэмжлэл байна. Шинээр төлөхөөс өмнө төлөвийг нь шалгаж болно.</Text>
              <TouchableOpacity accessibilityRole="button" disabled={isSubmitting} style={[styles.actionBtnClose,{backgroundColor:colors.backgroundSecondary,marginTop:10}]} onPress={()=>{setInvoice(pendingPayment.invoice);setSelectedPlan(pendingPayment.planId);setStep('invoice');}}>
                <Text style={{color:colors.text,fontWeight:'700'}}>Өмнөх төлбөрөө үргэлжлүүлэх · {pendingPayment.invoice.amount.toLocaleString()}₮</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" disabled={isSubmitting} style={[styles.actionBtnClose,{backgroundColor:colors.backgroundSecondary,marginTop:8}]} onPress={()=>cancelInvoice(pendingPayment.invoice)}>
                {isSubmitting ? <ActivityIndicator color="#EF4444"/> : <Text style={{color:'#EF4444',fontWeight:'700'}}>Нэхэмжлэл цуцлах</Text>}
              </TouchableOpacity>
            </View>}
            {targetType !== 'credit' && <Text style={{color:colors.text}}>Сонгосон: {selectedIds.length} зар. Төлбөр баталгаажихад зарын хугацаа 30 хоногоор шинэчлэгдэнэ. Зарын эрх хасагдахгүй.</Text>}
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
                  if (targetType === "credit") return p.id.startsWith("credit");
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
                      <Text style={[styles.planPrice, { color: "#6E0AB0" }]}>{(plan.price * multiplier).toLocaleString()}₮</Text>
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
                    {(selectedPlanData.price * multiplier).toLocaleString()}₮
                  </Text>
                  <Text style={[styles.summaryDesc, { color: colors.textSecondary }]}>Хугацаа: {selectedPlanData.name}</Text>
                </View>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>Төлбөрийн аргаа сонгоно уу</Text>
                
                <View style={{ gap: 12 }}>

                  <TouchableOpacity 
                    style={[styles.qpayBtn, { backgroundColor: colors.background }]} 
                    activeOpacity={0.8}
                    onPress={handleGenerateInvoice}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <>
                        <View style={styles.qpayLogoWrap}>
                           <Text style={styles.qpayLogoText}>Q<Text style={{color: '#00B45A'}}>Pay</Text></Text>
                        </View>
                        <Text style={[styles.qpayTitle, { color: colors.text }]}>QPay Mongolia</Text>
                        <Text style={[styles.qpaySub, { color: colors.textSecondary }]}>Банкны апп ашиглан төлөх</Text>
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
              {invoice?.qr_image && <Image source={{uri:`data:image/png;base64,${invoice.qr_image}`}} style={{width:220,height:220}} />}
            </View>

            <View style={styles.banksGrid}>
              {(invoice?.urls ?? []).map((bank, idx) => (
                <TouchableOpacity key={idx} style={[styles.bankItem, { backgroundColor: colors.backgroundSecondary }]} onPress={() => Linking.openURL(bank.link).catch(() => Alert.alert("Банкны апп","Аппаа суулгасан эсэхийг шалгана уу."))} disabled={isSubmitting}>
                  <Image source={{ uri: bank.logo }} style={styles.bankLogo} />
                  <Text style={[styles.bankName, { color: colors.text }]} numberOfLines={1}>{bank.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.invoiceActions}>
              <TouchableOpacity style={[styles.actionBtnCheck, { backgroundColor: colors.backgroundSecondary }]} onPress={() => checkPaymentStatus()} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color={colors.text} size="small" /> : <Text style={[styles.actionBtnCheckText, { color: colors.text }]}>↻ Төлөв шалгах</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtnClose, { backgroundColor: colors.backgroundSecondary }]} onPress={() => setStep("info")} disabled={isSubmitting}>
                <Text style={[styles.actionBtnCloseText, { color: colors.text }]}>Хаах</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity accessibilityRole="button" disabled={isSubmitting || !invoice} style={[styles.actionBtnClose,{backgroundColor:colors.backgroundSecondary,marginTop:12}]} onPress={()=>invoice && cancelInvoice(invoice)}>
              <Text style={{color:'#EF4444',fontWeight:'700'}}>Нэхэмжлэл цуцлах</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === "success" && (
          <View style={[styles.successBox, { backgroundColor: colors.background }]}>
            <CheckCircle size={64} color="#34C759" />
            <Text style={[styles.successTitle, { color: colors.text }]}>Төлбөр амжилттай!</Text>
            <Text style={[styles.successText, { color: colors.textSecondary }]}>
               {targetType === "credit" ? `Таны зарын эрх амжилттай ${selectedPlanData?.credits ?? 1}-ээр нэмэгдлээ.` : "Үйлчилгээ амжилттай идэвхжлээ."}
            </Text>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={() => router.replace(targetType === "credit" ? "/profile" : "/my-jobs")}>
              <Text style={[styles.doneBtnText, { color: colors.buttonText }]}>Дуусгах</Text>
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
  successText: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  mockReceiptCard: { width: "100%", borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 24, gap: 6 },
  mockReceiptTitle: { fontSize: 14, fontWeight: "800" },
  mockReceiptNumber: { fontSize: 15, fontWeight: "800" },
  mockReceiptService: { fontSize: 13, marginBottom: 4 },
  mockReceiptRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mockReceiptLabel: { fontSize: 13 },
  mockReceiptValue: { fontSize: 13, fontWeight: "700" },
  mockReceiptTotal: { fontSize: 14, fontWeight: "800" },
  mockReceiptNote: { fontSize: 11, lineHeight: 16, marginTop: 5 },
  doneBtn: { width: "100%", height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  doneBtnText: { fontSize: 15, fontWeight: "800" }
});
