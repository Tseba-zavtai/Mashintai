import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LockKeyhole, ShieldCheck } from "lucide-react-native";
import { useAppLock } from "@/contexts/AppLockContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useState } from "react";

export default function AppLockGate() {
  const { isLocked, isAppLockReady, unlock } = useAppLock();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  if (!isAppLockReady || !isLocked) return null;

  const handleUnlock = async () => {
    try {
      setBusy(true);
      await unlock();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.headerBackground }]} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={[styles.icon, { backgroundColor: colors.background }]}>
          <LockKeyhole size={34} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.buttonText }]}>Tureesly түгжээтэй байна</Text>
        <Text style={[styles.subtitle, { color: colors.buttonText }]}>Face ID, хурууны хээ эсвэл төхөөрөмжийн PIN-ээр нээнэ үү.</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.background }]} onPress={handleUnlock} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color={colors.primary} /> : <><ShieldCheck size={19} color={colors.primary} /><Text style={[styles.buttonText, { color: colors.primary }]}>Нээх</Text></>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: 9999, elevation: 9999 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  icon: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  title: { fontSize: 23, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: "center", opacity: 0.85, marginTop: 10, maxWidth: 300 },
  button: { marginTop: 28, minWidth: 190, minHeight: 52, paddingHorizontal: 20, borderRadius: 14, flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 16, fontWeight: "800" },
});