import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { getLogoSource } from "@/constants/logo";

type HeaderProps = {
  title?: string;
  showLogo?: boolean;
};

export default function AppHeader({ title, showLogo = false }: HeaderProps) {
  const router = useRouter();
  const { colors, currentTheme } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.headerBackground }]}>
      {/* Буцах товчлуур */}
      <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backButton}>
        <ChevronLeft size={24} color={colors.headerText} />
        <Text style={[styles.backText, { color: colors.headerText }]}>Буцах</Text>
      </TouchableOpacity>

      {/* Гол хэсэг: Лого эсвэл Текст */}
      {showLogo ? (
        <Image 
          source={getLogoSource(currentTheme)} 
          style={styles.logo} 
          resizeMode="contain" 
        />
      ) : (
        <Text style={[styles.title, { color: colors.headerText }]} numberOfLines={1}>
          {title}
        </Text>
      )}

      {/* Баруун талыг тэнцвэржүүлэх хоосон зай */}
      <View style={{ width: 80 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    width: 80,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    flex: 1,
  },
  logo: {
    width: 90,
    height: 32,
    alignSelf: "center",
  }
});