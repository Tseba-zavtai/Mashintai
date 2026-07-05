// app/help/privacy.tsx
import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, Text, ScrollView, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { supabase } from "@/lib/supabase"; // 🎯 НЭМСЭН: Supabase холболт

export default function PrivacyPolicyScreen() {
  // 🎯 ШИНЭ: Баазаас татах state
  const [privacyText, setPrivacyText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // 🎯 ШИНЭ: Нууцлалын бодлого датабэйсээс татах функц
  const fetchPrivacy = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('legal_docs')
        .select('content')
        .eq('doc_type', 'privacy')
        .single();

      if (error) throw error;
      if (data) {
        setPrivacyText(data.content);
      }
    } catch (err) {
      console.log("Error fetching privacy policy:", err);
      setPrivacyText("Нууцлалын бодлого олдсонгүй. Та интернэт холболтоо шалгана уу.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrivacy();
  }, [fetchPrivacy]);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Нууцлалын бодлого" }} />

      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#111" />
            <Text style={styles.loadingText}>Уншиж байна...</Text>
          </View>
        ) : (
          <Text style={styles.text}>{privacyText}</Text>
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