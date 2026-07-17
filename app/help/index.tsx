// app/help/index.tsx
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { ChevronRight, ChevronDown, Phone, FileText, Award, Shield, HelpCircle } from "lucide-react-native";
import { supabase } from "@/lib/supabase"; // 🎯 НЭМСЭН: Supabase холболт

type HelpItem = {
  title: string;
  description?: string;
  icon: React.ReactNode;
  onPress: () => void;
};

// 🎯 ШИНЭ: Supabase-аас ирэх FAQ төрөл
type DbFaq = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
};

export default function HelpScreen() {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  
  // 🎯 ШИНЭ: FAQ татах state
  const [faqs, setFaqs] = useState<DbFaq[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);

  // 🎯 ШИНЭ: FAQ датабэйсээс татах функц
  const fetchFaqs = useCallback(async () => {
    try {
      setLoadingFaqs(true);
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .order('sort_order', { ascending: true });
        
      if (error) throw error;
      if (data) setFaqs(data as DbFaq[]);
    } catch (err) {
      console.log("Error fetching FAQs:", err);
    } finally {
      setLoadingFaqs(false);
    }
  }, []);

  // 🎯 ШИНЭ: Дэлгэц нээгдэх үед FAQ татна
  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

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
      title: "Төлбөртэй үйлчилгээ",
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
          {loadingFaqs ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <ActivityIndicator color="#111" />
              <Text style={{ marginTop: 10, color: "#666", fontSize: 13 }}>Ачааллаж байна...</Text>
            </View>
          ) : faqs.length === 0 ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text style={{ color: "#666", fontSize: 13 }}>Мэдээлэл олдсонгүй</Text>
            </View>
          ) : (
            faqs.map((faq, index) => {
              const isExpanded = expandedIndex === index;
              return (
                <View key={faq.id} style={[styles.faqItem, index !== faqs.length - 1 && styles.rowBorder]}>
                  <Pressable 
                    onPress={() => setExpandedIndex(isExpanded ? null : index)} 
                    style={styles.faqQuestionRow}
                  >
                    <Text style={styles.faqQuestionText}>{faq.question}</Text>
                    {isExpanded ? (
                      <ChevronDown size={18} color="#777" />
                    ) : (
                      <ChevronRight size={18} color="#777" />
                    )}
                  </Pressable>
                  
                  {isExpanded && (
                    <View style={styles.faqAnswerRow}>
                      <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
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