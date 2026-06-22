// app/payment.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, CheckCircle } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

export default function PaymentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { requestId, amount } = useLocalSearchParams<{ requestId: string; amount: string }>();
  
  const [step, setStep] = useState<"info" | "invoice" | "success">("info");
  const [loading, setLoading] = useState(false);

  const dummyBanks = [
    { name: "Хаан Банк", logo: "https://r2-pub.rork.com/attachments/7h0ju4xu59gyen0tzh8ns" },
    { name: "Голомт Банк", logo: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/0rqqd3riktgmfxudfl0s8" },
    { name: "Төрийн Банк", logo: "https://r2-pub.rork.com/attachments/7h0ju4xu59gyen0tzh8ns" },
    { name: "ХАС Банк", logo: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/0rqqd3riktgmfxudfl0s8" }
  ];

  const handleGenerateInvoice = () => {
    setLoading(true);
    setTimeout(() => {
      setStep("invoice");
      setLoading(false);
    }, 800);
  };

  const updateRentalToPaid = async () => {
    try {
      setLoading(true);
      const { error: updateError } = await supabase
        .from("rental_requests")
        .update({ status: "paid" })
        .eq("id", requestId);

      if (updateError) throw updateError;
      setStep("success");
    } catch (err: any) {
      console.error("SUPABASE UPDATE ERROR:", err);
      Alert.alert("Алдаа", err.message || "Төлбөрийн төлөвийг шинэчлэхэд алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    // 🎯 ЗАСВАР: Alert устгаж, оронд нь loading state ашигласан (Гацалт байхгүй болно)
    setLoading(true);
    setTimeout(() => {
      updateRentalToPaid();
    }, 1500);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75} style={styles.backButton}>
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Төлбөр төлөлт</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === "info" && (
          <View style={styles.stepContainer}>
            <View style={[styles.summaryCard, { backgroundColor: colors.background }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Төлбөр</Text>
              <Text style={[styles.summaryPrice, { color: colors.text }]}>
                {Number(amount || 0).toLocaleString()}₮
              </Text>
              <Text style={[styles.summaryDesc, { color: colors.textSecondary }]}>Захиалга: #{requestId?.slice(0, 8).toUpperCase()}</Text>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Төлбөрийн аргаа сонгоно уу</Text>
            
            <TouchableOpacity 
              style={[styles.qpayBtn, { backgroundColor: colors.background }]} 
              activeOpacity={0.8}
              onPress={handleGenerateInvoice}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <View style={styles.qpayLogoWrap}>
                    <Text style={styles.qpayLogoText}>Q<Text style={{color: '#00B45A'}}>Pay</Text></Text>
                  </View>
                  <Text style={[styles.qpayTitle, { color: colors.text }]}>QPay Mongolia</Text>
                  <Text style={[styles.qpaySub, { color: colors.textSecondary }]}>QPay-ээр төлбөрөө эхлүүлэх</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {step === "invoice" && (
          <View style={[styles.invoiceCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.invoiceTitle, { color: colors.text }]}>QPay invoice бэлэн боллоо</Text>
            <Text style={[styles.invoiceDesc, { color: colors.textSecondary }]}>
              QPay автоматаар нээгдэнэ. Хэрэв нээгдээгүй бол QR ашиглах эсвэл доорх товчоор гараар нээнэ үү.
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
                <TouchableOpacity key={idx} style={[styles.bankItem, { backgroundColor: colors.backgroundSecondary }]} onPress={checkPaymentStatus}>
                  <Image source={{ uri: bank.logo }} style={styles.bankLogo} />
                  <Text style={[styles.bankName, { color: colors.text }]} numberOfLines={1}>{bank.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.invoiceActions}>
              <TouchableOpacity style={[styles.actionBtnCheck, { backgroundColor: colors.backgroundSecondary }]} onPress={checkPaymentStatus} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.text} size="small" /> : <Text style={[styles.actionBtnCheckText, { color: colors.text }]}>↻ Төлөв шалгах</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtnClose, { backgroundColor: colors.backgroundSecondary }]} onPress={() => setStep("info")} disabled={loading}>
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
              Таны түрээсийн төлбөр амжилттай төлөгдлөө. Түрээслүүлэгч рүү мэдэгдэл илгээгдсэн.
            </Text>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={() => router.replace("/rental-requests")}>
              <Text style={[styles.doneBtnText, { color: colors.headerText }]}>Дуусгах</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  stepContainer: { gap: 20 },
  summaryCard: { borderRadius: 16, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  summaryLabel: { fontSize: 14, marginBottom: 8 },
  summaryPrice: { fontSize: 32, fontWeight: "900", marginBottom: 8 },
  summaryDesc: { fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginLeft: 4 },
  qpayBtn: { borderRadius: 16, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  qpayLogoWrap: { marginBottom: 12 },
  qpayLogoText: { fontSize: 42, fontWeight: "900", color: "#003366", letterSpacing: -1 },
  qpayTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
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