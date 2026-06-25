// app/help/_layout.tsx
import { Stack } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";

export default function HelpLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.headerBackground, // Ягаан өнгө
        },
        headerTintColor: colors.headerText, // Цагаан текст
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Тусламж ба Нөхцөл" }} />
      <Stack.Screen name="terms" options={{ title: "Үйлчилгээний нөхцөл" }} />
      <Stack.Screen name="privacy" options={{ title: "Нууцлалын бодлого" }} />
      <Stack.Screen name="contact" options={{ title: "Холбоо барих" }} />
      <Stack.Screen name="sponsored" options={{ title: "Спонсор зар" }} />
    </Stack>
  );
}