// app/location-picker.tsx
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Dimensions,
  PanResponder,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MapPin, Check } from "lucide-react-native";
import { useState, useRef, useEffect } from "react";
import * as Location from "expo-location";
import { useJobs } from "@/contexts/JobsContext";
import { useTheme } from "@/contexts/ThemeContext";
import AppHeader from "@/components/AppHeader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MAP_WIDTH = SCREEN_WIDTH;
const MAP_HEIGHT = SCREEN_HEIGHT - 200;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MapView = Platform.OS !== "web" ? require("react-native-maps").default : null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Marker = Platform.OS !== "web" ? require("react-native-maps").Marker : null;
const PROVIDER_GOOGLE =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Platform.OS !== "web" ? require("react-native-maps").PROVIDER_GOOGLE : null;

export default function LocationPickerScreen() {
  const router = useRouter();
  const { userLocation, saveUserLocation } = useJobs();
  const { colors } = useTheme();


  const [pinPosition, setPinPosition] = useState({
    x: MAP_WIDTH / 2,
    y: MAP_HEIGHT / 2,
  });
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(userLocation || null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Зөвшөөрөл шаардлагатай",
          "Таны байршлыг тодорхойлохын тулд зөвшөөрөл өгнө үү"
        );
        return;
      }

      setIsLoadingLocation(true);
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error("Location error:", error);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setPinPosition({
          x: Math.max(20, Math.min(MAP_WIDTH - 20, locationX)),
          y: Math.max(20, Math.min(MAP_HEIGHT - 20, locationY)),
        });
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setPinPosition({
          x: Math.max(20, Math.min(MAP_WIDTH - 20, locationX)),
          y: Math.max(20, Math.min(MAP_HEIGHT - 20, locationY)),
        });
      },
    })
  ).current;

  const handleSaveLocation = async () => {
    if (!currentLocation) {
      Alert.alert("Алдаа", "Байршил олдсонгүй. Дахин оролдоно уу.");
      return;
    }

    const offsetLat = ((pinPosition.y - MAP_HEIGHT / 2) / MAP_HEIGHT) * 0.1;
    const offsetLng = ((pinPosition.x - MAP_WIDTH / 2) / MAP_WIDTH) * 0.1;

    const location = {
      latitude: currentLocation.latitude + offsetLat,
      longitude: currentLocation.longitude + offsetLng,
    };

    await saveUserLocation(location);
    Alert.alert("Амжилттай", "Таны байршил хадгалагдлаа", [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      <AppHeader title="Байршил сонгох" />

      <View style={styles.content}>
        <View
          style={[
            styles.instructionCard,
            { backgroundColor: colors.backgroundSecondary },
          ]}
        >
          <MapPin size={20} color={colors.primary} />
          <Text style={[styles.instructionText, { color: colors.text }]}>
            {isLoadingLocation
              ? "Байршил хайж байна..."
              : Platform.OS !== "web"
                ? "Доорх газрын зураг дээр дарж байршлаа сонгоно уу"
                : "Газрын зураг зөвхөн утсан дээр ажиллана"}
          </Text>
        </View>

        {Platform.OS !== "web" ? (
          <View
            style={[
              styles.mapContainer,
              { borderColor: colors.primary, shadowColor: colors.primary },
            ]}
          >
            {currentLocation && !isLoadingLocation && (
              <MapView
                style={styles.map}
                provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                initialRegion={{
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  latitudeDelta: 0.0922,
                  longitudeDelta: 0.0421,
                }}
                onPress={() => {
                  setPinPosition({
                    x: MAP_WIDTH / 2,
                    y: MAP_HEIGHT / 2,
                  });
                }}
              >
                <Marker
                  coordinate={{
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                  }}
                  title="Таны байршил"
                />
              </MapView>
            )}

            {isLoadingLocation && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
          </View>
        ) : (
          <View
            style={[
              styles.mapContainer,
              { borderColor: colors.primary, shadowColor: colors.primary },
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.gridBackground}>
              {Array.from({ length: 10 }).map((_, i) => (
                <View
                  key={`h-${i}`}
                  style={[styles.gridLineHorizontal, { top: `${i * 10}%` }]}
                />
              ))}
              {Array.from({ length: 10 }).map((_, i) => (
                <View
                  key={`v-${i}`}
                  style={[styles.gridLineVertical, { left: `${i * 10}%` }]}
                />
              ))}
            </View>

            {currentLocation && !isLoadingLocation && (
              <View style={styles.centerMarker}>
                <View
                  style={[
                    styles.centerMarkerDot,
                    { backgroundColor: colors.primary },
                  ]}
                />
                <Text
                  style={[styles.centerMarkerText, { color: colors.primary }]}
                >
                  Таны байршил
                </Text>
              </View>
            )}

            {isLoadingLocation && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}

            <View
              style={[
                styles.pin,
                {
                  left: pinPosition.x - 20,
                  top: pinPosition.y - 40,
                },
              ]}
            >
              <View style={[styles.pinIcon, { backgroundColor: colors.error }]}>
                <MapPin size={24} color="#fff" fill={colors.error} />
              </View>
            </View>

            <View
              style={[
                styles.coordinatesDisplay,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={[styles.coordinatesText, { color: colors.buttonText }]}>
                Pin: {pinPosition.x.toFixed(0)}, {pinPosition.y.toFixed(0)}
              </Text>
            </View>

            <View
              style={[
                styles.webLocationNote,
                { backgroundColor: colors.background },
              ]}
            >
              <Text
                style={[
                  styles.webLocationNoteText,
                  { color: colors.textSecondary },
                ]}
              >
                📍 Газрын зураг зөвхөн утсан дээр ажиллана
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary, shadowColor: colors.primary },
            (!currentLocation || isLoadingLocation) && [
              styles.saveButtonDisabled,
              { backgroundColor: colors.textSecondary },
            ],
          ]}
          onPress={handleSaveLocation}
          disabled={!currentLocation || isLoadingLocation}
          activeOpacity={0.8}
        >
          <Check size={20} color={colors.buttonText} />
          <Text style={[styles.saveButtonText, { color: colors.buttonText }]}>Хадгалах</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 70,
    height: 32,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  instructionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500" as const,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: "#e8f4f8",
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    borderWidth: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  gridBackground: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  gridLineHorizontal: {
    position: "absolute",
    width: "100%",
    height: 1,
    backgroundColor: "#c0d8e8",
  },
  gridLineVertical: {
    position: "absolute",
    height: "100%",
    width: 1,
    backgroundColor: "#c0d8e8",
  },
  centerMarker: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -40 }, { translateY: -40 }],
    alignItems: "center",
    zIndex: 1,
  },
  centerMarkerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  centerMarkerText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600" as const,
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  pin: {
    position: "absolute",
    zIndex: 100,
    alignItems: "center",
  },
  pinIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  coordinatesDisplay: {
    position: "absolute",
    bottom: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  coordinatesText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#fff",
  },
  saveButton: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#fff",
  },
  map: {
    width: "100%" as const,
    height: "100%" as const,
  },
  webLocationNote: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -120 }, { translateY: 50 }],
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    maxWidth: 250,
  },
  webLocationNoteText: {
    fontSize: 13,
    textAlign: "center" as const,
  },
});