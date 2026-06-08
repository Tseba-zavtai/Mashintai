// app/help/privacy.tsx
import React from "react";
import { StyleSheet, Text, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Нууцлалын бодлого" }} />

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.h}>Нууцлалын бодлого</Text>

        <Text style={styles.p}>
          “Түрээстэй” апп нь хэрэглэгчдийн хувийн мэдээллийн нууцлалыг хүндэтгэн хамгаалдаг.
        </Text>

        <Text style={styles.h2}>Цуглуулж болох мэдээлэл</Text>
        <View style={styles.list}>
          <Text style={styles.li}>• Нэр</Text>
          <Text style={styles.li}>• Утасны дугаар</Text>
          <Text style={styles.li}>• Профайл зураг (хэрэглэгчийн сонголтоор)</Text>
          <Text style={styles.li}>• Байршлын мэдээлэл (зарын байршил тодорхойлох зорилгоор)</Text>
        </View>

        <Text style={styles.h2}>Мэдээлэл ашиглах зорилго</Text>
        <Text style={styles.p}>
          Дээрх мэдээллийг зөвхөн апп-ын үндсэн үйлчилгээг үзүүлэх, зар нийтлэх, хэрэглэгчдийг хооронд нь холбох
          зорилгоор ашиглана.
        </Text>

        <Text style={styles.h2}>Гуравдагч этгээд</Text>
        <Text style={styles.p}>
          Хэрэглэгчийн хувийн мэдээллийг гуравдагч этгээдэд худалдах, дамжуулахгүй.
        </Text>

        <Text style={styles.h2}>Төлбөр</Text>
        <Text style={styles.p}>
          Төлбөртэй үйлчилгээний төлбөр нь гуравдагч этгээдийн (QPay) системээр дамжин хийгддэг бөгөөд “Түрээстэй” апп нь
          таны банкны болон картын мэдээллийг хадгалдаггүй.
        </Text>

        <Text style={styles.h2}>Өөрчлөх, устгах</Text>
        <Text style={styles.p}>
          Хэрэглэгч хүссэн үедээ өөрийн мэдээллийг засах, устгах боломжтой.
        </Text>

        <Text style={styles.note}>
          Энэ бодлого нь апп ашиглах хугацаанд хүчинтэй. Шаардлагатай тохиолдолд шинэчлэгдэж болно.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 16, paddingBottom: 28 },
  h: { fontSize: 18, fontWeight: "800", color: "#111", marginBottom: 10 },
  h2: { fontSize: 14, fontWeight: "800", color: "#111", marginTop: 12, marginBottom: 6 },
  p: { fontSize: 14, color: "#111", lineHeight: 20 },
  list: { gap: 6, marginTop: 4 },
  li: { fontSize: 14, color: "#111", lineHeight: 20 },
  note: { marginTop: 14, fontSize: 12.5, color: "#666", lineHeight: 18 },
});
