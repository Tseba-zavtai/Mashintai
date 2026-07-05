// app/help/terms.tsx
import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, Text, ScrollView, ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { supabase } from "@/lib/supabase"; // 🎯 НЭМСЭН: Supabase холболт

export default function TermsScreen() {
  // 🎯 ШИНЭ: Баазаас татах state
  const [termsText, setTermsText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // 🎯 ШИНЭ: Үйлчилгээний нөхцөл датабэйсээс татах функц
  const fetchTerms = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('legal_docs')
        .select('content')
        .eq('doc_type', 'terms')
        .single();

      if (error) throw error;
      if (data) {
        setTermsText(data.content);
      }
    } catch (err) {
      console.log("Error fetching terms:", err);
      setTermsText("Үйлчилгээний нөхцөл олдсонгүй. Та интернэт холболтоо шалгана уу.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Үйлчилгээний нөхцөл" }} />

      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#111" />
            <Text style={styles.loadingText}>Уншиж байна...</Text>
          </View>
        ) : (
          <Text style={styles.text}>{termsText}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 16, paddingBottom: 28 },
  text: { fontSize: 14, color: "#111", lineHeight: 20 },
  loadingContainer: { padding: 40, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: "#666", fontSize: 13 },
});