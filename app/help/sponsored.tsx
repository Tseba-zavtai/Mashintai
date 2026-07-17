// app/help/sponsored.tsx
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { supabase } from "@/lib/supabase"; // 🎯 Supabase холболт

export default function PaidServicesScreen() {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("Төлбөртэй үйлчилгээ");
  const [loading, setLoading] = useState(true);

  // 🎯 Баазаас Төлбөртэй үйлчилгээний дэлгэрэнгүй текстийг татах функц
  const fetchServicesContent = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("legal_docs")
        .select("title, content")
        .eq("doc_type", "services")
        .single();

      if (!error && data) {
        setTitle(data.title || "Төлбөртэй үйлчилгээ");
        setContent(data.content || "");
      }
    } catch (e) {
      console.log("Error fetching paid services content:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServicesContent();
  }, [fetchServicesContent]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: title }} />
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6E0AB0" />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.container} 
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.contentText}>{content}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 20 },
  contentText: { 
    fontSize: 15, 
    color: "#222", 
    lineHeight: 24,
    // 🎯 ЗАССАН: whiteSpace алдааг бүрмөсөн устгав
  },
});