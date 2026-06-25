// app/help/contact.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";

const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=100068185299396";

export default function ContactHelpScreen() {
  const openFacebook = async () => {
    try {
      const can = await Linking.canOpenURL(FACEBOOK_URL);
      if (!can) {
        Alert.alert("Алдаа", "Линк нээх боломжгүй байна.");
        return;
      }
      await Linking.openURL(FACEBOOK_URL);
    } catch (e) {
      Alert.alert("Алдаа", "Facebook нээх үед алдаа гарлаа.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Бидэнтэй холбогдох" }} />
      <View style={styles.container}>
        <Text style={styles.p}>
          Хэрэв танд санал хүсэлт, асуудал гарвал манай Facebook хуудсаар холбогдоно уу.
        </Text>

        <Pressable onPress={openFacebook} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
          <Text style={styles.btnText}>Facebook руу орох</Text>
        </Pressable>

        <Text style={styles.small}>{FACEBOOK_URL}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, padding: 16, gap: 12 },
  p: { fontSize: 14, color: "#111", lineHeight: 20 },
  btn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: { opacity: 0.9 },
  btnText: { color: "#fff", fontWeight: "700" },
  small: { fontSize: 12, color: "#777" },
});