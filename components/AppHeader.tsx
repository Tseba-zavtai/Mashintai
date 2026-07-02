import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { getLogoSource } from "@/constants/logo";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type HeaderProps = {
  title?: string;
  showBack?: boolean; // 🎯 НЭМСЭН: Буцах сумыг харуулах эсэхийг шийднэ
};

// 🎯 ЗАССАН: showBack нь анхныхаараа true байна
export default function AppHeader({ title, showBack = true }: HeaderProps) {
  const router = useRouter();
  const { colors, currentTheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.headerContainer, { backgroundColor: colors.headerBackground }]}>
      <View style={{ height: insets.top }} />
      <View style={[styles.header, { borderBottomColor: colors.headerBackground }]}>
        
        <View style={styles.leftSection}>
          {/* 🎯 ЗАССАН: showBack true үед л буцах сум гарна */}
          {showBack && (
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backButton}>
              <ChevronLeft size={28} color={colors.headerText} />
            </TouchableOpacity>
          )}
          
          {title ? (
            <Text 
              style={[
                styles.title, 
                { color: colors.headerText },
                !showBack && { marginLeft: 16 } // Сум байхгүй бол гарчиг арай зүүн тийшээ болно
              ]} 
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
        </View>

        <Image 
          source={getLogoSource(currentTheme)} 
          style={[styles.logo, { tintColor: colors.headerText }]} 
          resizeMode="contain" 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: { width: "100%" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftSection: { flexDirection: "row", alignItems: "center", flex: 1 },
  backButton: { paddingRight: 8, paddingVertical: 4 },
  title: { fontSize: 16, fontWeight: "800" },
  logo: { width: 80, height: 28 }
});