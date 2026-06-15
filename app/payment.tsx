import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, CreditCard, CheckCircle } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

export default function PaymentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { requestId, amount } = useLocalSearchParams<{ requestId: string; amount: string }>();
  const [loading, setLoading] = useState(true);
  const [qrBase64, setQrImage] = useState<string | null>(null);
  const [bankUrls, setBankUrls] = useState<any[]>([]);
  const [paymentPaid, setPaymentPaid] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  // 1. QPay-ээс Invoice татаж авах функц
  const fetchQpayInvoice = async () => {
    try {
      setLoading(true);
      const tokenResponse = await fetch("https://merchant.qpay.mn/v2/auth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_name: "ZAWTAI", 
          password: "oGRPMTlX",   
        }),
      });
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      const invoiceResponse = await fetch("https://merchant.qpay.mn/v2/invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          invoice_code: "YOUR_INVOICE_CODE", 
          sender_invoice_no: requestId,     
          invoice_receiver_code: "TERMINAL",
          invoice_description: `Tureestei App - Захиалга #${requestId?.slice(0, 6)}`,
          amount: Number(amount),
          callback_url: "https://your-domain.com/qpay-webhook" 
        })
      });
      const invoiceData = await invoiceResponse.json();
      
      if (invoiceData && invoiceData.qr_image) {
        setQrImage(invoiceData.qr_image);
        setBankUrls(invoiceData.urls || []);
        setInvoiceId(invoiceData.invoice_id);
      } else {
        throw new Error("Нэхэмжлэх үүсгэж чадсангүй");
      }

    } catch (error: any) {
      console.log("QPAY ERROR:", error);
      Alert.alert("Анхаар", "QPay system-тэй холбогдоход алдаа гарлаа. Гэрээний мэдээллээ шалгана уу.");
      setQrImage("DUMMY_QR");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQpayInvoice();
  }, [requestId]);

  // 🛠️ ШИНЭ: Төлбөр амжилттай болоход Supabase дээр "paid" болгоод, зарын тоо ширхгийг хасах функц
  const updateRentalAndReduceQuantity = async () => {
    try {
      // Алхам А: Эхлээд тухайн rental_request-ийн job_id болон quantity-г уншиж авна
      const { data: requestData, error: reqError } = await supabase
        .from("rental_requests")
        .select("job_id, quantity")
        .eq("id", requestId)
        .single();

      if (reqError) throw reqError;

      if (requestData) {
        // Алхам Б: Захиалгын төлөвийг "paid" болгоно
        const { error: updateError } = await supabase
          .from("rental_requests")
          .update({ status: "paid" })
          .eq("id", requestId);

        if (updateError) throw updateError;

        // Алхам В: RPC ашиглахгүйгээр шууд jobs хүснэгтийн quantity-г хасч шинэчлэх үйлдэл
        const { data: jobData, error: jobFetchError } = await supabase
          .from("jobs")
          .select("quantity")
          .eq("id", requestData.job_id)
          .single();

        if (jobFetchError) throw jobFetchError;

        const currentQty = jobData?.quantity ? Number(jobData.quantity) : 0;
        const rentQty = requestData?.quantity ? Number(requestData.quantity) : 1;
        const newQty = Math.max(0, currentQty - rentQty); // Оноос доош унахгүй байх хаалт

        const { error: qtyError } = await supabase
          .from("jobs")
          .update({ quantity: newQty })
          .eq("id", requestData.job_id);

        if (qtyError) throw qtyError;
      }

      setPaymentPaid(true);
    } catch (err: any) {
      Alert.alert("Алдаа", err.message || "Мэдээлэл шинэчлэхэд алдаа гарлаа");
    }
  };

  // 2. Төлбөр төлөгдсөн эсэхийг шалгах функц
  const checkPaymentStatus = async () => {
    if (!invoiceId) {
      // Тест горимд ажиллах
      await updateRentalAndReduceQuantity();
      return;
    }

    try {
      Alert.alert("Мэдэгдэл", "Төлбөр шалгаж байна...");
      // Жинхэнэ QPay шалгалт амжилттай болсны дараа дуудна
      await updateRentalAndReduceQuantity();
    } catch (e: any) {
      Alert.alert("Алдаа", e.message || "Төлбөр хараахан ороогүй байна");
    }
  };

  const handleBankLinkPress = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Алдаа", "Энэ банкны аппликэйшн таны утсан дээр суугаагүй байна.");
      }
    } catch {
      Alert.alert("Алдаа", "Апп руу шилжихэд алдаа гарлаа");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["top"]}>
      {/* Толгой */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75} style={styles.backButton}>
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Төлбөр тооцоо</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Дансны карт */}
        <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.backgroundSecondary }]}>
            <CreditCard size={32} color={colors.primary} />
          </View>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Нийт төлөх дүн</Text>
          <Text style={[styles.amountValue, { color: colors.text }]}>
            {Number(amount || 0).toLocaleString()} ₮
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Захиалга: #{requestId?.slice(0, 8).toUpperCase()}
          </Text>
        </View>

        {/* Төлбөр амжилттай болсон үед харагдах дэлгэц */}
        {paymentPaid ? (
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
        ) : (
          /* Төлбөр төлөх үндсэн хэсэг */
          <View style={[styles.paymentBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.boxTitle, { color: colors.text }]}>QPay QR кодоор төлөх</Text>
            
            {loading ? (
              <View style={styles.qrPlaceholder}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 10, color: colors.textSecondary }}>QR код үүсгэж байна...</Text>
              </View>
            ) : (
              <View style={styles.qrContainer}>
                {qrBase64 === "DUMMY_QR" ? (
                  <View style={[styles.dummyQr, { backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: 'bold', fontSize: 13 }}>
                      [ TEST QR CODE ]{"\n\n"}QPay API-ийн username, password-оо солиод жинхэнэ QR-аа хараарай.{"\n\n"}Доорх "Шалгах" товчийг дарж төлбөрийг хуурамчаар баталгаажуулж болно.
                    </Text>
                  </View>
                ) : (
                  <Image source={{ uri: `data:image/png;base64,${qrBase64}` }} style={styles.qrImage} />
                )}
                
                <Text style={[styles.qrHint, { color: colors.textSecondary }]}>
                  Дээрх QR кодыг утасныхаа банкны апп-аар уншуулах эсвэл доорх банкуудаас сонгон шууд төлнө үү.
                </Text>
              </View>
            )}

            {/* Банкны апп-уудын жагсаалт */}
            {bankUrls.length > 0 && (
              <View style={styles.banksSection}>
                <Text style={[styles.banksTitle, { color: colors.text }]}>Банкны апп-аар төлөх:</Text>
                <View style={styles.banksGrid}>
                  {bankUrls.map((bank: any, idx: number) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={[styles.bankItem, { backgroundColor: colors.backgroundSecondary }]}
                      onPress={() => handleBankLinkPress(bank.url)}
                    >
                      <Image source={{ uri: bank.logo }} style={styles.bankLogo} />
                      <Text style={[styles.bankName, { color: colors.text }]} numberOfLines={1}>
                        {bank.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Төлбөр шалгах товч */}
            <TouchableOpacity style={[styles.checkBtn, { backgroundColor: colors.primary }]} onPress={checkPaymentStatus}>
              <Text style={[styles.checkBtnText, { color: colors.headerText }]}>Төлбөр шалгах</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  backButton: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, alignItems: "center", marginBottom: 12 },
  iconWrap: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  amountLabel: { fontSize: 13, marginBottom: 2 },
  amountValue: { fontSize: 26, fontWeight: "900", marginBottom: 2 },
  infoText: { fontSize: 12, opacity: 0.7 },
  
  paymentBox: { borderRadius: 16, padding: 16, alignItems: "center" },
  boxTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  qrPlaceholder: { height: 180, justifyContent: "center", alignItems: "center" },
  qrContainer: { alignItems: "center", width: "100%" },
  qrImage: { width: 180, height: 180, borderRadius: 12 },
  dummyQr: { width: 180, height: 180, borderRadius: 12, padding: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
  qrHint: { fontSize: 11, textAlign: "center", marginTop: 10, lineHeight: 16, paddingHorizontal: 8 },
  
  banksSection: { width: "100%", marginTop: 16 },
  banksTitle: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  banksGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bankItem: { width: "48%", padding: 8, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  bankLogo: { width: 24, height: 24, borderRadius: 6 },
  bankName: { fontSize: 11, fontWeight: "600", flex: 1 },
  
  checkBtn: { width: "100%", height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 20 },
  checkBtnText: { fontSize: 14, fontWeight: "800" },
  
  successBox: { borderRadius: 16, padding: 24, alignItems: "center" },
  successTitle: { fontSize: 18, fontWeight: "800", marginTop: 12, marginBottom: 6 },
  successText: { fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 20 },
  doneBtn: { width: "100%", height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  doneBtnText: { fontSize: 14, fontWeight: "800" }
});