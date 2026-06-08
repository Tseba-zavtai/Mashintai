// app/feedback.tsx
import React, { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import Constants from "expo-constants";
import { Send, X } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function FeedbackScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth() as any;

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const appVersion = useMemo(() => {
    // expo / native аль нь байгаагаас хамаараад аль болох олдоцоор нь
    const v1 = (Constants as any)?.expoConfig?.version;
    const v2 = (Constants as any)?.manifest?.version;
    const v3 = (Constants as any)?.nativeAppVersion;
    return v1 || v2 || v3 || null;
  }, []);

  const submit = async () => {
    try {
      const text = message.trim();
      if (!text) {
        Alert.alert("Алдаа", "Санал хүсэлтээ бичнэ үү");
        return;
      }
      if (text.length < 5) {
        Alert.alert("Алдаа", "Хэт богино байна. Дэлгэрэнгүй бичээрэй 🙂");
        return;
      }

      setBusy(true);

      // ⚠️ auth session байхгүй бол insert хийхгүй (RLS insert authenticated)
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        Alert.alert("Нэвтрэх шаардлагатай", "Санал хүсэлт илгээхийн тулд нэвтэрсэн байх хэрэгтэй.");
        return;
      }

      const payload = {
        user_id: (user?.id ?? user?.uid ?? null) as string | null,
        name: (user?.name ?? null) as string | null,
        phone: (user?.phone ?? null) as string | null,
        message: text,
        platform: Platform.OS,
        app_version: appVersion,
      };

      const { error } = await supabase.from("feedback").insert(payload as any);
      if (error) throw error;

      Alert.alert("Амжилттай", "Санал хүсэлт илгээгдлээ. Баярлалаа 🙏", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
      setMessage("");
    } catch (e: any) {
      console.log("feedback submit error:", e);
      Alert.alert("Алдаа", e?.message ?? "Илгээх үед алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.backgroundSecondary }]} edges={["top"]}>
      <Stack.Screen
        options={{
          title: "Санал хүсэлт",
          headerShown: true,
          headerStyle: { backgroundColor: colors.headerBackground as any },
          headerTintColor: colors.headerText as any,
          headerRight: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 12 }}>
              <X size={20} color={colors.headerText as any} />
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>Сайжруулах санал байна уу?</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            “Энийг ингэвэл гоё” “Тэр хэсэгт асуудал гарлаа” гэх мэт санаагаа бичээд илгээнэ үү.
          </Text>

          <View style={[styles.inputWrap, { backgroundColor: colors.backgroundSecondary }]}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Санал хүсэлтээ энд бичнэ үү..."
              placeholderTextColor={colors.textSecondary as any}
              style={[styles.input, { color: colors.text }]}
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={[styles.counter, { color: colors.textSecondary }]}>{message.trim().length}/2000</Text>
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}
            onPress={submit}
            activeOpacity={0.85}
            disabled={busy}
          >
            <Send size={18} color={colors.text as any} />
            <Text style={[styles.btnText, { color: colors.text }]}>
              {busy ? "Илгээж байна..." : "Илгээх"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  card: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "800" as const },
  sub: { fontSize: 13, lineHeight: 18 },
  inputWrap: { borderRadius: 14, padding: 12, gap: 8 },
  input: { minHeight: 160, fontSize: 15 },
  counter: { fontSize: 12, textAlign: "right" },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  btnText: { fontSize: 16, fontWeight: "800" as const },
});