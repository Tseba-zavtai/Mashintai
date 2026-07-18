// constants/colors.ts
export type ThemeType =
  | "purple"
  | "peach"
  | "sky"
  | "navy"
  | "gray"
  | "mint";

export interface ColorScheme {
  primary: string;         // Товчлуурын суурь өнгө (ЯГ ТАНЫ ХҮССЭНЭЭР ТУХАЙН ТНЕМЕ-ИЙН ӨНГӨ)
  buttonText: string;      // Товчлуур доторх текст болон icon-ий өнгө (ҮРГҮЛЖ НИЛ ЯГААН ЭСВЭЛ ТАНЫ БРЭНД ӨНГӨ)
  text: string;            // Үндсэн текст
  textSecondary: string;   // Туслах текст
  background: string;      // Апп-ын арын дэвсгэр
  backgroundSecondary: string; // Апп-ын туслах дэвсгэр
  border: string;          // Хүрээ зураас
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;
  card: string;
  success: string;
  error: string;
  headerBackground: string; // Толгойн дэвсгэр өнгө
  headerText: string;       // Толгойн текст, лого, буцах товчны өнгө
  accent: string;
}

const baseLight = {
  background: "#F9FAFB",
  backgroundSecondary: "#F3F4F6",
  card: "#FFFFFF",
  text: "#111111",
  textSecondary: "#6B7280",
  border: "#E5E7EB",
  success: "#10B981",
  error: "#EF4444",
};

// 💜 1. PURPLE (Нил ягаан)
const purpleTheme: ColorScheme = {
  ...baseLight,
  primary: "#6E0AB0",       // Товчлуурын суурь: Нил ягаан
  buttonText: "#FFE3DD",    // Товчлуурын текст: Тоор
  headerBackground: "#6E0AB0",
  headerText: "#FFE3DD",
  tint: "#6E0AB0",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#6E0AB0",
  accent: "#F3E8FF",
};

// 🍑 2. PEACH (Тоор) -> 🎯 ЯГ ТАНЫ ХҮССЭНЭЭР: Button суурь нь өөрийнх нь Peach өнгө, текст нь Нил ягаан!
const peachTheme: ColorScheme = {
  ...baseLight,
  primary: "#FFE3DD",       // Товчлуурын суурь: #FFE3DD (Peach)
  buttonText: "#6E0AB0",    // Товчлуурын текст/icon: #6E0AB0 (Нил ягаан)
  headerBackground: "#FFE3DD",
  headerText: "#6E0AB0",
  tint: "#FFE3DD",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#6E0AB0",
  accent: "#FFF5F2",
};

// 🌌 3. NAVY (Бараан хөх)
const navyTheme: ColorScheme = {
  ...baseLight,
  primary: "#201A2E",       // Товчлуурын суурь: #201A2E (Navy)
  buttonText: "#FFE3DD",    // Товчлуурын текст/icon: #FFE3DD (Peach)
  headerBackground: "#201A2E",
  headerText: "#FFE3DD",
  tint: "#201A2E",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#6E0AB0",
  accent: "#EAE8F0",
};

// 🪙 4. GRAY (Саарал) -> 🎯 Button суурь нь өөрийнх нь Саарал өнгө, текст нь Нил ягаан!
const grayTheme: ColorScheme = {
  ...baseLight,
  primary: "#D0D2D8",       // Товчлуурын суурь: #D0D2D8 (Gray)
  buttonText: "#6E0AB0",    // Товчлуурын текст/icon: #6E0AB0 (Нил ягаан)
  headerBackground: "#D0D2D8",
  headerText: "#6E0AB0",
  tint: "#6B7280",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#6E0AB0",
  accent: "#F3F4F6",
};

// 🌿 5. MINT (Минт ногоон) -> 🎯 Button суурь нь өөрийнх нь Минт өнгө, текст нь Нил ягаан!
const mintTheme: ColorScheme = {
  ...baseLight,
  primary: "#8FE3CF",       // Товчлуурын суурь: #8FE3CF (Mint)
  buttonText: "#6E0AB0",    // Товчлуурын текст/icon: #6E0AB0 (Нил ягаан)
  headerBackground: "#8FE3CF",
  headerText: "#6E0AB0",
  tint: "#8FE3CF",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#6E0AB0",
  accent: "#E8F8F5",
};

// 💎 6. SKY (Тэнгэрийн цэнхэр) -> 🎯 Button суурь нь өөрийнх нь Цэнхэр өнгө, текст нь Нил ягаан!
const skyTheme: ColorScheme = {
  ...baseLight,
  primary: "#AFC6D9",       // Товчлуурын суурь: #AFC6D9 (Sky)
  buttonText: "#6E0AB0",    // Товчлуурын текст/icon: #6E0AB0 (Нил ягаан)
  headerBackground: "#AFC6D9",
  headerText: "#6E0AB0",
  tint: "#AFC6D9",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#6E0AB0",
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