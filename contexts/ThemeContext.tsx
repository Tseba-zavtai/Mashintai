import createContextHook from "@nkzw/create-context-hook";
import { useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ThemeType,
  themes,
  ColorScheme,
  DEFAULT_THEME,
  THEME_ORDER,
} from "@/constants/colors";

const THEME_STORAGE_KEY = "@app_theme";

const LEGACY_THEME_MAP: Record<string, ThemeType> = {
  default: "purple",
  dark: "navy",
  beige: "peach",
};

const isValidTheme = (value: string | null): value is ThemeType => {
  return !!value && THEME_ORDER.includes(value as ThemeType);
};

const normalizeStoredTheme = (value: string | null): ThemeType => {
  if (!value) return DEFAULT_THEME;
  if (isValidTheme(value)) return value;

  const mapped = LEGACY_THEME_MAP[value];
  if (mapped) return mapped;

  return DEFAULT_THEME;
};

export const [ThemeContext, useTheme] = createContextHook(() => {
  const [currentTheme, setCurrentThemeState] = useState<ThemeType>(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(true);

  const loadTheme = useCallback(async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      const normalizedTheme = normalizeStoredTheme(savedTheme);

      setCurrentThemeState(normalizedTheme);

      if (savedTheme !== normalizedTheme) {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
      }
    } catch (error) {
      console.error("Failed to load theme:", error);
      setCurrentThemeState(DEFAULT_THEME);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  const changeTheme = useCallback(async (theme: ThemeType) => {
    try {
      const safeTheme = themes[theme] ? theme : DEFAULT_THEME;
      await AsyncStorage.setItem(THEME_STORAGE_KEY, safeTheme);
      setCurrentThemeState(safeTheme);
    } catch (error) {
      console.error("Failed to save theme:", error);
    }
  }, []);

  const setTheme = useCallback(
    async (theme: ThemeType) => {
      await changeTheme(theme);
    },
    [changeTheme]
  );

  const colors: ColorScheme = useMemo(() => {
    return themes[currentTheme] ?? themes[DEFAULT_THEME];
  }, [currentTheme]);

  return {
    currentTheme,
    changeTheme,
    setTheme,
    colors,
    isLoading,
    reloadTheme: loadTheme,
    availableThemes: THEME_ORDER,
  };
});