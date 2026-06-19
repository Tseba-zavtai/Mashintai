import { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ArrowLeft, Eye, EyeOff, LogIn, UserPlus, KeyRound } from "lucide-react-native";

import { TERMS_TEXT } from "@/constants/terms";
import { sendOtpSms } from "../Services/easycallSms";
import { generateOtpCode } from "../Services/utils/otp";

type OtpStage = "none" | "sent" | "verified";

export default function AuthScreen() {
  const router = useRouter();

  const auth = useAuth() as any;
  const login = auth.login as (phone: string, password: string) => Promise<void>;
  const register = auth.register as (phone: string, password: string) => Promise<void>;
  const resetPassword = auth.resetPassword as
    | ((phone: string, newPassword: string) => Promise<void>)
    | undefined;

  const { colors } = useTheme();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [otpStage, setOtpStage] = useState<OtpStage>("none");
  const [otpInput, setOtpInput] = useState("");
  const [sentOtp, setSentOtp] = useState<string | null>(null);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsScrolledToEnd, setTermsScrolledToEnd] = useState(false);

  const termsScrollRef = useRef<ScrollView | null>(null);

  const EASYCALL_API_KEY = "iFi4UFCDNUqhMd6i10DsiLuV0LY9DIHS";

  const normalizePhone8 = (raw: string) => raw.replace(/\D/g, "").slice(0, 8);

  const formatPhoneForAuth = (rawPhone: string) => `+976${normalizePhone8(rawPhone)}`;

  const resetOtpState = () => {
    setOtpStage("none");
    setOtpInput("");
    setSentOtp(null);
    setTermsAccepted(false);
    setShowTerms(false);
    setTermsScrolledToEnd(false);
  };

  const resetFormState = () => {
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    resetOtpState();
  };

  const validatePhone8 = (rawPhone: string) => {
    const p = normalizePhone8(rawPhone);
    const phoneRegex = /^\d{8}$/;

    if (!p) {
      Alert.alert("Алдаа", "Утасны дугаар оруулна уу");
      return null;
    }

    if (!phoneRegex.test(p)) {
      Alert.alert("Алдаа", "8 оронтой дугаар оруулна уу");
      return null;
    }

    return p;
  };

  const validatePasswordFields = () => {
    if (!password.trim()) {
      Alert.alert("Алдаа", isForgotPassword ? "Шинэ нууц үг оруулна уу" : "Нууц үг оруулна уу");
      return false;
    }

    if (!confirmPassword.trim()) {
      Alert.alert("Алдаа", "Нууц үг давтан оруулна уу");
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert("Алдаа", "Нууц үг таарахгүй байна");
      return false;
    }

    if (password.length < 6) {
      Alert.alert("Алдаа", "Нууц үг 6-аас дээш тэмдэгт байх ёстой");
      return false;
    }

    return true;
  };

  const handleSendOtp = async () => {
    const phone8 = validatePhone8(phone);
    if (!phone8) return;

    if (!EASYCALL_API_KEY) {
      Alert.alert("Алдаа", "EasyCall API Key тохируулаагүй байна");
      return;
    }

    const otp = generateOtpCode(6);

    setIsLoading(true);
    try {
      const resp = await sendOtpSms({
        apiKey: EASYCALL_API_KEY,
        phone: phone8,
        code: otp,
      });

      console.log("EasyCall response =>", resp);

      setSentOtp(otp);
      setOtpStage("sent");
      Alert.alert("Амжилттай", "Баталгаажуулах код илгээлээ");
    } catch (error: any) {
      Alert.alert("Алдаа", error?.message || "OTP илгээхэд алдаа гарлаа");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = () => {
    if (!sentOtp) {
      Alert.alert("Алдаа", "Эхлээд OTP илгээнэ үү");
      setOtpStage("none");
      return;
    }

    if (otpInput.trim().length !== 6) {
      Alert.alert("Алдаа", "6 оронтой OTP оруулна уу");
      return;
    }

    if (otpInput.trim() === sentOtp) {
      setOtpStage("verified");
      Alert.alert("Амжилттай", "OTP баталгаажлаа ✅");
    } else {
      Alert.alert("Алдаа", "OTP буруу байна");
    }
  };

  const handleLogin = async () => {
    const phone8 = validatePhone8(phone);
    if (!phone8) return;

    if (!password.trim()) {
      Alert.alert("Алдаа", "Нууц үг оруулна уу");
      return;
    }

    setIsLoading(true);
    try {
      await login(formatPhoneForAuth(phone8), password);
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Алдаа", error?.message || "Нэвтрэхэд алдаа гарлаа");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassword) {
      Alert.alert("Алдаа", "Нууц үг сэргээх функц одоохондоо холбогдоогүй байна");
      return;
    }

    const phone8 = validatePhone8(phone);
    if (!phone8) return;

    if (otpStage !== "verified") {
      Alert.alert("Алдаа", "Эхлээд OTP баталгаажуулна уу");
      return;
    }

    if (!validatePasswordFields()) return;

    setIsLoading(true);
    try {
      await resetPassword(formatPhoneForAuth(phone8), password);
      Alert.alert("Амжилттай", "Нууц үг амжилттай солигдлоо. Нэвтэрнэ үү", [
        {
          text: "За",
          onPress: () => {
            setIsForgotPassword(false);
            resetFormState();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert("Алдаа", error?.message || "Нууц үг сэргээхэд алдаа гарлаа");
    } finally {
      setIsLoading(false);
    }
  };

  const openTerms = () => {
    setTermsScrolledToEnd(false);
    setShowTerms(true);

    setTimeout(() => {
      termsScrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 50);
  };

  const handleSignUp = async () => {
    if (otpStage !== "verified") {
      Alert.alert("Алдаа", "Эхлээд OTP баталгаажуулна уу");
      return;
    }

    if (!termsAccepted) {
      Alert.alert("Алдаа", "Үйлчилгээний нөхцөлийг зөвшөөрнө үү");
      return;
    }

    const phone8 = validatePhone8(phone);
    if (!phone8) return;

    if (!validatePasswordFields()) return;

    setIsLoading(true);
    try {
      await register(formatPhoneForAuth(phone8), password);
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Алдаа", error?.message || "Бүртгүүлэхэд алдаа гарлаа");
    } finally {
      setIsLoading(false);
    }
  };

  const mainButtonText = isLoading
    ? "Түр хүлээнэ үү..."
    : isForgotPassword
    ? otpStage === "none"
      ? "Код илгээх"
      : otpStage === "sent"
      ? "Баталгаажуулах"
      : "Нууц үг солих"
    : isSignUp
    ? otpStage === "none"
      ? "Код илгээх"
      : otpStage === "sent"
      ? "Баталгаажуулах"
      : "Бүртгүүлэх"
    : "Нэвтрэх";

  const handleMainPress = () => {
    if (isForgotPassword) {
      if (otpStage === "none") {
        handleSendOtp();
        return;
      }

      if (otpStage === "sent") {
        handleVerifyOtp();
        return;
      }

      handleResetPassword();
      return;
    }

    if (!isSignUp) {
      handleLogin();
      return;
    }

    if (otpStage === "none") {
      handleSendOtp();
      return;
    }

    if (otpStage === "sent") {
      handleVerifyOtp();
      return;
    }

    handleSignUp();
  };

  const showOtpInput = (isSignUp || isForgotPassword) && otpStage === "sent";
  const showPasswordFields = !isSignUp && !isForgotPassword
    ? true
    : (isSignUp || isForgotPassword) && otpStage === "verified";

  const showConfirmPasswordField = (isForgotPassword || isSignUp) && otpStage === "verified";

  const isSignupFinalStep = isSignUp && otpStage === "verified" && !isForgotPassword;
  const isMainDisabled = isLoading || (isSignupFinalStep && !termsAccepted);

  const onTermsScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const paddingToBottom = 24;
    const reachedBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - paddingToBottom;

    if (reachedBottom && !termsScrolledToEnd) {
      setTermsScrolledToEnd(true);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
      edges={["top"]}
    >
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
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push("/(tabs)")}
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
                {isForgotPassword ? (
                  <KeyRound size={48} color={colors.text} strokeWidth={2} />
                ) : isSignUp ? (
                  <UserPlus size={48} color={colors.text} strokeWidth={2} />
                ) : (
                  <LogIn size={48} color={colors.text} strokeWidth={2} />
                )}
              </View>

              <Text style={[styles.title, { color: colors.text }]}>
                {isForgotPassword ? "Нууц үг сэргээх" : isSignUp ? "Бүртгүүлэх" : "Тавтай морилно уу"}
              </Text>

              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {isForgotPassword
                  ? otpStage === "verified"
                    ? "OTP баталгаажсан. Шинэ нууц үгээ оруулна уу"
                    : "Утасны дугаараа оруулаад OTP авна уу"
                  : isSignUp
                  ? otpStage === "verified"
                    ? "OTP баталгаажсан. Нууц үгээ үүсгэнэ үү"
                    : "Утасны дугаараа оруулаад OTP авна уу"
                  : "Үргэлжлүүлэхийн тулд нэвтэрнэ үү"}
              </Text>
            </View>

            <View style={styles.form}>
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
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderRightColor: colors.border,
                      },
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
                  />
                </View>
              </View>

              {showOtpInput && (
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: colors.text }]}>OTP код</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder="6 оронтой код"
                    placeholderTextColor={colors.textSecondary}
                    value={otpInput}
                    onChangeText={(t) => setOtpInput(t.replace(/\D/g, "").slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              )}

              {showPasswordFields && (
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    {isForgotPassword ? "Шинэ нууц үг" : "Нууц үг"}
                  </Text>

                  <View style={styles.passwordWrapper}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.passwordInput,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder={
                        isForgotPassword
                          ? "Шинэ нууц үг оруулах"
                          : isSignUp
                          ? "Нууц үг оруулах"
                          : "Нууц үг"
                      }
                      placeholderTextColor={colors.textSecondary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />

                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword((prev) => !prev)}
                      activeOpacity={0.7}
                    >
                      {showPassword ? (
                        <Eye size={20} color={colors.textSecondary} />
                      ) : (
                        <EyeOff size={20} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {showConfirmPasswordField && (
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    {isForgotPassword ? "Шинэ нууц үг давтах" : "Нууц үг давтах"}
                  </Text>

                  <View style={styles.passwordWrapper}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.passwordInput,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder={
                        isForgotPassword
                          ? "Шинэ нууц үг давтан оруулах"
                          : "Нууц үг давтан оруулах"
                      }
                      placeholderTextColor={colors.textSecondary}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                    />

                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowConfirmPassword((prev) => !prev)}
                      activeOpacity={0.7}
                    >
                      {showConfirmPassword ? (
                        <Eye size={20} color={colors.textSecondary} />
                      ) : (
                        <EyeOff size={20} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {isSignupFinalStep && (
                <View style={styles.termsRow}>
                  <Pressable
                    onPress={openTerms}
                    style={[
                      styles.checkbox,
                      {
                        borderColor: termsAccepted ? colors.primary : colors.border,
                        backgroundColor: termsAccepted ? colors.primary : "transparent",
                      },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: termsAccepted }}
                  >
                    {termsAccepted && <Text style={[styles.checkMark, { color: colors.text }]}>✓</Text>}
                  </Pressable>

                  <Text style={[styles.termsText, { color: colors.textSecondary }]}>
                    Би{" "}
                    <Text style={[styles.termsLink, { color: colors.text }]} onPress={openTerms}>
                      үйлчилгээний нөхцөл
                    </Text>
                    -ийг уншиж зөвшөөрч байна
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: colors.primary },
                  isMainDisabled && styles.buttonDisabled,
                ]}
                onPress={handleMainPress}
                disabled={isMainDisabled}
                activeOpacity={0.8}
              >
                <Text style={[styles.buttonText, { color: colors.headerText }]}>{mainButtonText}</Text>
              </TouchableOpacity>

              {!isForgotPassword && !isSignUp && (
                <TouchableOpacity
                  style={styles.forgotButton}
                  onPress={() => {
                    setIsForgotPassword(true);
                    setIsSignUp(false);
                    resetFormState();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.forgotButtonText, { color: colors.textSecondary }]}>
                    Нууц үгээ мартсан уу?
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => {
                  if (isForgotPassword) {
                    setIsForgotPassword(false);
                    setIsSignUp(false);
                    resetFormState();
                    return;
                  }

                  setIsSignUp((prev) => !prev);
                  setIsForgotPassword(false);
                  resetFormState();
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.switchButtonText, { color: colors.text }]}>
                  {isForgotPassword
                    ? "Нэвтрэх хуудас руу буцах"
                    : isSignUp
                    ? "Бүртгэлтэй юу? Нэвтрэх"
                    : "Бүртгэлгүй юу? Бүртгүүлэх"}
                </Text>
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                  Бүртгэл үүсгэхийн өмнө үйлчилгээний нөхцөлтэй танилцаж, зөвшөөрнө үү.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showTerms} animationType="slide" onRequestClose={() => setShowTerms(false)}>
        <SafeAreaView
          style={[styles.termsModal, { backgroundColor: colors.backgroundSecondary }]}
          edges={["top", "bottom"]}
        >
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
            <Text style={[styles.termsParagraph, { color: colors.textSecondary }]}>
              {TERMS_TEXT}
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.termsAcceptBtn,
              { backgroundColor: colors.primary },
              !termsScrolledToEnd && styles.termsAcceptDisabled,
            ]}
            onPress={() => {
              if (!termsScrolledToEnd) return;
              setTermsAccepted(true);
              setShowTerms(false);
            }}
            disabled={!termsScrolledToEnd}
            activeOpacity={0.85}
          >
            <Text style={[styles.termsAcceptText, { color: colors.text }]}>
              {termsScrolledToEnd ? "Зөвшөөрөх" : "Доош нь гүйлгээд үргэлжлүүлнэ үү"}
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