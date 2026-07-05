// app/help/contact.tsx
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase"; // 🎯 Supabase холболт

const FALLBACK_FACEBOOK_URL = "https://www.facebook.com/profile.php?id=100068185299396";
const FALLBACK_PHONE = "99112233";

export default function ContactHelpScreen() {
  // 🎯 Баазаас линк болон утас унших state-үүд
  const [facebookUrl, setFacebookUrl] = useState(FALLBACK_FACEBOOK_URL);
  const [supportPhone, setSupportPhone] = useState(FALLBACK_PHONE);
  const [loading, setLoading] = useState(true);

  // 🎯 Фэйсбүүк болон утасны дугаарыг баазаас хамт татах функц
  const fetchContactConfig = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value');

      if (!error && data) {
        const fbConfig = data.find(item => item.key === 'facebook_url');
        const phoneConfig = data.find(item => item.key === 'support_phone');
        
        if (fbConfig) setFacebookUrl(fbConfig.value);
        if (phoneConfig) setSupportPhone(phoneConfig.value);
      }
    } catch (e) {
      console.log("Error fetching contact config:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContactConfig();
  }, [fetchContactConfig]);

  // Facebook нээх функц[cite: 6]
  const openFacebook = async () => {
    try {
      const can = await Linking.canOpenURL(facebookUrl); //[cite: 6]
      if (!can) { //[cite: 6]
        Alert.alert("Алдаа", "Линк нээх боломжгүй байна."); //[cite: 6]
        return; //[cite: 6]
      } //[cite: 6]
      await Linking.openURL(facebookUrl); //[cite: 6]
    } catch (e) { //[cite: 6]
      Alert.alert("Алдаа", "Facebook нээх үед алдаа гарлаа."); //[cite: 6]
    } //[cite: 6]
  };

  // 🎯 ШИНЭ ФУНКЦ: Утас руу шууд дуудлага хийх
  const makeCall = async () => {
    try {
      const telUrl = `tel:${supportPhone}`;
      const can = await Linking.canOpenURL(telUrl);
      if (!can) {
        Alert.alert("Алдаа", "Дуудлага хийх боломжгүй төхөөрөмж байна.");
        return;
      }
      await Linking.openURL(telUrl);
    } catch (e) {
      Alert.alert("Алдаа", "Дуудлага хийхэд алдаа гарлаа.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Бидэнтэй холбогдох" }} /> {/*[cite: 6] */}
      <View style={styles.container}> {/*[cite: 6] */}
        <Text style={styles.p}> {/*[cite: 6] */}
          Хэрэв танд санал хүсэлт, асуудал гарвал манай Facebook хуудсаар холбогдох эсвэл тусламжийн утас руу шууд залгаарай.
        </Text> {/*[cite: 6] */}

        {loading ? (
          <ActivityIndicator color="#111" style={{ marginVertical: 20 }} />
        ) : (
          <View style={{ gap: 12 }}>
            {/* Facebook Товчлуур */}
            <Pressable onPress={openFacebook} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}> {/*[cite: 6] */}
              <Text style={styles.btnText}>Facebook хуудас руу орох</Text> {/*[cite: 6] */}
            </Pressable> {/*[cite: 6] */}

            {/* 🎯 ШИНЭ: Утас руу залгах товчлуур */}
            <Pressable onPress={makeCall} style={({ pressed }) => [styles.btn, { backgroundColor: "#222" }, pressed && styles.btnPressed]}>
              <Text style={styles.btnText}>Дуудлага хийх: {supportPhone}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.small}>Холбоос: {facebookUrl}</Text> {/*[cite: 6] */}
      </View> {/*[cite: 6] */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" }, //[cite: 6]
  container: { flex: 1, padding: 16, gap: 16 }, //[cite: 6]
  p: { fontSize: 14, color: "#111", lineHeight: 20 }, //[cite: 6]
  btn: { //[cite: 6]
    height: 48, //[cite: 6]
    borderRadius: 14, //[cite: 6]
    backgroundColor: "#111", //[cite: 6]
    alignItems: "center", //[cite: 6]
    justifyContent: "center", //[cite: 6]
  }, //[cite: 6]
  btnPressed: { opacity: 0.9 }, //[cite: 6]
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 }, //[cite: 6]
  small: { fontSize: 12, color: "#777", marginTop: 10 }, //[cite: 6]
});