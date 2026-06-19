// constants/colors.ts
export type ThemeType =
  | "purple"
  | "peach"
  | "sky"
  | "navy"
  | "gray"
  | "mint";

export interface ColorScheme {
  primary: string;
  text: string;
  textSecondary: string;
  background: string;
  backgroundSecondary: string;
  border: string;
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;
  card: string;
  success: string;
  error: string;
  headerBackground: string;
  headerText: string;
  accent: string;
}

// 🎯 СУУРЬ ӨНГӨНҮҮД: Бүх Theme-д Body хэсэг нь Цагаан/Цайвар саарал байна
const baseLight = {
  background: "#F9FAFB", // Цайвар саарал арын дэвсгэр
  backgroundSecondary: "#F3F4F6", // Арай бараан саарал
  card: "#FFFFFF", // Карт болон хайрцагнууд цагаан
  text: "#111111", // Үндсэн текст тас хар
  textSecondary: "#6B7280", // Дэд текст саарал
  border: "#E5E7EB", // Хүрээ зураас
  success: "#10B981", // Ногоон амжилттай өнгө
  error: "#EF4444", // Улаан алдааны өнгө
};

// 💜 1. PURPLE (Нил ягаан)
const purpleTheme: ColorScheme = {
  ...baseLight,
  primary: "#6E0AB0",
  headerBackground: "#6E0AB0",
  headerText: "#FFFFFF",
  tint: "#6E0AB0",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#6E0AB0",
  accent: "#F3E8FF", // Цайвар ягаан туяа
};

// 🍑 2. PEACH (Тоор)
const peachTheme: ColorScheme = {
  ...baseLight,
  primary: "#FFE3DD",
  headerBackground: "#FFE3DD",
  headerText: "#6E0AB0", // Хурц ялгарах текст
  tint: "#FFE3DD",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#6E0AB0",
  accent: "#FFF5F2",
};

// 🌌 3. NAVY (Бараан хөх)
const navyTheme: ColorScheme = {
  ...baseLight,
  primary: "#201A2E",
  headerBackground: "#201A2E",
  headerText: "#FFFFFF",
  tint: "#201A2E",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#201A2E",
  accent: "#EAE8F0",
};

// 🪙 4. GRAY (Саарал)
const grayTheme: ColorScheme = {
  ...baseLight,
  primary: "#6B7280",
  headerBackground: "#D0D2D8",
  headerText: "#111111",
  tint: "#6B7280",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#111111",
  accent: "#F3F4F6",
};

// 🌿 5. MINT (Минт ногоон)
const mintTheme: ColorScheme = {
  ...baseLight,
  primary: "#8FE3CF",
  headerBackground: "#8FE3CF",
  headerText: "#111111",
  tint: "#8FE3CF",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#111111",
  accent: "#E8F8F5",
};

// 💎 6. SKY (Тэнгэрийн цэнхэр)
const skyTheme: ColorScheme = {
  ...baseLight,
  primary: "#AFC6D9",
  headerBackground: "#AFC6D9",
  headerText: "#111111",
  tint: "#AFC6D9",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#111111",
  accent: "#F0F5F9",
};

export const DEFAULT_THEME: ThemeType = "purple";

export const THEME_ORDER: ThemeType[] = [
  "purple",
  "peach",
  "sky",
  "navy",
  "gray",
  "mint",
];

export const themes: Record<ThemeType, ColorScheme> = {
  purple: purpleTheme,
  peach: peachTheme,
  sky: skyTheme,
  navy: navyTheme,
  gray: grayTheme,
  mint: mintTheme,
};

export const getThemeColors = (theme: ThemeType | string | null | undefined): ColorScheme => {
  if (!theme) return themes[DEFAULT_THEME];
  return themes[theme as ThemeType] ?? themes[DEFAULT_THEME];
};

const Colors = {
  light: purpleTheme,
};

export default Colors;