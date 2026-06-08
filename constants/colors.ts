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

const purpleTheme: ColorScheme = {
  primary: "#6E0AB0",
  text: "#201A2E",
  textSecondary: "#6F6A78",
  background: "#FFFFFF",
  backgroundSecondary: "#F6F2FA",
  border: "#D0D2D8",
  tint: "#6E0AB0",
  tabIconDefault: "#AFC6D9",
  tabIconSelected: "#6E0AB0",
  card: "#FFFFFF",
  success: "#8FE3CF",
  error: "#E56B6F",
  headerBackground: "#6E0AB0",
  headerText: "#FFFFFF",
  accent: "#6E0AB0",
};

const peachTheme: ColorScheme = {
  primary: "#FFE3DD",
  text: "#201A2E",
  textSecondary: "#7A7284",
  background: "#FFF8F6",
  backgroundSecondary: "#FFF1EE",
  border: "#F1D7D1",
  tint: "#6E0AB0",
  tabIconDefault: "#AFC6D9",
  tabIconSelected: "#6E0AB0",
  card: "#FFFFFF",
  success: "#8FE3CF",
  error: "#E68A8A",
  headerBackground: "#FFE3DD",
  headerText: "#201A2E",
  accent: "#6E0AB0",
};

const skyTheme: ColorScheme = {
  primary: "#AFC6D9",
  text: "#201A2E",
  textSecondary: "#66707A",
  background: "#F7FAFC",
  backgroundSecondary: "#EAF1F6",
  border: "#D0DCE6",
  tint: "#6E0AB0",
  tabIconDefault: "#8EA6BA",
  tabIconSelected: "#6E0AB0",
  card: "#FFFFFF",
  success: "#8FE3CF",
  error: "#E56B6F",
  headerBackground: "#AFC6D9",
  headerText: "#201A2E",
  accent: "#6E0AB0",
};

const navyTheme: ColorScheme = {
  primary: "#201A2E",
  text: "#FFF4F1",
  textSecondary: "#D0D2D8",
  background: "#201A2E",
  backgroundSecondary: "#2B243B",
  border: "#3B344A",
  tint: "#6E0AB0",
  tabIconDefault: "#AFC6D9",
  tabIconSelected: "#8FE3CF",
  card: "#2A2338",
  success: "#8FE3CF",
  error: "#FF8A80",
  headerBackground: "#201A2E",
  headerText: "#FFF4F1",
  accent: "#6E0AB0",
};

const grayTheme: ColorScheme = {
  primary: "#D0D2D8",
  text: "#201A2E",
  textSecondary: "#6E7480",
  background: "#F8F8FA",
  backgroundSecondary: "#ECEEF2",
  border: "#D0D2D8",
  tint: "#6E0AB0",
  tabIconDefault: "#9FA5B1",
  tabIconSelected: "#6E0AB0",
  card: "#FFFFFF",
  success: "#8FE3CF",
  error: "#E56B6F",
  headerBackground: "#D0D2D8",
  headerText: "#201A2E",
  accent: "#6E0AB0",
};

const mintTheme: ColorScheme = {
  primary: "#8FE3CF",
  text: "#201A2E",
  textSecondary: "#66707A",
  background: "#F4FFFB",
  backgroundSecondary: "#E7FBF5",
  border: "#CDEAE2",
  tint: "#6E0AB0",
  tabIconDefault: "#AFC6D9",
  tabIconSelected: "#6E0AB0",
  card: "#FFFFFF",
  success: "#8FE3CF",
  error: "#E56B6F",
  headerBackground: "#8FE3CF",
  headerText: "#201A2E",
  accent: "#6E0AB0",
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