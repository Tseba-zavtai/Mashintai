import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Eye, EyeOff, ShieldCheck } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

const normalizePhone = (value: string) => value.replace(/\D/g, "").slice(0, 8);

export default function DanOnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { completeDanSignup } = useAuth() as any;
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const finishSignup = async () => {
    if (!/^\d{8}$/.test(phone)) {
      Alert.alert("Утасны дугаар", "8 оронтой утасны дугаараа оруулна уу.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Нууц үг", "Нууц үг дор хаяж 6 тэмдэгттэй байна.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Нууц үг", "Нууц үг давталт таарахгүй байна.");
      return;
    }

    setSaving(true);
    try {
      await completeDanSignup(`+976${phone}`, password);
      Alert.alert("Бүртгэл амжилттай", "Tureesly бүртгэл тань бэлэн боллоо.", [
        { text: "Үргэлжлүүлэх", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (error: any) {
      Alert.alert("Бүртгэлийг дуусгаж чадсангүй", error?.message || "Дахин оролдоно уу.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
            <ShieldCheck size={46} color={colors.buttonText} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Бүртгэлээ дуусгана уу</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            DAN-аар танигдлаа. Одоо холбоо барих утас болон Tureesly нууц үгээ нэг удаа тохируулна уу.
          </Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Үндсэн холбоо барих утас</Text>
              <View style={[styles.phoneBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[styles.prefix, { backgroundColor: colors.backgroundSecondary, borderRightColor: colors.border }]}>
                  <Text style={[styles.prefixText, { color: colors.text }]}>+976</Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={(value) => setPhone(normalizePhone(value))}
                  keyboardType="number-pad"
                  maxLength={8}
                  placeholder="9999 9999"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.phoneInput, { color: colors.text }]}
                />
              </View>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>Энэ дугаар нийтэд автоматаар харагдахгүй. Зар, түрээсийн хүсэлт дээр сонгох үед л ашиглана.</Text>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Tureesly нууц үг</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Дор хаяж 6 тэмдэгт"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                />
                <TouchableOpacity style={styles.eye} onPress={() => setShowPassword((value) => !value)}>
                  {showPassword ? <Eye size={20} color={colors.textSecondary} /> : <EyeOff size={20} color={colors.textSecondary} />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Нууц үг давтах</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  placeholder="Нууц үгээ дахин оруулна уу"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                />
                <TouchableOpacity style={styles.eye} onPress={() => setShowConfirmPassword((value) => !value)}>
                  {showConfirmPassword ? <Eye size={20} color={colors.textSecondary} /> : <EyeOff size={20} color={colors.textSecondary} />}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[styles.submit, { backgroundColor: colors.primary }, saving && styles.disabled]} onPress={finishSignup} disabled={saving} activeOpacity={0.84}>
              <Text style={[styles.submitText, { color: colors.buttonText }]}>{saving ? "Хадгалж байна..." : "Бүртгэлийг дуусгах"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 54, paddingBottom: 44 },
  iconCircle: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 24 },
  title: { fontSize: 30, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  subtitle: { fontSize: 16, lineHeight: 24, textAlign: "center", maxWidth: 360, alignSelf: "center" },
  form: { marginTop: 42, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "700" },
  phoneBox: { minHeight: 56, borderWidth: 2, borderRadius: 13, overflow: "hidden", flexDirection: "row", alignItems: "center" },
  prefix: { alignSelf: "stretch", paddingHorizontal: 16, borderRightWidth: 1, alignItems: "center", justifyContent: "center" },
  prefixText: { fontSize: 16, fontWeight: "700" },
  phoneInput: { flex: 1, fontSize: 16, paddingHorizontal: 16, paddingVertical: 14 },
  hint: { fontSize: 12, lineHeight: 18 },
  passwordWrap: { position: "relative" },
  input: { minHeight: 56, borderWidth: 2, borderRadius: 13, fontSize: 16, paddingHorizontal: 16, paddingRight: 50 },
  eye: { position: "absolute", right: 14, top: 17, padding: 3 },
  submit: { minHeight: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 6 },
  submitText: { fontSize: 16, fontWeight: "800" },
  disabled: { opacity: 0.6 },
});