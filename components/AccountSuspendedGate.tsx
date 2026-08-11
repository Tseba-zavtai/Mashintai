import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut, ShieldAlert } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useState } from "react";

function formatUntil(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AccountSuspendedGate() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const until = user?.suspendedUntil ? new Date(user.suspendedUntil) : null;
  const isSuspended = Boolean(until && !Number.isNaN(until.getTime()) && until.getTime() > Date.now());

  if (!isSuspended) return null;

  const handleLogout = async () => {
    try {
      setBusy(true);
      await logout();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={[styles.icon, { backgroundColor: colors.backgroundSecondary }]}>
          <ShieldAlert size={36} color="#D64545" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Account түр түгжигдсэн байна</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Маргаан эсвэл аюулгүй байдлын шалгалт дуусах хүртэл зар, түрээсийн үйлдэл хийх боломжгүй.</Text>
        {user?.suspensionReason ? <Text style={[styles.reason, { color: colors.text }]}>Шалтгаан: {user.suspensionReason}</Text> : null}
        <Text style={[styles.until, { color: colors.textSecondary }]}>Дуусах хугацаа: {formatUntil(user?.suspendedUntil)}</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleLogout} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color={colors.buttonText} /> : <><LogOut size={19} color={colors.buttonText} /><Text style={[styles.buttonText, { color: colors.buttonText }]}>Гарах</Text></>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: 10001, elevation: 10001 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  icon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  title: { fontSize: 23, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 12, maxWidth: 340 },
  reason: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 18, fontWeight: "600" },
  until: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8 },
  button: { marginTop: 28, minWidth: 190, minHeight: 52, paddingHorizontal: 20, borderRadius: 14, flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 16, fontWeight: "800" },
});
