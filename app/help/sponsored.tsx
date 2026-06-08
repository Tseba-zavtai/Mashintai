// app/help/sponsored.tsx
import React from "react";
import { StyleSheet, Text, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

export default function SponsoredHelpScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Sponsored зар" }} />

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.h}>Нийтлэсэн зараа хэрхэн Sponsored зар болгох вэ?</Text>

        <Text style={styles.p}>
          Та өөрийн профайл руу орсноор нийтэлсэн “Түрээслэх” болон “Түрээслүүлэх” зарууд харагдана.
        </Text>

        <View style={styles.box}>
          <Text style={styles.step}>1) Sponsored болгохыг хүссэн зараа сонгоно.</Text>
          <Text style={styles.step}>2) “Sponsored болгох” товчин дээр дарна.</Text>
          <Text style={styles.step}>3) Төлбөр төлөх хэсэг рүү шилжинэ.</Text>
          <Text style={styles.step}>4) Төлбөр амжилттай хийгдсэний дараа таны зар Sponsored зар болно.</Text>
        </View>

        <Text style={styles.p}>
          Sponsored зар нь таны төлбөр төлсөн хугацаанаас эхлэн хүчинтэй байх бөгөөд заруудын хамгийн эхэнд санал болгон
          харагдана.
        </Text>

        <Text style={styles.note}>
          Анхааруулга: Төлбөрийн үйл ажиллагаа нь гуравдагч этгээдийн системээр (QPay) дамжин хийгдэнэ.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 16, paddingBottom: 28, gap: 12 },
  h: { fontSize: 16, fontWeight: "800", color: "#111" },
  p: { fontSize: 14, color: "#111", lineHeight: 20 },
  box: {
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  step: { fontSize: 14, color: "#111", lineHeight: 20 },
  note: { fontSize: 12.5, color: "#666", lineHeight: 18 },
});
