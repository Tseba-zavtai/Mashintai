import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { getLogoSource } from "@/constants/logo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient"; // 🎯 Уусалт хийх сан

type HeaderProps = {
  title?: string;
  showBack?: boolean;
};

export default function AppHeader({ title, showBack = true }: HeaderProps) {
  const router = useRouter();
  const { colors, currentTheme } = useTheme();
  const insets = useSafeAreaInsets();

  // 🎯 ЗАССАН: TypeScript-д зориулж яг 2 өнгө буцаана <[string, string]> гэдгийг зааж өглөө
  const gradientColors = useMemo<[string, string]>(() => {
    if (currentTheme === "purple") {
      return ["#8B5CF6", "#6D28D9"];
    }
    return [colors.headerBackground as string, colors.headerBackground as string];
  }, [currentTheme, colors.headerBackground]);

  return (
    <LinearGradient 
      colors={gradientColors} 
      start={{ x: 0, y: 0 }} 
      end={{ x: 1, y: 0 }} 
      style={styles.headerContainer}
    >
      <View style={{ height: insets.top }} />
      <View style={[styles.header, { borderBottomColor: "transparent" }]}>
        
        <View style={styles.leftSection}>
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
                !showBack && { marginLeft: 16 }
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
    </LinearGradient>
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
  },
  leftSection: { flexDirection: "row", alignItems: "center", flex: 1 },
  backButton: { paddingRight: 8, paddingVertical: 4 },
  title: { fontSize: 16, fontWeight: "800" },
  logo: { width: 80, height: 28 }
});