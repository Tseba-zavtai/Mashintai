// app/help/terms.tsx
import React from "react";
import { StyleSheet, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

// ✅ Terms текст (single source)
import { TERMS_TEXT } from "@/constants/terms";

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Үйлчилгээний нөхцөл" }} />

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.text}>{TERMS_TEXT}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 16, paddingBottom: 28 },
  text: { fontSize: 14, color: "#111", lineHeight: 20 },
});