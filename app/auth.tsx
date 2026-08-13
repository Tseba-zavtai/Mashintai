// app/auth.tsx
import { useRef, useState, useEffect, useCallback } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ArrowLeft, Eye, EyeOff, LogIn, KeyRound, ShieldCheck } from "lucide-react-native";
import { supabase } from "@/lib/supabase"; // 🎯 НЭМСЭН: Supabase холболт


type DanAuthResult = { needsOnboarding?: boolean };

export default function AuthScreen() {
  const router = useRouter();
  const auth = useAuth() as any;
  const login = auth.login as (phone: string, password: string) => Promise<void>;
  const signInWithDan = auth.signInWithDan as () => Promise<DanAuthResult>;
  const signUpWithDan = auth.signUpWithDan as () => Promise<DanAuthResult>;
  const logout = auth.logout as () => Promise<void>;
  const { colors } = useTheme();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [danResetVerified, setDanResetVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsScrolledToEnd, setTermsScrolledToEnd] = useState(false);
  const [termsText, setTermsText] = useState<string>("");
  const [loadingTerms, setLoadingTerms] = useState(false);
  const termsScrollRef = useRef<ScrollView | null>(null);

  const fetchTermsFromDB = useCallback(async () => {
    try {
      setLoadingTerms(true);
      const { data, error } = await supabase
        .from("legal_docs")
        .select("content")
        .eq("doc_type", "terms")
        .single();

      if (error) throw error;
      setTermsText(data?.content ?? "");
    } catch (error) {
      console.log("Error fetching terms in auth screen:", error);
      setTermsText("Үйлчилгээний нөхцөл уншихад алдаа гарлаа. Та интернэт холболтоо шалгана уу.");
    } finally {
      setLoadingTerms(false);
    }
  }, []);

  useEffect(() => {
    void fetchTermsFromDB();
  }, [fetchTermsFromDB]);

  const normalizePhone8 = (raw: string) => raw.replace(/\D/g, "").slice(0, 8);
  const formatPhoneForAuth = (rawPhone: string) => `+976${normalizePhone8(rawPhone)}`;

  const resetFormState = () => {
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setDanResetVerified(false);
  };

  const validatePhone8 = (rawPhone: string) => {
    const normalized = normalizePhone8(rawPhone);
    if (!normalized) {
      Alert.alert("Алдаа", "Утасны дугаар оруулна уу.");
      return null;
    }
    if (!/^\d{8}$/.test(normalized)) {
      Alert.alert("Алдаа", "8 оронтой утасны дугаар оруулна уу.");
      return null;
    }
    return normalized;
  };

  const validateNewPassword = () => {
    if (!password.trim()) {
      Alert.alert("Алдаа", "Шинэ нууц үг оруулна уу.");
      return false;
    }
    if (password.length < 6) {
      Alert.alert("Алдаа", "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой.");
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert("Алдаа", "Нууц үг таарахгүй байна.");
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    const phone8 = validatePhone8(phone);
    if (!phone8) return;
    if (!password.trim()) {
      Alert.alert("Алдаа", "Нууц үг оруулна уу.");
      return;
    }

    setIsLoading(true);
    try {
      await login(formatPhoneForAuth(phone8), password);
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Нэвтрэх боломжгүй", error?.message || "Дахин оролдоно уу.");
    } finally {
      setIsLoading(false);
    }
  };

  const startDanSignUp = async () => {
    setIsLoading(true);
    try {
      const result = await signUpWithDan();
      router.replace((result.needsOnboarding ? "/dan-onboarding" : "/(tabs)") as any);
    } catch (error: any) {
      Alert.alert("DAN бүртгэл", error?.message || "DAN-аар бүртгүүлэхэд алдаа гарлаа.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDanPasswordResetVerification = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithDan();
      if (result.needsOnboarding) {
        router.replace("/dan-onboarding" as any);
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setDanResetVerified(true);
    } catch (error: any) {
      Alert.alert("DAN баталгаажуулалт", error?.message || "DAN-аар баталгаажуулахад алдаа гарлаа.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDanPasswordReset = async () => {
    if (!danResetVerified || !validateNewPassword()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      Alert.alert("Амжилттай", "Нууц үг амжилттай солигдлоо.", [
        {
          text: "Үргэлжлүүлэх",
          onPress: () => {
            setIsForgotPassword(false);
            resetFormState();
            router.replace("/(tabs)");
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert("Алдаа", error?.message || "Нууц үг солиход алдаа гарлаа.");
    } finally {
      setIsLoading(false);
    }
  };

  const openTerms = () => {
    setTermsScrolledToEnd(false);
    setShowTerms(true);
    setTimeout(() => termsScrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
  };

  const onTermsScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 24) {
      setTermsScrolledToEnd(true);
    }
  };

  const openForgotPassword = () => {
    resetFormState();
    setIsForgotPassword(true);
  };

  const closeForgotPassword = () => {
    const shouldSignOut = danResetVerified;
    setIsForgotPassword(false);
    resetFormState();
    if (shouldSignOut) void logout();
  };

  const renderPhoneInput = () => (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, { color: colors.text }]}>Утасны дугаар</Text>
      <View
        style={[
          styles.phoneInputWrapper,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.phonePrefix,
            { backgroundColor: colors.backgroundSecondary, borderRightColor: colors.border },
          ]}
        >
          <Text style={[styles.phonePrefixText, { color: colors.text }]}>+976</Text>
        </View>
        <TextInput
          style={[styles.phoneInput, { color: colors.text }]}
          placeholder="9999 9999"
          placeholderTextColor={colors.textSecondary}
          value={phone}
          onChangeText={(text) => setPhone(normalizePhone8(text))}
          keyboardType="number-pad"
          maxLength={8}
          textContentType="telephoneNumber"
        />
      </View>
    </View>
  );

  const renderPasswordInput = (confirm = false) => (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, { color: colors.text }]}>
        {confirm ? "Шинэ нууц үг давтах" : isForgotPassword ? "Шинэ нууц үг" : "Нууц үг"}
      </Text>
      <View style={styles.passwordWrapper}>
        <TextInput
          style={[
            styles.input,
            styles.passwordInput,
            { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
          ]}
          placeholder={confirm ? "Шинэ нууц үг давтан оруулах" : isForgotPassword ? "Шинэ нууц үг оруулах" : "Нууц үг"}
          placeholderTextColor={colors.textSecondary}
          value={confirm ? confirmPassword : password}
          onChangeText={confirm ? setConfirmPassword : setPassword}
          secureTextEntry={confirm ? !showConfirmPassword : !showPassword}
          textContentType={confirm ? "newPassword" : isForgotPassword ? "newPassword" : "password"}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => confirm ? setShowConfirmPassword((value) => !value) : setShowPassword((value) => !value)}
          activeOpacity={0.7}
        >
          {(confirm ? showConfirmPassword : showPassword) ? (
            <Eye size={20} color={colors.textSecondary} />
          ) : (
            <EyeOff size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.content}>
            <TouchableOpacity style={styles.backButton} onPress={() => isForgotPassword ? closeForgotPassword() : router.back()} activeOpacity={0.7}>
              <ArrowLeft size={24} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
                {isForgotPassword ? (
                  <KeyRound size={48} color={colors.buttonText} strokeWidth={2} />
                ) : (
                  <LogIn size={48} color={colors.buttonText} strokeWidth={2} />
                )}
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                {isForgotPassword ? "Нууц үг сэргээх" : "Тавтай морилно уу"}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {isForgotPassword
                  ? danResetVerified
                    ? "DAN баталгаажсан. Шинэ нууц үгээ тохируулна уу."
                    : "DAN-аар өөрийгөө баталгаажуулаад нууц үгээ шинэчилнэ үү."
                  : "Утасны дугаар, нууц үгээрээ нэвтэрнэ үү."}
              </Text>
            </View>

            <View style={styles.form}>
              {!isForgotPassword ? (
                <>
                  {renderPhoneInput()}
                  {renderPasswordInput()}

                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={() => void handleLogin()}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? <ActivityIndicator color={colors.buttonText} /> : <Text style={[styles.buttonText, { color: colors.buttonText }]}>Нэвтрэх</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.forgotButton} onPress={openForgotPassword} activeOpacity={0.75}>
                    <Text style={[styles.forgotButtonText, { color: colors.primary }]}>Нууц үг мартсан уу?</Text>
                  </TouchableOpacity>

                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  <View style={{ alignItems: "center", gap: 8 }}>
                    <Text style={[styles.legacyLinkText, { color: colors.textSecondary }]}>Шинэ хэрэглэгч үү?</Text>
                    <TouchableOpacity style={styles.danSignUpButton} onPress={openTerms} disabled={isLoading} activeOpacity={0.75}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <ShieldCheck size={19} color={colors.primary} />
                        <Text style={[styles.switchButtonText, { color: colors.primary }]}>DAN-аар бүртгүүлэх</Text>
                      </View>
                    </TouchableOpacity>
                    <Text style={[styles.danHint, { color: colors.textSecondary }]}>Эхлээд үйлчилгээний нөхцөлтэй танилцаж, дараа нь DAN-аар иргэний мэдээллээ баталгаажуулна.</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.legacyLinkButton}
                    onPress={() => Alert.alert(
                      "Хуучин account-аа DAN-тай холбох",
                      "Эхлээд утасны дугаар, нууц үгээрээ нэвтэрнэ үү. Дараа нь Profile → DAN-аар баталгаажуулах хэсгээс нэг удаа холбоно."
                    )}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.legacyLinkText, { color: colors.textSecondary }]}>Өмнөх Tureesly бүртгэлтэй юу?</Text>
                    <Text style={[styles.legacyLinkHint, { color: colors.primary }]}>Хуучин account-аа DAN-тай холбох</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {!danResetVerified ? (
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: colors.primary }]}
                      onPress={() => void handleDanPasswordResetVerification()}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {isLoading ? <ActivityIndicator color={colors.buttonText} /> : <ShieldCheck size={20} color={colors.buttonText} />}
                        <Text style={[styles.buttonText, { color: colors.buttonText }]}>DAN-аар баталгаажуулах</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <>
                      {renderPasswordInput()}
                      {renderPasswordInput(true)}
                      <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.primary }]}
                        onPress={() => void handleDanPasswordReset()}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        {isLoading ? <ActivityIndicator color={colors.buttonText} /> : <Text style={[styles.buttonText, { color: colors.buttonText }]}>Нууц үг шинэчлэх</Text>}
                      </TouchableOpacity>
                    </>
                  )}

                  <TouchableOpacity style={styles.forgotButton} onPress={closeForgotPassword} disabled={isLoading} activeOpacity={0.75}>
                    <Text style={[styles.forgotButtonText, { color: colors.textSecondary }]}>Нэвтрэх рүү буцах</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showTerms} animationType="slide" onRequestClose={() => setShowTerms(false)}>
        <SafeAreaView style={[styles.termsModal, { backgroundColor: colors.backgroundSecondary }]} edges={["top", "bottom"]}>
          <View style={styles.termsHeader}>
            <Text style={[styles.termsTitle, { color: colors.text }]}>Үйлчилгээний нөхцөл</Text>
            <TouchableOpacity onPress={() => setShowTerms(false)} activeOpacity={0.7}>
              <Text style={[styles.termsClose, { color: colors.text }]}>Хаах</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={termsScrollRef}
            contentContainerStyle={styles.termsBody}
            onScroll={onTermsScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator
          >
            {loadingTerms ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <ActivityIndicator color={colors.text} />
              </View>
            ) : (
              <Text style={[styles.termsParagraph, { color: colors.textSecondary }]}>
                {termsText || "Үйлчилгээний нөхцөл олдсонгүй."}
              </Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.termsAcceptBtn,
              { backgroundColor: colors.primary },
              (!termsScrolledToEnd || loadingTerms) && styles.termsAcceptDisabled,
            ]}
            onPress={() => {
              if (!termsScrolledToEnd || loadingTerms) return;
              setShowTerms(false);
              setTimeout(() => void startDanSignUp(), 0);
            }}
            disabled={!termsScrolledToEnd || loadingTerms}
            activeOpacity={0.85}
          >
            <Text style={[styles.termsAcceptText, { color: colors.buttonText }]}>
              {termsScrolledToEnd ? "Зөвшөөрөөд DAN-аар үргэлжлүүлэх" : "Доош нь гүйлгээд үргэлжлүүлнэ үү"}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 120 },
  content: { paddingHorizontal: 24, paddingTop: 40 },

  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  header: { alignItems: "center", marginBottom: 48 },

  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  title: { fontSize: 32, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  subtitle: { fontSize: 16, textAlign: "center", lineHeight: 24 },

  form: { gap: 24 },
  inputContainer: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },

  phoneInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
  },
  phonePrefix: { paddingHorizontal: 16, paddingVertical: 16, borderRightWidth: 1 },
  phonePrefixText: { fontSize: 16, fontWeight: "600" },
  phoneInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16 },

  input: {
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
  },

  passwordWrapper: { position: "relative" },
  passwordInput: { paddingRight: 48 },
  eyeButton: { position: "absolute", right: 16, top: 18, padding: 4 },

  switchButton: { paddingVertical: 12, alignItems: "center" },
  switchButtonText: { fontSize: 14, fontWeight: "600" },

  forgotButton: { paddingVertical: 8, alignItems: "center" },
  forgotButtonText: { fontSize: 14, fontWeight: "600" },

  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: "700" },

  danHint: { fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: -12 },
  divider: { height: 1, marginVertical: 4 },
  danSignUpButton: { paddingVertical: 4, alignItems: "center" },
  legacyHeading: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  legacyLinkButton: { marginTop: 14, alignItems: "center", paddingVertical: 10 },
  legacyLinkText: { fontSize: 13, fontWeight: "600" },
  legacyLinkHint: { fontSize: 14, fontWeight: "800", marginTop: 3 },
  legacyBackLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginBottom: 14 },
  legacyBackText: { fontSize: 14, fontWeight: "700" },
  legacyDescription: { fontSize: 13, lineHeight: 19, marginBottom: 18 },

  footer: { marginTop: 24 },
  footerText: { fontSize: 12, textAlign: "center", lineHeight: 18 },

  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
    textAlign: "center",
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  termsLink: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  termsModal: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "android" ? 24 : 0,
  },
  termsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 12,
  },
  termsTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  termsClose: {
    fontSize: 14,
    fontWeight: "700",
  },
  termsBody: {
    paddingBottom: 24,
  },
  termsParagraph: {
    fontSize: 14,
    lineHeight: 22,
  },
  termsAcceptBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  termsAcceptDisabled: {
    opacity: 0.55,
  },
  termsAcceptText: {
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
});
