// app/help/index.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { ChevronRight, ChevronDown, Phone, FileText, Award, Shield, HelpCircle } from "lucide-react-native";

type HelpItem = {
  title: string;
  description?: string;
  icon: React.ReactNode;
  onPress: () => void;
};

const FAQS = [
  {
    q: "Tureesly апп гэж юу вэ?",
    a: "Tureesly нь хэрэгцээт эд зүйлс, тоног төхөөрөмжөө бусдад түрээслүүлэх болон бусдаас түрээслэх боломжийг олгодог нэгдсэн платформ юм. Бид зөвхөн хэрэглэгчдийг хооронд нь холбох гүүр болж ажиллана."
  },
  {
    q: "Апп ашиглахад үнэтэй юу?",
    a: "Апп татах болон ашиглахад бүрэн үнэ төлбөргүй. Харин та зарынхаа хандалтыг нэмэгдүүлж 'Sponsored' болгох үедээ л төлбөр төлнө."
  },
  {
    q: "Түрээслэх хүсэлт хэрхэн илгээх вэ?",
    a: "Таалагдсан зарынхаа дэлгэрэнгүй рүү ороод 'Түрээслэх' товчийг дарж, тоо ширхэг болон хоногоо сонгон хүсэлт илгээнэ. Зарын эзэн зөвшөөрснөөр та хоёрын утасны дугаар ил болж холбогдох боломжтой болно."
  },
  {
    q: "Бараагаа яаж хүлээж авах вэ? Хүргэлт байгаа юу?",
    a: "Tureesly апп нь хүргэлт хийдэггүй. Түрээслэгч болон түрээслүүлэгч талууд утсаар холбогдож, бараа хүлээлцэх газар болон цагаа өөрсдөө тохиролцоно."
  },
  {
    q: "Зар хэрхэн оруулах вэ?",
    a: "Гол цэсний '+' товч (Зар нэмэх) дээр дарж барааны зураг, үнэ, тоо ширхэг, тайлбараа оруулан нийтлэх боломжтой."
  },
  {
    q: "Төлбөр тооцоог хэрхэн хийх вэ?",
    a: "Түрээсийн төлбөрийг талууд хоорондоо тохиролцон (дансаар эсвэл бэлнээр) шилжүүлнэ. Апп дотор төлбөр дамжихгүй."
  },
  {
    q: "Бараа эвдэрсэн эсвэл алдагдсан тохиолдолд яах вэ?",
    a: "Tureesly платформ нь эвдрэл гэмтэл, төлбөр тооцооны эрсдэлийг хариуцахгүй. Тиймээс түрээслүүлэгч тал бараагаа өгөхдөө бичиг баримт барьцаалах эсвэл гэрээ байгуулах зэргээр өөрийн эрсдэлээс хамгаалахыг зөвлөж байна."
  }
];

export default function HelpScreen() {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

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

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
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

        <View style={styles.faqHeader}>
          <HelpCircle size={20} color="#111" />
          <Text style={styles.faqTitle}>Түгээмэл асуултууд</Text>
        </View>

        <View style={styles.card}>
          {FAQS.map((faq, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <View key={index} style={[styles.faqItem, index !== FAQS.length - 1 && styles.rowBorder]}>
                <Pressable 
                  onPress={() => setExpandedIndex(isExpanded ? null : index)} 
                  style={styles.faqQuestionRow}
                >
                  <Text style={styles.faqQuestionText}>{faq.q}</Text>
                  {isExpanded ? (
                    <ChevronDown size={18} color="#777" />
                  ) : (
                    <ChevronRight size={18} color="#777" />
                  )}
                </Pressable>
                
                {isExpanded && (
                  <View style={styles.faqAnswerRow}>
                    <Text style={styles.faqAnswerText}>{faq.a}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Text style={styles.footer}>© Tureesly</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40, gap: 20 },
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
  
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  faqTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  faqItem: {
    backgroundColor: "#fff",
  },
  faqQuestionRow: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    paddingRight: 12,
    lineHeight: 20,
  },
  faqAnswerRow: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 0,
  },
  faqAnswerText: {
    fontSize: 13,
    color: "#666",
    lineHeight: 20,
  },
  
  footer: { textAlign: "center", color: "#999", fontSize: 12, marginTop: 10 },
});