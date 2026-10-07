import { Platform } from "react-native";

// Keep Apple's native map on iOS; never instantiate Google Maps on Android.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const maps = Platform.OS === "android" ? require("./OpenStreetMap") : Platform.OS === "ios" ? require("react-native-maps") : {};
export const MapView = maps.default;
export const Marker = maps.Marker;
export const Circle = maps.Circle;
