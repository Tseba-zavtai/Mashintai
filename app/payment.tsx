import React, { useEffect, useState } from "react";
// ⬇️ Эндээс SafeAreaView-ийг хасаад, зөвхөн доорх хэдэн дүрсийг үлдээгээрэй
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, CreditCard, CheckCircle } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
// ⬇️ Энийг заавал тусад нь, хамгийн доор нь байлгаарай
import { SafeAreaView } from "react-native-safe-area-context";

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
      
      // БАКЭНД ЭСВЭЛ EDGE FUNCTION БАЙХГҮЙ ҮЕД ШУУД ТЕСТ ХИЙХЭД ЗОРИУЛСАН УРСГАЛ:
      // Алхам А: Эхлээд Token авна
      const tokenResponse = await fetch("https://merchant.qpay.mn/v2/auth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Өөрийн QPay хөгжүүлэгчийн эрхээр Хэрэв Basic Auth ашигладаг бол headers-д нэмнэ
        },
        body: JSON.stringify({
          user_name: "ZAWTAI", // Өөрийн QPay нэрийг тавина
          password: "oGRPMTlX",   // Өөрийн QPay нууц үгийг тавина
        }),
      });
      
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Алхам Б: Нэхэмжлэх үүсгэнэ
      const invoiceResponse = await fetch("https://merchant.qpay.mn/v2/invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          invoice_code: "YOUR_INVOICE_CODE", // QPay-ээс өгсөн код
          sender_invoice_no: requestId,     // Манай захиалгын ID
          invoice_receiver_code: "TERMINAL",
          invoice_description: `Tureestei App - Захиалга #${requestId?.slice(0, 6)}`,
          amount: Number(amount),
          callback_url: "https://your-domain.com/qpay-webhook" // Төлбөр төлөгдөхөд дуудах линк
        })
      });

      const invoiceData = await invoiceResponse.json();
      
      if (invoiceData && invoiceData.qr_image) {
        setQrImage(invoiceData.qr_image);       // QR код (Base64 форматтай ирдэг)
        setBankUrls(invoiceData.urls || []);     // Банкны апп-уудын линк
        setInvoiceId(invoiceData.invoice_id);   // Төлбөр шалгахад хэрэгтэй ID
      } else {
        throw new Error("Нэхэмжлэх үүсгэж чадсангүй");
      }

    } catch (error: any) {
      console.log("QPAY ERROR:", error);
      Alert.alert("Анхаар", "QPay системтэй холбогдоход алдаа гарлаа. Гэрээний мэдээллээ шалгана уу.");
      // Тест хийж байгаа тул алдаа гарсан ч хуурамч QR харуулж турших:
      setQrImage("DUMMY_QR"); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQpayInvoice();
  }, [requestId]);

  // 2. Төлбөр төлөгдсөн эсэхийг шалгах функц
  const checkPaymentStatus = async () => {
    if (!invoiceId) {
      // Хэрэв QPay холбогдоогүй бол хуурамчаар "Төлөгдсөн" болгож тест хийх
      setPaymentPaid(true);
      return;
    }

    try {
      // Энд QPay-ийн v2/payment/check хаяг руу хандаж шалгана
      Alert.alert("Мэдээлэл", "Төлбөр шалгаж байна...");
      setPaymentPaid(true); // Тест амжилттай боллоо гэж үзэх
    } catch (e) {
      Alert.alert("Алдаа", "Төлбөр хараахан ороогүй байна");
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
              <Text style={styles.doneBtnText}>Дуусгах</Text>
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
                    <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: 'bold' }}>
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
              <Text style={styles.checkBtnText}>Төлбөр шалгах</Text>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backButton: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  content: { flex: 1, padding: 20 },
  card: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: "center", marginBottom: 16 },
  iconWrap: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  amountLabel: { fontSize: 13, marginBottom: 4 },
  amountValue: { fontSize: 28, fontWeight: "900", marginBottom: 4 },
  infoText: { fontSize: 12, opacity: 0.8 },
  
  paymentBox: { borderRadius: 16, padding: 20, alignItems: "center" },
  boxTitle: { fontSize: 16, fontWeight: "700", marginBottom: 16 },
  qrPlaceholder: { height: 200, justifyContent: "center", alignItems: "center" },
  qrContainer: { alignItems: "center", width: "100%" },
  qrImage: { width: 200, height: 200, borderRadius: 12 },
  dummyQr: { width: 220, height: 220, borderRadius: 12, padding: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
  qrHint: { fontSize: 12, textAlign: "center", marginTop: 14, lineHeight: 18, paddingHorizontal: 10 },
  
  banksSection: { width: "100%", marginTop: 20 },
  banksTitle: { fontSize: 14, fontWeight: "700", marginBottom: 12 },
  banksGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  bankItem: { width: "48%", padding: 10, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  bankLogo: { width: 28, height: 28, borderRadius: 6 },
  bankName: { fontSize: 12, fontWeight: "600", flex: 1 },
  
  checkBtn: { width: "100%", height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 24 },
  checkBtnText: { fontSize: 15, fontWeight: "800", color: "#111" },
  
  successBox: { borderRadius: 16, padding: 30, alignItems: "center" },
  successTitle: { fontSize: 20, fontWeight: "800", marginTop: 16, marginBottom: 8 },
  successText: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  doneBtn: { width: "100%", height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  doneBtnText: { fontSize: 15, fontWeight: "800", color: "#111" }
});