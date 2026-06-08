// app/help/index.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { ChevronRight, Phone, FileText, Award, Shield } from "lucide-react-native";

type HelpItem = {
  title: string;
  description?: string;
  icon: React.ReactNode;
  onPress: () => void;
};

export default function HelpScreen() {
  const router = useRouter();

  const items: HelpItem[] = [
    {
      title: "Бидэнтэй холбогдох",
      description: "Facebook хуудсаар холбогдох",
      icon: <Phone size={20} color="#111" />,
      onPress: () => router.push("/help/contact" as Href),
    },
    {
      title: "Үйлчилгээний нөхцөл",
      description: "Апп ашиглах нөхцөл, журам",
      icon: <FileText size={20} color="#111" />,
      onPress: () => router.push("/help/terms" as Href),
    },
    {
      title: "Нийтлэсэн зараа хэрхэн Sponsored зар болгох вэ?",
      description: "Sponsored зарын тайлбар, алхамууд",
      icon: <Award size={20} color="#111" />,
      onPress: () => router.push("/help/sponsored" as Href),
    },
    {
      title: "Нууцлалын бодлого",
      description: "Ямар мэдээлэл цуглуулж, хэрхэн ашиглах тухай",
      icon: <Shield size={20} color="#111" />,
      onPress: () => router.push("/help/privacy" as Href),
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Тусламж" }} />

      <View style={styles.container}>
        <View style={styles.card}>
          {items.map((it, idx) => (
            <Pressable
              key={it.title}
              onPress={it.onPress}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
                idx !== items.length - 1 && styles.rowBorder,
              ]}
            >
              <View style={styles.left}>
                <View style={styles.iconWrap}>{it.icon}</View>
                <View style={styles.textWrap}>
                  <Text style={styles.title}>{it.title}</Text>
                  {!!it.description && (
                    <Text style={styles.desc}>{it.description}</Text>
                  )}
                </View>
              </View>

              <ChevronRight size={18} color="#777" />
            </Pressable>
          ))}
        </View>

        <Text style={styles.footer}>© Tureestei</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee",
    overflow: "hidden",
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowPressed: { backgroundColor: "#fafafa" },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  textWrap: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: "#111" },
  desc: { fontSize: 12.5, color: "#666", marginTop: 2 },
  footer: { textAlign: "center", color: "#999", fontSize: 12 },
});
