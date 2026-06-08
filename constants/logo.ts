import { ImageSourcePropType } from "react-native";
import { ThemeType } from "@/constants/colors";

const LIGHT_LOGO_THEMES: readonly ThemeType[] = ["purple", "navy"];

export function getLogoSource(theme: ThemeType): ImageSourcePropType {
  return LIGHT_LOGO_THEMES.includes(theme)
    ? require("@/assets/logos/tureestei-light.png")
    : require("@/assets/logos/tureestei-dark.png");
}