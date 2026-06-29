// app/help/_layout.tsx
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";

export default function HelpLayout() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.headerBackground, // Таны сонгосон брэнд зөөлөн суурь өнгө
        },
        headerTintColor: colors.headerText, // Тансаг ялгарах текст болон сумны өнгө
        headerTitleStyle: {
          fontWeight: "bold",
          fontSize: 18,
        },
      }}
    >
      {/* 🎯 ЗАСВАР: headerBackTitleVisible-ийг кодноос нь хасаж алдааг арилгав */}
      <Stack.Screen 
        name="index" 
        options={{ 
          title: "Тусламж ба Нөхцөл",
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={{ paddingVertical: 8, paddingHorizontal: 4, marginRight: 8 }}
              activeOpacity={0.7}
            >
              <ChevronLeft color={colors.headerText} size={26} />
            </TouchableOpacity>
          ),
        }} 
      />
      <Stack.Screen name="terms" options={{ title: "Үйлчилгээний нөхцөл" }} />
      <Stack.Screen name="privacy" options={{ title: "Нууцлалын бодлого" }} />
      <Stack.Screen name="contact" options={{ title: "Холбоо барих" }} />
      <Stack.Screen name="sponsored" options={{ title: "Спонсор зар" }} />
    </Stack>
  );
}