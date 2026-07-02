// app/(tabs)/location.tsx
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Dimensions,
  Image,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, Navigation, List, Locate, X, ChevronDown } from "lucide-react-native";
import { useMemo, useRef, useState, useEffect } from "react";
import * as Location from "expo-location";
import { useJobs } from "@/contexts/JobsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "expo-router";
import { JOB_CATEGORIES } from "@/mocks/jobs";
import AppHeader from "@/components/AppHeader"; // 🎯 НЭМСЭН

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MapView = Platform.OS !== "web" ? require("react-native-maps").default : null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Marker = Platform.OS !== "web" ? require("react-native-maps").Marker : null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Circle = Platform.OS !== "web" ? require("react-native-maps").Circle : null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PROVIDER_GOOGLE = Platform.OS !== "web" ? require("react-native-maps").PROVIDER_GOOGLE : null;

type FilterType = "near" | "location" | "list";

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const RADIUS_KM = 1;
const RADIUS_M = RADIUS_KM * 1000;

function regionForRadiusKm(lat: number, lng: number, radiusKm: number) {
  const latitudeDelta = radiusKm / 111;
  const longitudeDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: Math.max(latitudeDelta * 2.6, 0.02),
    longitudeDelta: Math.max(longitudeDelta * 2.6, 0.02),
  };
}

const normalizeCategory = (v: any) => String(v ?? "").trim();

export default function LocationScreen() {
  const router = useRouter();
  const { jobs } = useJobs();
  const { colors } = useTheme();

  const mapRef = useRef<any>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("location");
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [region, setRegion] = useState({
    latitude: 47.9184,
    longitude: 106.9177,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  const [selectedCategory, setSelectedCategory] = useState<string>("Бүгд");
  const [catOpen, setCatOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");

  const categories = useMemo(() => {
    return ["Бүгд", ...JOB_CATEGORIES];
  }, []);

  const categoriesFiltered = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.toLowerCase().includes(q));
  }, [categories, catSearch]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const loc = await Location.getCurrentPositionAsync({});
        const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserCoords(c);

        setRegion({
          latitude: c.latitude,
          longitude: c.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      } catch (error) {
        console.error("Failed to get location:", error);
      }
    })();
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const jobsFilteredBase = useMemo(() => {
    return jobs.filter((job) => {
      const titleOk = job?.title?.toLowerCase?.().includes(normalizedQuery);
      const jobCat = normalizeCategory(job?.category);
      const selectedCat = normalizeCategory(selectedCategory);
      const catOk = selectedCategory === "Бүгд" ? true : jobCat.length > 0 && jobCat === selectedCat;
      return Boolean(titleOk) && catOk;
    });
  }, [jobs, normalizedQuery, selectedCategory]);

  const jobsWithDistance = useMemo(() => {
    return jobsFilteredBase.map((job) => {
      if (!userCoords || !job.location) return { job, distanceKm: null as number | null };
      const { latitude, longitude } = job.location;
      if (typeof latitude !== "number" || typeof longitude !== "number") return { job, distanceKm: null };
      return { job, distanceKm: haversineKm(userCoords.latitude, userCoords.longitude, latitude, longitude) };
    });
  }, [jobsFilteredBase, userCoords]);

  const jobsNearMe = useMemo(() => {
    return jobsWithDistance
      .filter((x) => x.distanceKm != null && x.distanceKm <= RADIUS_KM)
      .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  }, [jobsWithDistance]);

  const jobsList = useMemo(() => {
    return [...jobsWithDistance].sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }, [jobsWithDistance]);

  const recenterToUser = (zoomToRadius = false) => {
    if (!userCoords) return;
    const next = zoomToRadius
      ? regionForRadiusKm(userCoords.latitude, userCoords.longitude, RADIUS_KM)
      : {
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
          latitudeDelta: region.latitudeDelta,
          longitudeDelta: region.longitudeDelta,
        };
    setRegion(next);
    if (mapRef.current?.animateToRegion) mapRef.current.animateToRegion(next, 350);
  };

  const goToJobDetail = (jobId: string | number) => {
    router.push({ pathname: "/browse", params: { id: String(jobId) } });
  };

  const showMap = selectedFilter === "location" || selectedFilter === "near";
  const mapJobs = selectedFilter === "near" ? jobsNearMe : jobsWithDistance;

  useEffect(() => {
    if (selectedFilter === "near") recenterToUser(true);
  }, [selectedFilter]);

  return (
    // 🎯 ЗАССАН: edges=["bottom"] болгож, "top"-ыг AppHeader дотор тооцоолдог болгов
    <SafeAreaView edges={["bottom"]} style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* 🎯 ЗАССАН: Хуучин гараар зурсан толгойг устгаад, showBack={false} гээд дуудав */}
      <AppHeader title="Байршил" showBack={false} />

      <View style={[styles.topControls, { backgroundColor: colors.headerBackground }]}>
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Хайх"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            setCatSearch("");
            setCatOpen(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.dropdownText, { color: colors.text }]} numberOfLines={1}>
            {selectedCategory}
          </Text>
          <ChevronDown size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              selectedFilter === "near" && { backgroundColor: "#1A1A1A", borderColor: "#1A1A1A" },
            ]}
            onPress={() => setSelectedFilter("near")}
            activeOpacity={0.7}
          >
            <Locate size={18} color={selectedFilter === "near" ? "#fff" : colors.text} />
            <Text style={[styles.filterButtonText, { color: selectedFilter === "near" ? "#fff" : colors.text }]}>
              Надтай ойр
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              selectedFilter === "location" && { backgroundColor: "#1A1A1A", borderColor: "#1A1A1A" },
            ]}
            onPress={() => setSelectedFilter("location")}
            activeOpacity={0.7}
          >
            <Navigation size={18} color={selectedFilter === "location" ? "#fff" : colors.text} />
            <Text style={[styles.filterButtonText, { color: selectedFilter === "location" ? "#fff" : colors.text }]}>
              Байршилаар
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              selectedFilter === "list" && { backgroundColor: "#1A1A1A", borderColor: "#1A1A1A" },
            ]}
            onPress={() => setSelectedFilter("list")}
            activeOpacity={0.7}
          >
            <List size={18} color={selectedFilter === "list" ? "#fff" : colors.text} />
            <Text style={[styles.filterButtonText, { color: selectedFilter === "list" ? "#fff" : colors.text }]}>
              Жагсаалтаар
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {showMap ? (
        <View style={styles.mapContainer}>
          {Platform.OS !== "web" && MapView ? (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
              region={region}
              onRegionChangeComplete={(r: any) => setRegion(r)}
              showsUserLocation
              showsMyLocationButton={false}
            >
              {selectedFilter === "near" && userCoords && Circle ? (
                <Circle
                  center={userCoords}
                  radius={RADIUS_M}
                  strokeWidth={2}
                  strokeColor="rgba(26,26,26,0.6)"
                  fillColor="rgba(26,26,26,0.12)"
                />
              ) : null}

              {mapJobs.slice(0, 80).map(({ job }) => {
                if (!job.location) return null;
                if (typeof job.location.latitude !== "number" || typeof job.location.longitude !== "number") return null;
                return (
                  <Marker
                    key={job.id}
                    coordinate={{ latitude: job.location.latitude, longitude: job.location.longitude }}
                    title={job.title}
                    description={job.location.address}
                    onPress={() => goToJobDetail(job.id)}
                  />
                );
              })}
            </MapView>
          ) : (
            <View style={styles.map}>
              <View style={styles.webNote}>
                <Text style={[styles.webNoteText, { color: colors.textSecondary }]}>
                  📍 Газрын зураг нь зөвхөн утсан дээр ажиллана
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.locationButton, { backgroundColor: colors.card }]}
            activeOpacity={0.8}
            onPress={() => recenterToUser(selectedFilter === "near")}
          >
            <Navigation size={24} color={colors.text} />
          </TouchableOpacity>

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.jobsPreview}>
            {mapJobs.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jobsScrollContent}>
                {mapJobs.slice(0, 5).map(({ job, distanceKm }) => (
                  <TouchableOpacity
                    key={job.id}
                    style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    activeOpacity={0.8}
                    onPress={() => goToJobDetail(job.id)}
                  >
                    <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={1}>
                      {job.title}
                    </Text>
                    <Text style={[styles.jobLocation, { color: colors.textSecondary }]} numberOfLines={1}>
                      {job.location?.address || "Байршилгүй"}
                    </Text>

                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <Text style={[styles.jobCategory, { color: colors.headerText, backgroundColor: colors.primary }]}>
                        {normalizeCategory(job.category) || "Категори байхгүй"}
                      </Text>
                      {selectedFilter === "near" && distanceKm != null ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" as const }}>
                          {distanceKm.toFixed(1)} км
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyJobsContainer}>
                <Text style={[styles.emptyJobsText, { color: colors.textSecondary }]}>
                  {selectedFilter === "near" ? "1км дотор зар олдсонгүй" : "Зар байхгүй байна"}
                </Text>
              </View>
            )}
          </KeyboardAvoidingView>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          {jobsList.length > 0 ? (
            jobsList.map(({ job, distanceKm }) => (
              <TouchableOpacity
                key={job.id}
                style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.85}
                onPress={() => goToJobDetail(job.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={1}>
                    {job.title}
                  </Text>
                  <Text style={[styles.listSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {job.location?.address || "Байршилгүй"}
                  </Text>

                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 }}>
                    <Text style={[styles.badge, { color: colors.headerText, backgroundColor: colors.primary }]}>
                      {normalizeCategory(job.category) || "Категори байхгүй"}
                    </Text>
                    {distanceKm != null ? (
                      <Text style={[styles.distance, { color: colors.textSecondary }]}>{distanceKm.toFixed(1)} км</Text>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyJobsContainer}>
              <Text style={[styles.emptyJobsText, { color: colors.textSecondary }]}>
                {searchQuery.trim() ? "Хайлтанд тохирох зар олдсонгүй" : "Зар байхгүй байна"}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={catOpen} transparent animationType="fade" onRequestClose={() => setCatOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCatOpen(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Категори</Text>

          <View style={[styles.catSearchBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              value={catSearch}
              onChangeText={setCatSearch}
              placeholder="Категори хайх..."
              placeholderTextColor={colors.textSecondary}
              style={{ flex: 1, color: colors.text }}
            />
            {catSearch.length > 0 ? (
              <TouchableOpacity onPress={() => setCatSearch("")}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {categoriesFiltered.map((c) => {
              const active = c === selectedCategory;
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.modalItem,
                    { borderColor: colors.border },
                    active && { backgroundColor: "rgba(26,26,26,0.08)" },
                  ]}
                  onPress={() => {
                    setSelectedCategory(c);
                    setCatOpen(false);
                  }}
                >
                  <Text style={[styles.modalItemText, { color: colors.text }]} numberOfLines={1}>
                    {c}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={[styles.modalClose, { borderColor: colors.border }]} onPress={() => setCatOpen(false)}>
            <Text style={{ color: colors.text, fontWeight: "700" as const }}>Хаах</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // 🎯 ЗАССАН: Хуучин header-ийн стилиудийг устгаад, хайлт товчнуудын арын дэвсгэрийг бэлдлээ
  topControls: { paddingBottom: 16, paddingTop: 8 },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 16, padding: 0 },

  dropdown: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dropdownText: { fontSize: 14, fontWeight: "700" as const, maxWidth: "90%" },

  filterContainer: { flexDirection: "row", paddingHorizontal: 16, gap: 8 },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
  },
  filterButtonText: { fontSize: 12, fontWeight: "700" as const },

  mapContainer: { flex: 1, position: "relative" },
  map: { flex: 1, overflow: "hidden", position: "relative" },

  locationButton: {
    position: "absolute",
    bottom: 80,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  jobsPreview: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },

  jobsScrollContent: { paddingHorizontal: 16, gap: 12 },
  jobCard: { padding: 14, borderRadius: 12, width: SCREEN_WIDTH * 0.7, borderWidth: 1 },
  jobTitle: { fontSize: 16, fontWeight: "700" as const, marginBottom: 4 },
  jobLocation: { fontSize: 13, marginBottom: 8 },
  jobCategory: {
    fontSize: 12,
    fontWeight: "700" as const,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    alignSelf: "flex-start",
  },

  webNote: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -120 }, { translateY: 20 }],
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  webNoteText: { fontSize: 13, textAlign: "center" as const },

  emptyJobsContainer: { paddingVertical: 20, alignItems: "center" as const, justifyContent: "center" as const },
  emptyJobsText: { fontSize: 14, fontWeight: "600" as const },

  listCard: { flexDirection: "row", borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  listTitle: { fontSize: 16, fontWeight: "800" as const },
  listSub: { fontSize: 13, marginTop: 4 },
  badge: {
    fontSize: 12,
    fontWeight: "800" as const,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  distance: { fontSize: 12, fontWeight: "700" as const },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  modalSheet: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 120,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: "900" as const, marginBottom: 10 },
  catSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  modalItemText: { fontSize: 14, fontWeight: "700" as const },
  modalClose: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});