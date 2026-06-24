// app/(tabs)/index.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getLogoSource } from "@/constants/logo";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  View,
  useWindowDimensions,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
// 🎯 ШИНЭ: Expo Image ашиглаж байна (маш хурдан, бас cache хийнэ)
import { Image } from "expo-image";
import {
  Search,
  X,
  Palette,
  Tag,
  Check,
  MapPin,
  Users,
  ClipboardList,
  Shield,
  Home,
  PhoneCall,
  Settings,
  Building2,
  Car,
  Truck,
  Monitor,
  Smartphone,
  Sofa,
  Package,
  Bike,
  Shirt,
  Music,
  Gamepad2,
  Baby,
  Camera,
  Dumbbell,
  Plane,
  Sparkles,
  Hammer,
  Wrench,
  Briefcase,
  Leaf,
  HeartHandshake,
  Globe,
  GraduationCap,
  Ticket,
  ShoppingCart,
  Scissors,
  Scale,
  TrendingUp,
  FolderKanban,
  Gift,
  BadgeHelp,
  Dog,
  Heart,
} from "lucide-react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Job } from "@/mocks/jobs";
import { useJobs } from "@/contexts/JobsContext";
import { useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeType } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import BannerCarousel from "@/components/BannerCarousel";
import { fetchBanners } from "@/lib/banners";
import { searchMatch } from "@/lib/searchUtils";

// 🎯 ШИНЭ: Skeleton loader оруулж ирлээ
import SkeletonCard from "@/components/SkeletonCard";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; fill?: string }>;
type FilterType = "all" | "rent" | "need";

type DbCategoryRow = { id: string; name: string; sort_order: number | null; };
type DbSubcategoryRow = { id: string; name: string; category_id: string; sort_order: number | null; };

type NormalizedJob = Job & {
  category_id?: string | null; subcategory_id?: string | null; category?: string | null;
  subcategory?: string | null; postType?: string | null; isActive?: boolean;
  isSponsored?: boolean; sponsoredUntil?: Date | null; postedBy?: any; postedDate?: Date;
  location?: any; image_url?: string | null; image_urls?: string[]; itemRatingAvg?: number | null;
  itemReviewCount?: number; rentalCount?: number; bumpedAt?: Date | null; bumpCount?: number;
};

function toSafeDate(value: any): Date {
  if (!value) return new Date();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function normalizeText(s: string) { return (s ?? "").toLowerCase().trim(); }

function normalizeImageUrls(raw: any): string[] {
  const source = raw?.image_urls ?? raw?.imageUrls ?? null;
  if (Array.isArray(source)) return source.filter((x) => typeof x === "string" && x.trim().length > 0);
  if (typeof source === "string" && source.trim()) {
    try {
      const parsed = JSON.parse(source);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string" && x.trim().length > 0);
    } catch { return [source]; }
  }
  const fallback = raw?.image_url ?? raw?.imageUrl ?? null;
  if (typeof fallback === "string" && fallback.trim()) return [fallback];
  return [];
}

function getSponsoredUntilDate(raw: any): Date | null {
  const sponsoredUntilRaw = raw?.sponsoredUntil ?? raw?.sponsored_until ?? raw?.sponsoredEnd ?? raw?.sponsored_end ?? raw?.sponsored_expires_at ?? null;
  if (!sponsoredUntilRaw) return null;
  const d = toSafeDate(sponsoredUntilRaw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function asNumberOrNull(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getBumpedAtDate(raw: any): Date | null {
  const value = raw?.bumpedAt ?? raw?.bumped_at ?? null;
  if (!value) return null;
  const d = toSafeDate(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatRating(value: any) {
  const n = asNumberOrNull(value);
  return n == null ? "Шинэ" : n.toFixed(1);
}

function getJobRankingScore(job: any): number {
  const now = Date.now();
  const postedTs = job?.postedDate?.getTime?.() ?? toSafeDate(job?.created_at ?? job?.updated_at).getTime();
  const bumpedTs = job?.bumpedAt?.getTime?.() ?? getBumpedAtDate(job)?.getTime?.() ?? 0;
  const sponsoredUntilTs = job?.sponsoredUntil?.getTime?.() ?? 0;
  const isSponsored = !!job?.isSponsored && sponsoredUntilTs > now;
  const itemRating = asNumberOrNull(job?.itemRatingAvg ?? job?.item_rating_avg) ?? 0;
  const userRating = asNumberOrNull(job?.postedBy?.userRatingAvg ?? job?.user_rating_avg) ?? 0;
  const rentalCount = asNumberOrNull(job?.rentalCount ?? job?.rental_count) ?? 0;

  let score = 0;
  if (isSponsored) {
    score += 1_000_000;
    if (itemRating >= 4) score += 60_000;
    else if (itemRating >= 3) score += 35_000;
    else if (itemRating > 0) score += 12_000;
    else score += 45_000;
  }
  if (bumpedTs > 0) {
    const ageHours = Math.max(0, (now - bumpedTs) / 36e5);
    score += Math.max(0, 180_000 - ageHours * 4_000);
  }
  score += itemRating * 4_000 + userRating * 2_000 + Math.min(rentalCount, 100) * 80 + postedTs / 1_000_000_000;
  return score;
}

const CATEGORY_ICON_OVERRIDE: Record<string, LucideIcon> = {
  "Тээврийн хэрэгсэл": Car, "Барилга, засварын тоног төхөөрөмж": Hammer, "Арга хэмжээ, event-ийн хэрэгсэл": Music,
  "Ахуйн болон өдөр тутмын хэрэглээ": Home, "Аялал, outdoor хэрэгсэл": Plane, "Фото, видео, контентын тоног төхөөрөмж": Camera,
  "Тоглоом, entertainment": Gamepad2, "Оффис, бизнесийн хэрэглээ": Briefcase, "Хүнд машин механизм, тусгай хэрэгсэл": Truck,
  "Хувцас, тусгай хэрэглээ": Shirt, "Спорт, хобби": Dumbbell, "Мал аж ахуй, хөдөө аж ахуйн хэрэгсэл": Leaf,
};

function iconByKeyword(name: string): LucideIcon {
  const t = normalizeText(name);
  if (t.includes("тээврийн") || t.includes("машин") || t.includes("suv") || t.includes("pickup") || t.includes("ачааны") || t.includes("микро") || t.includes("мото") || t.includes("скүүтер") || t.includes("унадаг дугуй") || t.includes("цахилгаан дугуй") || t.includes("caravan") || t.includes("trailer") || t.includes("vehicle") || t.includes("auto")) return Car;
  if (t.includes("барилга") || t.includes("засвар") || t.includes("тоног төхөөрөмж") || t.includes("өрөм") || t.includes("дрилл") || t.includes("бетон") || t.includes("хөрөө") || t.includes("гагнуур") || t.includes("шат") || t.includes("лазер") || t.includes("компрессор") || t.includes("генератор") || t.includes("насос") || t.includes("tool")) return Hammer;
  if (t.includes("арга хэмжээ") || t.includes("event") || t.includes("майхан") || t.includes("тайз") || t.includes("speaker") || t.includes("microphone") || t.includes("karaoke") || t.includes("projector") || t.includes("led") || t.includes("photo booth") || t.includes("гэрэлтүүлэг")) return Music;
  if (t.includes("ахуйн") || t.includes("өдөр тутмын") || t.includes("хүүхдийн тэрэг") || t.includes("машины суудал") || t.includes("нялх") || t.includes("wheelchair") || t.includes("өвчтөний ор") || t.includes("халаагуур") || t.includes("air purifier") || t.includes("vacuum") || t.includes("carpet cleaner") || t.includes("household")) return Home;
  if (t.includes("аялал") || t.includes("outdoor") || t.includes("кемп") || t.includes("унтлагын уут") || t.includes("хийн плитка") || t.includes("cool box") || t.includes("загасчлал") || t.includes("gps") || t.includes("walkie") || t.includes("portable battery") || t.includes("power bank") || t.includes("travel")) return Plane;
  if (t.includes("фото") || t.includes("видео") || t.includes("контент") || t.includes("camera") || t.includes("lens") || t.includes("gimbal") || t.includes("tripod") || t.includes("drone") || t.includes("action camera") || t.includes("lighting kit") || t.includes("teleprompter") || t.includes("backdrop")) return Camera;
  if (t.includes("тоглоом") || t.includes("entertainment") || t.includes("vr") || t.includes("board games") || t.includes("air hockey") || t.includes("sim racing") || t.includes("ps") || t.includes("nintendo") || t.includes("sega") || t.includes("projector + screen")) return Gamepad2;
  if (t.includes("оффис") || t.includes("бизнес") || t.includes("зөөврийн компьютер") || t.includes("printer") || t.includes("scanner") || t.includes("pos") || t.includes("barcode") || t.includes("label printer") || t.includes("meeting speakerphone") || t.includes("tablet") || t.includes("wi-fi") || t.includes("router") || t.includes("дэлгэц") || t.includes("office")) return Briefcase;
  if (t.includes("хүнд машин") || t.includes("тусгай хэрэгсэл") || t.includes("сэрээт ачигч") || t.includes("кран") || t.includes("ковш") || t.includes("индүү") || t.includes("excavator") || t.includes("pallet jack") || t.includes("hand stacker") || t.includes("machinery")) return Truck;
  if (t.includes("хувцас") || t.includes("гоёлын даашинз") || t.includes("үндэсний хувцас") || t.includes("костюм") || t.includes("тайзны хувцас") || t.includes("mascot") || t.includes("хамгаалалтын хувцас") || t.includes("dress")) return Shirt;
  if (t.includes("спорт") || t.includes("хобби") || t.includes("цана") || t.includes("snowboard") || t.includes("тэшүүр") || t.includes("фитнес") || t.includes("paddle board") || t.includes("kayak") || t.includes("tennis") || t.includes("boxing")) return Dumbbell;
  if (t.includes("мал аж ахуй") || t.includes("хөдөө аж ахуй") || t.includes("өвс хадах") || t.includes("сэндийлэгч") || t.includes("мотоблок") || t.includes("шүршигч") || t.includes("усалгааны насос") || t.includes("цахилгаан хашааны төхөөрөмж") || t.includes("agri") || t.includes("farm")) return Leaf;
  if (t.includes("гэр") || t.includes("орон сууц") || t.includes("house") || t.includes("home")) return Home;
  if (t.includes("тавилга") || t.includes("furniture") || t.includes("sofa")) return Sofa;
  if (t.includes("мото") || t.includes("bike") || t.includes("унадаг")) return Bike;
  if (t.includes("тээвэр") || t.includes("truck") || t.includes("логистик")) return Truck;
  if (t.includes("комп") || t.includes("computer") || t.includes("monitor") || t.includes("pc")) return Monitor;
  if (t.includes("утас") || t.includes("phone") || t.includes("mobile") || t.includes("smart")) return Smartphone;
  if (t.includes("бэлэг") || t.includes("gift")) return Gift;
  if (t.includes("хөгжим") || t.includes("music") || t.includes("instrument")) return Music;
  if (t.includes("хүүхэд") || t.includes("baby") || t.includes("kid")) return Baby;
  if (t.includes("амьтан") || t.includes("pet") || t.includes("dog") || t.includes("cat")) return Dog;
  if (t.includes("бараа") || t.includes("item") || t.includes("product")) return Package;
  return Tag;
}

function buildUniqueIconMap(categoryNames: string[]) {
  const pool: LucideIcon[] = [
    Briefcase, Wrench, Leaf, HeartHandshake, MapPin, Users, ClipboardList, Shield, Home, PhoneCall, Settings, Building2, Car, Truck, Monitor, Smartphone, Gift, BadgeHelp, Sofa, Package, Bike, Shirt, Music, Gamepad2, Baby, Dog, Scissors, Scale, TrendingUp, FolderKanban, Globe, Camera, Dumbbell, GraduationCap, Plane, Ticket, ShoppingCart, Sparkles, Hammer,
  ];
  const used = new Set<LucideIcon>();
  const map: Record<string, LucideIcon> = {};
  for (const name of categoryNames) {
    const override = CATEGORY_ICON_OVERRIDE[name];
    if (override) { map[name] = override; used.add(override); }
  }
  for (const name of categoryNames) {
    if (map[name]) continue;
    const keywordIcon = iconByKeyword(name);
    if (keywordIcon !== Tag) { map[name] = keywordIcon; used.add(keywordIcon); }
  }
  let i = 0;
  for (const name of categoryNames) {
    if (map[name]) continue;
    while (i < pool.length && used.has(pool[i])) i++;
    map[name] = i < pool.length ? pool[i] : Tag;
    used.add(map[name]);
    i++;
  }
  return map;
}

function normalizeJob(raw: any): NormalizedJob {
  const postedBy = raw?.postedBy ?? raw?.posted_by ?? {
      id: raw?.posted_by_id ?? null,
      name: raw?.posted_by_name ?? raw?.posted_by_phone ?? "Unknown",
      phone: raw?.posted_by_phone ?? null,
      photoUri: raw?.users?.photo_uri ?? raw?.photo_uri ?? raw?.posted_by_photo ?? null,
    };
  const postedDate = raw?.postedDate ?? raw?.created_at ?? raw?.updated_at;
  const sponsoredUntil = getSponsoredUntilDate(raw);
  const legacySponsored = !!(raw?.isSponsored ?? raw?.is_sponsored ?? false);
  const isSponsoredByTime = sponsoredUntil ? sponsoredUntil.getTime() > Date.now() : false;
  const computedIsSponsored = sponsoredUntil ? isSponsoredByTime : legacySponsored;
  const location = raw?.location && typeof raw.location === "object" ? raw.location : raw?.address ? { address: raw.address, latitude: raw?.latitude ?? null, longitude: raw?.longitude ?? null } : null;
  const imageUrls = normalizeImageUrls(raw);
  const bumpedAt = getBumpedAtDate(raw);
  const itemRatingAvg = asNumberOrNull(raw?.itemRatingAvg ?? raw?.item_rating_avg);
  const itemReviewCount = asNumberOrNull(raw?.itemReviewCount ?? raw?.item_review_count) ?? 0;
  const rentalCount = asNumberOrNull(raw?.rentalCount ?? raw?.rental_count) ?? itemReviewCount;
  return {
    ...raw, category_id: raw?.category_id ?? null, subcategory_id: raw?.subcategory_id ?? null,
    isSponsored: computedIsSponsored, sponsoredUntil, postType: raw?.postType ?? raw?.post_type ?? "job",
    isActive: raw?.isActive ?? raw?.is_active ?? true, postedBy, postedDate: toSafeDate(postedDate),
    category: raw?.category ?? null, subcategory: raw?.subcategory ?? raw?.subcategory_name ?? raw?.subcategories?.name ?? null,
    location, image_url: imageUrls[0] ?? null, image_urls: imageUrls, itemRatingAvg, itemReviewCount,
    rentalCount, bumpedAt, bumpCount: asNumberOrNull(raw?.bumpCount ?? raw?.bump_count) ?? 0,
  } as NormalizedJob;
}

// 🎯 FB Style JobCard (Expo Image-тэй, Зүрхтэй)
function JobCard({
  job,
  getCategoryIcon,
  isSaved,
  onToggleSave,
}: {
  job: Job;
  getCategoryIcon: (name: string) => LucideIcon;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();

  const j = normalizeJob(job);
  const postedBy = j.postedBy;
  const name = postedBy?.name ?? "Хэрэглэгч";
  const initial = (name[0] ?? "?").toUpperCase();
  const photoUri = postedBy?.photoUri ?? null;
  const imageUrls: string[] = Array.isArray(j.image_urls) ? j.image_urls : [];

  const handleAvatarPress = () => {
    const userId = postedBy?.phone ?? postedBy?.id;
    if (!userId) return;
    router.push(`/user-profile?userId=${encodeURIComponent(String(userId))}`);
  };

  const handleCardPress = () => { router.push(`/job-detail?id=${j.id}`); };
  
  const formatDate = (date: Date) => {
    if (!date) return "Огноо алга";
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    if (diffInDays <= 0) return "Өнөөдөр";
    if (diffInDays === 1) return "Өчигдөр";
    return `${diffInDays} өдрийн өмнө`;
  };
  
  if (j?.isActive === false) return null;
  const CatIcon = getCategoryIcon(j.category ?? "");
  const isSponsored = !!j.isSponsored;
  const postedAtDate: Date = j.postedDate ?? toSafeDate((j as any).created_at ?? (j as any).updated_at);

  return (
    <TouchableOpacity style={[styles.jobCard, { backgroundColor: colors.card }]} activeOpacity={0.8} onPress={handleCardPress}>
      <View style={styles.feedHeader}>
        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.feedAvatar} transition={200} />
          ) : (
            <View style={[styles.feedAvatar, { backgroundColor: colors.accent }]}>
              <Text style={[styles.posterInitial, { color: colors.headerText }]}>{initial}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <View style={styles.feedHeaderInfo}>
          <Text style={[styles.feedPosterName, { color: colors.text }]}>{name}</Text>
          <View style={styles.feedMetaRow}>
            <Text style={[styles.feedDate, { color: colors.textSecondary }]}>{formatDate(postedAtDate)}</Text>
            {isSponsored && <Text style={[styles.feedSponsoredText, { color: colors.primary }]}> • Sponsored</Text>}
          </View>
        </View>

        <TouchableOpacity 
          style={{ padding: 4 }} 
          onPress={(e) => { e.stopPropagation(); onToggleSave(j.id); }}
        >
          <Heart size={24} color={isSaved ? "#FF4B4B" : colors.textSecondary} fill={isSaved ? "#FF4B4B" : "transparent"} />
        </TouchableOpacity>
      </View>

      <View style={styles.feedTextContent}>
        {j.category && j.category !== "Зар" && j.category !== "Категори" && (
           <Text style={[styles.feedMainTitle, { color: colors.text }]}>{j.title || j.category}</Text>
        )}
        {j.description && <Text style={[styles.feedMainDescription, { color: colors.text }]} numberOfLines={4}>{j.description}</Text>}
      </View>

      {imageUrls.length > 0 && (
        <View style={styles.jobImagesWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jobImagesScrollContent}>
            {imageUrls.slice(0, 5).map((uri, index) => (
              <Image key={`${j.id}-img-${index}`} source={{ uri }} style={styles.jobPreviewImage} contentFit="cover" transition={300} />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.feedFooter}>
        <View style={[styles.feedTagBadge, { backgroundColor: colors.backgroundSecondary }]}>
          <CatIcon size={14} color={colors.textSecondary} />
          <Text style={[styles.feedTagText, { color: colors.textSecondary }]} numberOfLines={1}>{j.category ?? "Категори"}</Text>
        </View>
        {j.subcategory ? (
          <View style={[styles.feedTagBadge, { backgroundColor: colors.backgroundSecondary }]}>
            <Tag size={14} color={colors.textSecondary} />
            <Text style={[styles.feedTagText, { color: colors.textSecondary }]} numberOfLines={1}>{j.subcategory}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function ThemeSelector({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { currentTheme, setTheme, colors } = useTheme() as any;
  const handleSelectTheme = (theme: ThemeType) => { if (typeof setTheme === "function") setTheme(theme); setTimeout(() => onClose(), 250); };
  const themeOptions: { type: ThemeType; name: string; description: string }[] = [
    { type: "purple", name: "Purple", description: "Нил ягаан өнгө" }, { type: "peach", name: "Peach", description: "Тоорын зөөлөн өнгө" },
    { type: "sky", name: "Sky", description: "Тэнгэрийн цэнхэр өнгө" }, { type: "navy", name: "Navy", description: "Бараан хөх өнгө" },
    { type: "gray", name: "Gray", description: "Саарал өнгө" }, { type: "mint", name: "Mint", description: "Минт ногоон өнгө" },
  ];
  const PREVIEW_BACKGROUNDS: Record<ThemeType, string> = { purple: "#6E0AB0", peach: "#FFE3DD", navy: "#201A2E", gray: "#D0D2D8", mint: "#8FE3CF", sky: "#AFC6D9" };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={onClose} />
        <View style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingBottom: 40, paddingHorizontal: 20, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>Theme сонгох</Text><TouchableOpacity onPress={onClose} style={{ padding: 4 }}><X size={24} color={colors.text} /></TouchableOpacity></View>
          <View style={{ gap: 12 }}>
            {themeOptions.map((option) => {
              const isSelected = currentTheme === option.type;
              return (
                <TouchableOpacity key={option.type} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.backgroundSecondary, borderColor: isSelected ? colors.primary : colors.border, borderWidth: isSelected ? 2 : 1 }} onPress={() => handleSelectTheme(option.type)} activeOpacity={0.7}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}><View style={{ width: 44, height: 44, borderRadius: 22, marginRight: 16, borderWidth: 1, backgroundColor: PREVIEW_BACKGROUNDS[option.type], borderColor: colors.border }} /><View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 2 }}>{option.name}</Text><Text style={{ fontSize: 12, color: colors.textSecondary }}>{option.description}</Text></View></View>
                  {isSelected && <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }}><Check size={18} color={colors.headerText} strokeWidth={3} /></View>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const { jobs, loadJobs, isLoading, searchJobs, clearSearch, savedJobIds, toggleSaveJob } = useJobs();
  const { colors, currentTheme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [dbCategories, setDbCategories] = useState<DbCategoryRow[]>([]);
  const [dbSubcategories, setDbSubcategories] = useState<DbSubcategoryRow[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [openCategoryIds, setOpenCategoryIds] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [safeIsLoading, setSafeIsLoading] = useState(true);
  useEffect(() => { setSafeIsLoading(isLoading); if (isLoading) { const fallbackTimer = setTimeout(() => { setSafeIsLoading(false); }, 5000); return () => clearTimeout(fallbackTimer); } }, [isLoading]);

  const searchJobsRef = useRef(searchJobs);
  const clearSearchRef = useRef(clearSearch);
  useEffect(() => { searchJobsRef.current = searchJobs; }, [searchJobs]);
  useEffect(() => { clearSearchRef.current = clearSearch; }, [clearSearch]);

  const [homeBanners, setHomeBanners] = useState<any[]>([]);
  const loadHomeBanners = useCallback(async () => { try { const b = await fetchBanners("home_feed", 3); setHomeBanners(b ?? []); } catch (e) { setHomeBanners([]); } }, []);

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const { data, error } = await supabase.from("categories").select("id,name,sort_order").order("sort_order", { ascending: true });
      if (error) throw error; setDbCategories((data as DbCategoryRow[]) ?? []);
      const { data: subs, error: subErr } = await supabase.from("subcategories").select("id,name,category_id,sort_order").order("sort_order", { ascending: true });
      if (subErr) throw subErr; setDbSubcategories((subs as DbSubcategoryRow[]) ?? []);
    } catch (e) { setDbCategories([]); setDbSubcategories([]); } finally { setCategoriesLoading(false); }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { loadHomeBanners(); }, [loadHomeBanners]);
  useEffect(() => { if (!lastUpdatedAt && jobs.length > 0) setLastUpdatedAt(new Date()); }, [jobs, lastUpdatedAt]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const q = searchText.trim();
      await Promise.all([q ? searchJobsRef.current ? searchJobsRef.current(q) : Promise.resolve() : loadJobs(), fetchCategories(), loadHomeBanners()]);
      setLastUpdatedAt(new Date());
    } catch (e) {} finally { setRefreshing(false); }
  }, [loadJobs, fetchCategories, searchText, loadHomeBanners]);

  const normalizedJobs: NormalizedJob[] = useMemo(() => (jobs as any[]).map(normalizeJob), [jobs]);
  const subByCategoryId = useMemo(() => { const m: Record<string, DbSubcategoryRow[]> = {}; for (const s of dbSubcategories) { if (!m[s.category_id]) m[s.category_id] = []; m[s.category_id].push(s); } return m; }, [dbSubcategories]);
  const categoryById = useMemo(() => { const map: Record<string, DbCategoryRow> = {}; for (const item of dbCategories) map[item.id] = item; return map; }, [dbCategories]);
  const subcategoryById = useMemo(() => { const map: Record<string, DbSubcategoryRow> = {}; for (const item of dbSubcategories) map[item.id] = item; return map; }, [dbSubcategories]);
  const categoryNames = useMemo(() => dbCategories.map((c) => c.name).filter(Boolean), [dbCategories]);
  const categoryIconMap = useMemo(() => buildUniqueIconMap(categoryNames), [categoryNames]);
  const getCategoryIcon = useCallback((name: string) => { if (!name) return Tag; return categoryIconMap[name] ?? Tag; }, [categoryIconMap]);
  const selectedCategoryNames = useMemo(() => selectedCategoryIds.map((id) => categoryById[id]?.name).filter(Boolean), [selectedCategoryIds, categoryById]);
  const selectedSubcategoryNames = useMemo(() => selectedSubcategoryIds.map((id) => subcategoryById[id]?.name).filter(Boolean), [selectedSubcategoryIds, subcategoryById]);
  
  const filteredJobs = useMemo(() => {
    return normalizedJobs
      .filter((job) => {
        if (job?.isActive === false) return false;
        const available = Number((job as any)?.available_quantity ?? (job as any)?.availableQuantity ?? (job as any)?.quantity ?? 1);
        if (Number.isFinite(available) && available <= 0) return false;
        let matches = true;
        if (selectedFilter === "need") matches = matches && job.postType === "worker";
        else if (selectedFilter === "rent") matches = matches && job.postType === "job";
        const hasMain = selectedCategoryIds.length > 0;
        const hasSub = selectedSubcategoryIds.length > 0;
        if (hasMain || hasSub) {
          const mainOk = hasMain ? selectedCategoryIds.some((id) => { const pickedName = categoryById[id]?.name; return ((!!job.category_id && String(job.category_id) === id) || (!!pickedName && !!job.category && normalizeText(job.category) === normalizeText(pickedName))); }) : true;
          const subOk = hasSub ? selectedSubcategoryIds.some((id) => { const pickedName = subcategoryById[id]?.name; return ((!!job.subcategory_id && String(job.subcategory_id) === id) || (!!pickedName && !!job.subcategory && normalizeText(job.subcategory) === normalizeText(pickedName))); }) : true;
          matches = matches && (hasSub ? subOk : mainOk);
        }
        return matches;
      })
      .sort((a, b) => {
        const scoreDiff = getJobRankingScore(b) - getJobRankingScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        const aPosted = a?.postedDate?.getTime?.() ?? 0;
        const bPosted = b?.postedDate?.getTime?.() ?? 0;
        return bPosted - aPosted;
      });
  }, [normalizedJobs, selectedFilter, selectedCategoryIds, selectedSubcategoryIds, categoryById, subcategoryById]);

  const toggleOpen = (id: string) => { setOpenCategoryIds((prev) => ({ ...prev, [id]: !prev[id] })); };
  const toggleMain = (catId: string) => { setSelectedCategoryIds((prev) => { const on = prev.includes(catId); const next = on ? prev.filter((x) => x !== catId) : [...prev, catId]; if (on) { const subs = (subByCategoryId[catId] ?? []).map((s) => s.id); setSelectedSubcategoryIds((current) => current.filter((id) => !subs.includes(id))); } return next; }); };
  const toggleSub = (catId: string, subId: string) => { setSelectedCategoryIds((prev) => prev.includes(catId) ? prev : [...prev, catId]); setSelectedSubcategoryIds((prev) => { const on = prev.includes(subId); return on ? prev.filter((x) => x !== subId) : [...prev, subId]; }); };
  const matchesSearch = useCallback((text: string) => searchMatch(text, categorySearch), [categorySearch]);
  const canApply = selectedCategoryIds.length > 0 || selectedSubcategoryIds.length > 0;
  
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const q = searchText.trim();
      try {
        if (!q) { if (clearSearchRef.current) await clearSearchRef.current(); } else { if (searchJobsRef.current) await searchJobsRef.current(q); }
        setLastUpdatedAt(new Date());
      } catch (e) {}
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchText]);
  
  const clearTopSearch = useCallback(async () => { setSearchText(""); try { if (clearSearchRef.current) await clearSearchRef.current(); setLastUpdatedAt(new Date()); } catch (e) {} }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={["top"]} style={[styles.safeArea, { backgroundColor: colors.headerBackground }]}>
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.headerText }]}>Сайн байна уу</Text>
          <View style={styles.headerRight}>
            <Image source={getLogoSource(currentTheme)} style={styles.logo} contentFit="contain" />
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Search size={20} color="#666666" />
            <TextInput style={[styles.searchInput, { color: "#111111" }]} placeholder="Хайх" placeholderTextColor="#666666" value={searchText} onChangeText={setSearchText} returnKeyType="search" />
            {!!searchText.trim() && (<TouchableOpacity onPress={clearTopSearch} activeOpacity={0.8} style={{ padding: 4 }}><X size={18} color="#666666" /></TouchableOpacity>)}
          </View>
          <TouchableOpacity style={[styles.categoryIconBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setShowCategoryModal(true)}><ClipboardList size={22} color={colors.primary} /></TouchableOpacity>
        </View>

        {(selectedCategoryNames.length > 0 || selectedSubcategoryNames.length > 0) && (
          <View style={styles.selectedCategoryContainer}>
            <View style={[styles.selectedCategoryBadge, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={{ flex: 1 }}>
                {selectedCategoryNames.length > 0 && <Text style={[styles.selectedCategoryText, { color: colors.text }]}>Категори: {selectedCategoryNames.join(", ")}</Text>}
                {selectedSubcategoryNames.length > 0 && <Text style={[styles.selectedCategoryText, { color: colors.text, marginTop: 4 }]}>Дэд: {selectedSubcategoryNames.join(", ")}</Text>}
              </View>
              <TouchableOpacity onPress={() => { setSelectedCategoryIds([]); setSelectedSubcategoryIds([]); }} style={styles.clearCategoryButton} activeOpacity={0.7}><X size={18} color={colors.textSecondary} /></TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.contentContainer} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Шинэ зарууд</Text>
          <TouchableOpacity onPress={async () => { setSelectedFilter("all"); setSelectedCategoryIds([]); setSelectedSubcategoryIds([]); await clearTopSearch(); }} activeOpacity={0.75}><Text style={[styles.seeAll, { color: colors.text }]}>Бүгдийг харах</Text></TouchableOpacity>
        </View>

        {/* 🎯 ШИНЭ: Skeleton loader харуулж байна */}
        {safeIsLoading && !refreshing && (
          <View>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        )}

        {lastUpdatedAt && <Text style={{ paddingHorizontal: 20, marginBottom: 10, opacity: 0.6, color: colors.textSecondary }}>Сүүлийн шинэчлэлт: {lastUpdatedAt.toLocaleTimeString()}</Text>}

        {!safeIsLoading && filteredJobs.length === 0 ? (
          <View style={styles.emptyWrap}><Text style={[styles.emptyTitle, { color: colors.text }]}>Зар олдсонгүй</Text><Text style={[styles.emptyText, { color: colors.textSecondary }]}>Хайлтын үг эсвэл шүүлтүүрээ өөрчлөөд дахин үзээрэй</Text></View>
        ) : (
          filteredJobs.map((job, idx) => {
            const oneBased = idx + 1;
            const shouldShowBanner = oneBased >= 6 && (oneBased - 6) % 20 === 0;
            return (
              <React.Fragment key={job.id}>
                <JobCard 
                  job={job as Job} 
                  getCategoryIcon={getCategoryIcon} 
                  isSaved={savedJobIds.includes(job.id)} 
                  onToggleSave={toggleSaveJob} 
                />
                {shouldShowBanner && homeBanners.length > 0 ? (<View style={{ marginTop: 8, marginBottom: 12 }}><BannerCarousel banners={homeBanners} /></View>) : null}
              </React.Fragment>
            );
          })
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      <TouchableOpacity style={[styles.floatingButton, { backgroundColor: colors.primary }]} onPress={() => setShowThemeSelector(true)} activeOpacity={0.8}><Palette size={24} color={colors.headerText} /></TouchableOpacity>
      <ThemeSelector visible={showThemeSelector} onClose={() => setShowThemeSelector(false)} />

      <Modal visible={showCategoryModal} animationType="slide" transparent statusBarTranslucent onShow={() => { Keyboard.dismiss(); }} onRequestClose={() => setShowCategoryModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCategoryModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalKeyboardWrap}>
            <Pressable onPress={(e) => e.stopPropagation()} style={[styles.modalContent, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
              <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.text }]}>Категори сонгох</Text><TouchableOpacity onPress={() => setShowCategoryModal(false)} style={styles.closeButton}><X size={24} color={colors.text} /></TouchableOpacity></View>
              <TextInput style={[styles.modalSearchInput, { backgroundColor: colors.backgroundSecondary, color: colors.text }]} placeholder="Категори / дэд хайх..." placeholderTextColor={colors.textSecondary} value={categorySearch} onChangeText={setCategorySearch} />
              {(selectedCategoryIds.length > 0 || selectedSubcategoryIds.length > 0) && (<TouchableOpacity style={[styles.clearButton, { backgroundColor: colors.accent }]} onPress={() => { setSelectedCategoryIds([]); setSelectedSubcategoryIds([]); setCategorySearch(""); setShowCategoryModal(false); }}><Text style={[styles.clearButtonText, { color: colors.text }]}>Бүгдийг харах</Text></TouchableOpacity>)}
              <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {categoriesLoading ? (
                  <View style={{ paddingVertical: 24, alignItems: "center", justifyContent: "center" }}><ActivityIndicator /><Text style={{ marginTop: 10, color: colors.textSecondary }}>Категори татаж байна...</Text></View>
                ) : dbCategories.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.textSecondary, textAlign: "center" }}>Категори олдсонгүй.</Text></View>
                ) : (
                  dbCategories.filter((c) => { const subs = subByCategoryId[c.id] ?? []; return matchesSearch(c.name) || subs.some((s) => matchesSearch(s.name)); }).map((c) => {
                      const subs = subByCategoryId[c.id] ?? [];
                      const categoryMatches = matchesSearch(c.name);
                      const isSearching = !!categorySearch.trim();
                      const isOpen = isSearching ? categoryMatches || subs.some((s) => matchesSearch(s.name)) || !!openCategoryIds[c.id] : !!openCategoryIds[c.id];
                      const mainOn = selectedCategoryIds.includes(c.id);
                      const MainIcon = getCategoryIcon(c.name);
                      const visibleSubs = isSearching ? categoryMatches ? subs : subs.filter((s) => matchesSearch(s.name)) : subs;
                      return (
                        <View key={c.id} style={{ marginBottom: 8 }}>
                          <TouchableOpacity style={[styles.categoryItem, { backgroundColor: colors.backgroundSecondary, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }, mainOn && { backgroundColor: colors.accent }]} activeOpacity={0.85} onPress={() => toggleOpen(c.id)}>
                            <View style={{ flex: 1 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><MainIcon size={18} color={colors.text} /><Text style={[styles.categoryItemText, { color: colors.text, fontWeight: mainOn ? "800" : "700" }]} numberOfLines={1}>{c.name}</Text></View>{subs.length > 0 ? (<Text style={{ marginTop: 2, opacity: 0.6, color: colors.textSecondary }} numberOfLines={1}>{isOpen ? "Дэдүүдийг нуух" : "Дэдүүдийг харах"}</Text>) : (<View style={{ height: 0 }} />)}</View>
                            <TouchableOpacity onPress={() => toggleMain(c.id)} activeOpacity={0.85} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" }}><Text style={{ fontWeight: "800", color: colors.text }}>{mainOn ? "Сонгосон" : "Сонгох"}</Text></TouchableOpacity>
                          </TouchableOpacity>
                          {isOpen && visibleSubs.length > 0 && (
                            <View style={{ paddingLeft: 12, paddingTop: 6, gap: 6 }}>
                              {visibleSubs.map((s) => {
                                const subOn = selectedSubcategoryIds.includes(s.id);
                                return (<TouchableOpacity key={s.id} activeOpacity={0.85} onPress={() => toggleSub(c.id, s.id)} style={[styles.categoryItem, { backgroundColor: colors.backgroundSecondary, paddingVertical: 12 }, subOn && { backgroundColor: colors.accent }]}><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Tag size={16} color={colors.text} /><Text style={[styles.categoryItemText, { color: colors.text, fontWeight: subOn ? "800" : "600" }]}>{s.name} {subOn ? "✓" : ""}</Text></View></TouchableOpacity>);
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })
                )}
              </ScrollView>
              <TouchableOpacity style={[styles.applyButton, { backgroundColor: colors.accent }, !canApply && { opacity: 0.45 }]} disabled={!canApply} onPress={() => { setShowCategoryModal(false); setCategorySearch(""); }} activeOpacity={0.85}><Text style={[styles.applyButtonText, { color: colors.text }]}>Сонгох</Text></TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { paddingBottom: 16, zIndex: 10, elevation: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  greeting: { fontSize: 18, fontWeight: "600" },
  logo: { width: 140, height: 60 },
  searchRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, gap: 10, marginBottom: 12 },
  searchContainer: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, gap: 10 },
  searchInput: { flex: 1, fontSize: 16, padding: 0 },
  categoryIconBtn: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  content: { flex: 1 },
  contentContainer: { paddingTop: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  seeAll: { fontSize: 14, fontWeight: "600" },
  jobCard: { marginHorizontal: 20, marginBottom: 12, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  feedHeader: { flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 10, gap: 12 },
  feedAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#E9E9E9", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  posterInitial: { fontSize: 18, fontWeight: "700" },
  feedHeaderInfo: { flex: 1, justifyContent: "center" },
  feedPosterName: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  feedMetaRow: { flexDirection: "row", alignItems: "center" },
  feedDate: { fontSize: 13 },
  feedSponsoredText: { fontSize: 13, fontWeight: "700" },
  feedTextContent: { paddingHorizontal: 16, paddingBottom: 12 },
  feedMainTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  feedMainDescription: { fontSize: 15, lineHeight: 22 },
  feedFooter: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, gap: 8, flexWrap: "wrap" },
  feedTagBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 6 },
  feedTagText: { fontSize: 13, fontWeight: "600" },
  jobImagesWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  jobImagesScrollContent: { paddingRight: 4, gap: 8 },
  jobPreviewImage: { width: 150, height: 110, borderRadius: 12, backgroundColor: "#E9E9E9" },
  emptyWrap: { paddingHorizontal: 24, paddingVertical: 36, alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  bottomPadding: { height: 20 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "flex-end" },
  modalKeyboardWrap: { flex: 1, justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20, maxHeight: "82%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  closeButton: { padding: 4 },
  modalSearchInput: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  clearButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 12, alignItems: "center" },
  clearButtonText: { fontSize: 15, fontWeight: "600" },
  applyButton: { marginTop: 8, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  applyButtonText: { fontSize: 15, fontWeight: "800" },
  categoryList: { marginBottom: 8 },
  categoryItem: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#F9F9F9" },
  categoryItemText: { fontSize: 15 },
  floatingButton: { position: "absolute", right: 20, bottom: 90, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  selectedCategoryContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  selectedCategoryBadge: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, gap: 8 },
  selectedCategoryText: { fontSize: 14, fontWeight: "700" },
  clearCategoryButton: { padding: 4 },
});