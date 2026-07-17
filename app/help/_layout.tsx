import { Stack } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import AppHeader from "@/components/AppHeader";

const HELP_TITLES: Record<string, string> = {
  index: "Тусламж ба нөхцөл",
  terms: "Үйлчилгээний нөхцөл",
  privacy: "Нууцлалын бодлого",
  contact: "Холбоо барих",
  sponsored: "Спонсор зар",
};

export default function HelpLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={({ route }) => ({
        header: () => <AppHeader title={HELP_TITLES[route.name] ?? "Тусламж"} />,
        contentStyle: { backgroundColor: colors.backgroundSecondary },
      })}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="contact" />
      <Stack.Screen name="sponsored" />
    </Stack>
  );
}