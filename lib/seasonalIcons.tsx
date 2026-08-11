import type { ComponentProps } from "react";
import {
  CloudLightning,
  CloudRain,
  CloudSun,
  Flag,
  PartyPopper,
  Snowflake,
  Sparkles,
  Sun,
} from "lucide-react-native";

export const SEASONAL_ICON_KEYS = [
  "sparkles",
  "snowflake",
  "sun",
  "cloud_sun",
  "cloud_rain",
  "cloud_lightning",
  "party",
  "flag",
] as const;

export type SeasonalIconKey = (typeof SEASONAL_ICON_KEYS)[number];

export const SEASONAL_ICON_OPTIONS: Array<{ key: SeasonalIconKey; label: string }> = [
  { key: "sparkles", label: "Онцлох" },
  { key: "snowflake", label: "Өвөл" },
  { key: "sun", label: "Зун" },
  { key: "cloud_sun", label: "Хавар" },
  { key: "cloud_rain", label: "Намар" },
  { key: "cloud_lightning", label: "Аянга" },
  { key: "party", label: "Баяр" },
  { key: "flag", label: "Наадам" },
];

const ICONS = {
  sparkles: Sparkles,
  snowflake: Snowflake,
  sun: Sun,
  cloud_sun: CloudSun,
  cloud_rain: CloudRain,
  cloud_lightning: CloudLightning,
  party: PartyPopper,
  flag: Flag,
} as const;

export function normalizeSeasonalIconKey(value: unknown): SeasonalIconKey {
  return typeof value === "string" && value in ICONS ? value as SeasonalIconKey : "sparkles";
}

export function SeasonalIcon({ iconKey, ...props }: { iconKey?: string | null } & ComponentProps<typeof Sparkles>) {
  const Icon = ICONS[normalizeSeasonalIconKey(iconKey)];
  return <Icon {...props} />;
}
