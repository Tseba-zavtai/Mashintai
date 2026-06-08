import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getLogoSource } from "@/constants/logo";
import {
  Image,
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
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
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

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;
type FilterType = "all" | "rent" | "need";

type DbCategoryRow = {
  id: string;
  name: string;
  sort_order: number | null;
};

type DbSubcategoryRow = {
  id: string;
  name: string;
  category_id: string;
  sort_order: number | null;
};

type NormalizedJob = Job & {
  category_id?: string | null;
  subcategory_id?: string | null;
  category?: string | null;
  subcategory?: string | null;
  postType?: string | null;
  isActive?: boolean;
  isSponsored?: boolean;
  sponsoredUntil?: Date | null;
  postedBy?: any;
  postedDate?: Date;
  location?: any;
  image_url?: string | null;
  image_urls?: string[];
  itemRatingAvg?: number | null;
  itemReviewCount?: number;
  rentalCount?: number;
  bumpedAt?: Date | null;
  bumpCount?: number;
};

const THEME_OPTIONS: Array<{
  key: ThemeType;
  color: string;
  ringColor: string;
}> = [
  { key: "purple", color: "#6E0AB0", ringColor: "#FFFFFF" },
  { key: "peach", color: "#FFE3DD", ringColor: "#6E0AB0" },
  { key: "sky", color: "#AFC6D9", ringColor: "#6E0AB0" },
  { key: "navy", color: "#201A2E", ringColor: "#FFE3DD" },
  { key: "gray", color: "#D0D2D8", ringColor: "#6E0AB0" },
  { key: "mint", color: "#8FE3CF", ringColor: "#6E0AB0" },
];

const THEME_ITEM_SIZE = 58;
const THEME_ITEM_GAP = 14;
const THEME_SIDE_PADDING = 20;
const THEME_SNAP_INTERVAL = THEME_ITEM_SIZE + THEME_ITEM_GAP;

function toSafeDate(value: any): Date {
  if (!value) return new Date();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function normalizeText(s: string) {
  return (s ?? "").toLowerCase().trim();
}

function cyrillicToLatin(input: string) {
  const text = (input ?? "").toLowerCase();

  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "j",
    з: "z",
    и: "i",
    й: "i",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    ө: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ү: "u",
    ф: "f",
    х: "kh",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sh",
    ъ: "",
    ы: "ii",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  let out = "";
  for (const ch of text) out += map[ch] ?? ch;
  return out;
}

function normalizeForSearch(input: string) {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яёөү0-9]+/gi, "");
}

function latinToCyrillic(input: string) {
  let s = (input ?? "").trim().toLowerCase().replace(/\s+/g, " ");

  const rules: Array<[RegExp, string]> = [
    [/sch/g, "щ"],
    [/sh/g, "ш"],
    [/ch/g, "ч"],
    [/ts/g, "ц"],
    [/ya/g, "я"],
    [/yo/g, "ё"],
    [/yu/g, "ю"],
    [/ye/g, "е"],
    [/kh/g, "х"],
  ];

  for (const [re, rep] of rules) s = s.replace(re, rep);

  const map: Record<string, string> = {
    a: "а",
    b: "б",
    v: "в",
    g: "г",
    d: "д",
    e: "е",
    z: "з",
    i: "и",
    j: "ж",
    k: "к",
    l: "л",
    m: "м",
    n: "н",
    o: "о",
    p: "п",
    r: "р",
    s: "с",
    t: "т",
    u: "у",
    f: "ф",
    h: "х",
    y: "й",
    q: "к",
    w: "в",
    x: "кс",
    c: "к",
  };

  let out = "";
  for (const ch of s) out += map[ch] ?? ch;
  return out;
}

function buildSearchVariants(input: string): string[] {
  const raw = (input ?? "").trim();
  if (!raw) return [];

  const variants = new Set<string>();

  const add = (v: string) => {
    const n = normalizeForSearch(v);
    if (n) variants.add(n);
  };

  add(raw);
  add(latinToCyrillic(raw));
  add(cyrillicToLatin(raw));

  const lowered = raw.toLowerCase();

  add(lowered.replace(/oo/g, "o"));
  add(lowered.replace(/uu/g, "u"));
  add(lowered.replace(/ii/g, "i"));
  add(lowered.replace(/ee/g, "e"));
  add(lowered.replace(/aa/g, "a"));

  add(lowered.replace(/kh/g, "h"));
  add(lowered.replace(/sh/g, "s"));
  add(lowered.replace(/ch/g, "c"));

  add(latinToCyrillic(lowered.replace(/oo/g, "o")));
  add(latinToCyrillic(lowered.replace(/uu/g, "u")));
  add(latinToCyrillic(lowered.replace(/ii/g, "i")));
  add(latinToCyrillic(lowered.replace(/kh/g, "h")));
  add(latinToCyrillic(lowered.replace(/sh/g, "s")));
  add(latinToCyrillic(lowered.replace(/ch/g, "c")));

  return Array.from(variants);
}

function searchMatch(text: string, query: string) {
  const variants = buildSearchVariants(query);
  if (variants.length === 0) return true;

  const original = normalizeForSearch(text);
  const translit = normalizeForSearch(cyrillicToLatin(text));

  return variants.some((q) => original.includes(q) || translit.includes(q));
}

function normalizeImageUrls(raw: any): string[] {
  const source = raw?.image_urls ?? raw?.imageUrls ?? null;

  if (Array.isArray(source)) {
    return source.filter((x) => typeof x === "string" && x.trim().length > 0);
  }

  if (typeof source === "string" && source.trim()) {
    try {
      const parsed = JSON.parse(source);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (x) => typeof x === "string" && x.trim().length > 0,
        );
      }
    } catch {
      return [source];
    }
  }

  const fallback = raw?.image_url ?? raw?.imageUrl ?? null;
  if (typeof fallback === "string" && fallback.trim()) {
    return [fallback];
  }

  return [];
}

function getSponsoredUntilDate(raw: any): Date | null {
  const sponsoredUntilRaw =
    raw?.sponsoredUntil ??
    raw?.sponsored_until ??
    raw?.sponsoredEnd ??
    raw?.sponsored_end ??
    raw?.sponsored_expires_at ??
    null;

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
  const postedTs =
    job?.postedDate?.getTime?.() ??
    toSafeDate(job?.created_at ?? job?.updated_at).getTime();
  const bumpedTs =
    job?.bumpedAt?.getTime?.() ?? getBumpedAtDate(job)?.getTime?.() ?? 0;
  const sponsoredUntilTs = job?.sponsoredUntil?.getTime?.() ?? 0;
  const isSponsored = !!job?.isSponsored && sponsoredUntilTs > now;
  const itemRating =
    asNumberOrNull(job?.itemRatingAvg ?? job?.item_rating_avg) ?? 0;
  const userRating =
    asNumberOrNull(job?.postedBy?.userRatingAvg ?? job?.user_rating_avg) ?? 0;
  const rentalCount =
    asNumberOrNull(job?.rentalCount ?? job?.rental_count) ?? 0;

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

  score += itemRating * 4_000;
  score += userRating * 2_000;
  score += Math.min(rentalCount, 100) * 80;
  score += postedTs / 1_000_000_000;
  return score;
}

const CATEGORY_ICON_OVERRIDE: Record<string, LucideIcon> = {
  "Тээврийн хэрэгсэл": Car,
  "Барилга, засварын тоног төхөөрөмж": Hammer,
  "Арга хэмжээ, event-ийн хэрэгсэл": Music,
  "Ахуйн болон өдөр тутмын хэрэглээ": Home,
  "Аялал, outdoor хэрэгсэл": Plane,
  "Фото, видео, контентын тоног төхөөрөмж": Camera,
  "Тоглоом, entertainment": Gamepad2,
  "Оффис, бизнесийн хэрэглээ": Briefcase,
  "Хүнд машин механизм, тусгай хэрэгсэл": Truck,
  "Хувцас, тусгай хэрэглээ": Shirt,
  "Спорт, хобби": Dumbbell,
  "Мал аж ахуй, хөдөө аж ахуйн хэрэгсэл": Leaf,
};

function iconByKeyword(name: string): LucideIcon {
  const t = normalizeText(name);

  if (
    t.includes("тээврийн") ||
    t.includes("машин") ||
    t.includes("suv") ||
    t.includes("pickup") ||
    t.includes("ачааны") ||
    t.includes("микро") ||
    t.includes("мото") ||
    t.includes("скүүтер") ||
    t.includes("унадаг дугуй") ||
    t.includes("цахилгаан дугуй") ||
    t.includes("caravan") ||
    t.includes("trailer") ||
    t.includes("vehicle") ||
    t.includes("auto")
  ) {
    return Car;
  }

  if (
    t.includes("барилга") ||
    t.includes("засвар") ||
    t.includes("тоног төхөөрөмж") ||
    t.includes("өрөм") ||
    t.includes("дрилл") ||
    t.includes("бетон") ||
    t.includes("хөрөө") ||
    t.includes("гагнуур") ||
    t.includes("шат") ||
    t.includes("лазер") ||
    t.includes("компрессор") ||
    t.includes("генератор") ||
    t.includes("насос") ||
    t.includes("tool")
  ) {
    return Hammer;
  }

  if (
    t.includes("арга хэмжээ") ||
    t.includes("event") ||
    t.includes("майхан") ||
    t.includes("тайз") ||
    t.includes("speaker") ||
    t.includes("microphone") ||
    t.includes("karaoke") ||
    t.includes("projector") ||
    t.includes("led") ||
    t.includes("photo booth") ||
    t.includes("гэрэлтүүлэг")
  ) {
    return Music;
  }

  if (
    t.includes("ахуйн") ||
    t.includes("өдөр тутмын") ||
    t.includes("хүүхдийн тэрэг") ||
    t.includes("машины суудал") ||
    t.includes("нялх") ||
    t.includes("wheelchair") ||
    t.includes("өвчтөний ор") ||
    t.includes("халаагуур") ||
    t.includes("air purifier") ||
    t.includes("vacuum") ||
    t.includes("carpet cleaner") ||
    t.includes("household")
  ) {
    return Home;
  }

  if (
    t.includes("аялал") ||
    t.includes("outdoor") ||
    t.includes("кемп") ||
    t.includes("унтлагын уут") ||
    t.includes("хийн плитка") ||
    t.includes("cool box") ||
    t.includes("загасчлал") ||
    t.includes("gps") ||
    t.includes("walkie") ||
    t.includes("portable battery") ||
    t.includes("power bank") ||
    t.includes("travel")
  ) {
    return Plane;
  }

  if (
    t.includes("фото") ||
    t.includes("видео") ||
    t.includes("контент") ||
    t.includes("camera") ||
    t.includes("lens") ||
    t.includes("gimbal") ||
    t.includes("tripod") ||
    t.includes("drone") ||
    t.includes("action camera") ||
    t.includes("lighting kit") ||
    t.includes("teleprompter") ||
    t.includes("backdrop")
  ) {
    return Camera;
  }

  if (
    t.includes("тоглоом") ||
    t.includes("entertainment") ||
    t.includes("vr") ||
    t.includes("board games") ||
    t.includes("air hockey") ||
    t.includes("sim racing") ||
    t.includes("ps") ||
    t.includes("nintendo") ||
    t.includes("sega") ||
    t.includes("projector + screen")
  ) {
    return Gamepad2;
  }

  if (
    t.includes("оффис") ||
    t.includes("бизнес") ||
    t.includes("зөөврийн компьютер") ||
    t.includes("printer") ||
    t.includes("scanner") ||
    t.includes("pos") ||
    t.includes("barcode") ||
    t.includes("label printer") ||
    t.includes("speakerphone") ||
    t.includes("tablet") ||
    t.includes("wi-fi") ||
    t.includes("router") ||
    t.includes("дэлгэц") ||
    t.includes("office")
  ) {
    return Briefcase;
  }

  if (
    t.includes("хүнд машин") ||
    t.includes("тусгай хэрэгсэл") ||
    t.includes("сэрээт ачигч") ||
    t.includes("кран") ||
    t.includes("ковш") ||
    t.includes("индүү") ||
    t.includes("excavator") ||
    t.includes("pallet jack") ||
    t.includes("hand stacker") ||
    t.includes("machinery")
  ) {
    return Truck;
  }

  if (
    t.includes("хувцас") ||
    t.includes("гоёлын даашинз") ||
    t.includes("үндэсний хувцас") ||
    t.includes("костюм") ||
    t.includes("тайзны хувцас") ||
    t.includes("mascot") ||
    t.includes("хамгаалалтын хувцас") ||
    t.includes("dress")
  ) {
    return Shirt;
  }

  if (
    t.includes("спорт") ||
    t.includes("хобби") ||
    t.includes("цана") ||
    t.includes("snowboard") ||
    t.includes("тэшүүр") ||
    t.includes("фитнес") ||
    t.includes("paddle board") ||
    t.includes("kayak") ||
    t.includes("tennis") ||
    t.includes("boxing")
  ) {
    return Dumbbell;
  }

  if (
    t.includes("мал аж ахуй") ||
    t.includes("хөдөө аж ахуй") ||
    t.includes("өвс хадах") ||
    t.includes("сэндийлэгч") ||
    t.includes("мотоблок") ||
    t.includes("шүршигч") ||
    t.includes("усалгааны насос") ||
    t.includes("цахилгаан хашаа") ||
    t.includes("agri") ||
    t.includes("farm")
  ) {
    return Leaf;
  }

  if (
    t.includes("гэр") ||
    t.includes("орон сууц") ||
    t.includes("house") ||
    t.includes("home")
  )
    return Home;
  if (t.includes("тавилга") || t.includes("furniture") || t.includes("sofa"))
    return Sofa;
  if (t.includes("мото") || t.includes("bike") || t.includes("унадаг"))
    return Bike;
  if (t.includes("тээвэр") || t.includes("truck") || t.includes("логистик"))
    return Truck;
  if (
    t.includes("комп") ||
    t.includes("computer") ||
    t.includes("monitor") ||
    t.includes("pc")
  )
    return Monitor;
  if (
    t.includes("утас") ||
    t.includes("phone") ||
    t.includes("mobile") ||
    t.includes("smart")
  )
    return Smartphone;
  if (t.includes("бэлэг") || t.includes("gift")) return Gift;
  if (t.includes("хөгжим") || t.includes("music") || t.includes("instrument"))
    return Music;
  if (t.includes("хүүхэд") || t.includes("baby") || t.includes("kid"))
    return Baby;
  if (
    t.includes("амьтан") ||
    t.includes("pet") ||
    t.includes("dog") ||
    t.includes("cat")
  )
    return Dog;
  if (t.includes("бараа") || t.includes("item") || t.includes("product"))
    return Package;

  return Tag;
}

function buildUniqueIconMap(categoryNames: string[]) {
  const pool: LucideIcon[] = [
    Briefcase,
    Wrench,
    Leaf,
    HeartHandshake,
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
    Gift,
    BadgeHelp,
    Sofa,
    Package,
    Bike,
    Shirt,
    Music,
    Gamepad2,
    Baby,
    Dog,
    Scissors,
    Scale,
    TrendingUp,
    FolderKanban,
    Globe,
    Camera,
    Dumbbell,
    GraduationCap,
    Plane,
    Ticket,
    ShoppingCart,
    Sparkles,
    Hammer,
  ];

  const used = new Set<LucideIcon>();
  const map: Record<string, LucideIcon> = {};

  for (const name of categoryNames) {
    const override = CATEGORY_ICON_OVERRIDE[name];
    if (override) {
      map[name] = override;
      used.add(override);
    }
  }

  for (const name of categoryNames) {
    if (map[name]) continue;
    const keywordIcon = iconByKeyword(name);
    if (keywordIcon !== Tag) {
      map[name] = keywordIcon;
      used.add(keywordIcon);
    }
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
  const postedBy = raw?.postedBy ??
    raw?.posted_by ?? {
      id: raw?.posted_by_id ?? null,
      name: raw?.posted_by_name ?? raw?.posted_by_phone ?? "Unknown",
      phone: raw?.posted_by_phone ?? null,
      photoUri: raw?.posted_by_photo ?? null,
    };

  const postedDate = raw?.postedDate ?? raw?.created_at ?? raw?.updated_at;
  const sponsoredUntil = getSponsoredUntilDate(raw);
  const legacySponsored = !!(raw?.isSponsored ?? raw?.is_sponsored ?? false);
  const isSponsoredByTime = sponsoredUntil
    ? sponsoredUntil.getTime() > Date.now()
    : false;
  const computedIsSponsored = sponsoredUntil
    ? isSponsoredByTime
    : legacySponsored;

  const location =
    raw?.location && typeof raw.location === "object"
      ? raw.location
      : raw?.address
        ? {
            address: raw.address,
            latitude: raw?.latitude ?? null,
            longitude: raw?.longitude ?? null,
          }
        : null;

  const imageUrls = normalizeImageUrls(raw);
  const bumpedAt = getBumpedAtDate(raw);
  const itemRatingAvg = asNumberOrNull(
    raw?.itemRatingAvg ?? raw?.item_rating_avg,
  );
  const itemReviewCount =
    asNumberOrNull(raw?.itemReviewCount ?? raw?.item_review_count) ?? 0;
  const rentalCount =
    asNumberOrNull(raw?.rentalCount ?? raw?.rental_count) ?? itemReviewCount;

  return {
    ...raw,
    category_id: raw?.category_id ?? null,
    subcategory_id: raw?.subcategory_id ?? null,
    isSponsored: computedIsSponsored,
    sponsoredUntil,
    postType: raw?.postType ?? raw?.post_type ?? "job",
    isActive: raw?.isActive ?? raw?.is_active ?? true,
    postedBy,
    postedDate: toSafeDate(postedDate),
    category: raw?.category ?? null,
    subcategory:
      raw?.subcategory ??
      raw?.subcategory_name ??
      raw?.subcategories?.name ??
      null,
    location,
    image_url: imageUrls[0] ?? null,
    image_urls: imageUrls,
    itemRatingAvg,
    itemReviewCount,
    rentalCount,
    bumpedAt,
    bumpCount: asNumberOrNull(raw?.bumpCount ?? raw?.bump_count) ?? 0,
  } as NormalizedJob;
}

function JobCard({
  job,
  getCategoryIcon,
}: {
  job: Job;
  getCategoryIcon: (name: string) => LucideIcon;
}) {
  const router = useRouter();
  const { colors, currentTheme } = useTheme();

  const j = normalizeJob(job);
  const postedBy = j.postedBy;
  const name = postedBy?.name ?? "Unknown";
  const initial = (name[0] ?? "?").toUpperCase();
  const photoUri = postedBy?.photoUri ?? null;
  const imageUrls: string[] = Array.isArray(j.image_urls) ? j.image_urls : [];

  const handleAvatarPress = () => {
    const userId = postedBy?.phone ?? postedBy?.id;
    if (!userId) return;
    router.push(`/user-profile?userId=${encodeURIComponent(String(userId))}`);
  };

  const handleCardPress = () => {
    router.push(`/job-detail?id=${j.id}`);
  };

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
  const postedAtDate: Date =
    j.postedDate ?? toSafeDate((j as any).created_at ?? (j as any).updated_at);
  const itemRating = j.itemRatingAvg ?? (j as any).item_rating_avg ?? null;
  const itemReviewCount =
    j.itemReviewCount ?? (j as any).item_review_count ?? 0;
  const rentalCount =
    j.rentalCount ?? (j as any).rental_count ?? itemReviewCount;
  const userRating =
    postedBy?.userRatingAvg ?? (j as any).user_rating_avg ?? null;
  const userReviewCount = postedBy?.userReviewCount ?? 0;

  return (
    <TouchableOpacity
      style={[styles.jobCard, { backgroundColor: colors.card }]}
      activeOpacity={0.7}
      onPress={handleCardPress}
    >
      <View style={styles.jobPosterSection}>
        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.posterAvatar} />
          ) : (
            <View
              style={[styles.posterAvatar, { backgroundColor: colors.accent }]}
            >
              <Text
                style={[
                  styles.posterInitial,
                  { color: currentTheme === "navy" ? "#121212" : "#1A1A1A" },
                ]}
              >
                {initial}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.jobHeaderContent}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <CatIcon size={18} color={colors.text} />
            <Text
              style={[styles.jobTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {j.category ?? "Категори"}
            </Text>
          </View>

          {j.subcategory ? (
            <View
              style={{
                marginTop: 4,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                opacity: 0.85,
              }}
            >
              <Tag size={14} color={colors.textSecondary} />
              <Text
                style={{ color: colors.textSecondary, fontSize: 13 }}
                numberOfLines={1}
              >
                {j.subcategory}
              </Text>
            </View>
          ) : (
            <View style={{ height: 0 }} />
          )}

          {isSponsored ? (
            <Text
              style={[styles.sponsoredUnderCategory, { color: "#FFB800" }]}
              numberOfLines={1}
            >
              Sponsored
            </Text>
          ) : (
            <View style={{ height: 0 }} />
          )}

          <View style={styles.ratingLine}>
            <Text
              style={[styles.ratingLineText, { color: colors.textSecondary }]}
            >
              ★ {formatRating(itemRating)} эд зүйл · ★{" "}
              {formatRating(userRating)} хүн
              {rentalCount ? ` · ${rentalCount} түрээс` : ""}
            </Text>
          </View>

          <View style={styles.jobMetaInfo}>
            <Text style={[styles.posterName, { color: colors.textSecondary }]}>
              {name}
            </Text>
            <Text style={[styles.metaDot, { color: colors.textSecondary }]}>
              •
            </Text>
            <Text style={[styles.posterDate, { color: colors.textSecondary }]}>
              {formatDate(postedAtDate)}
            </Text>
          </View>
        </View>
      </View>

      {imageUrls.length > 0 ? (
        <View style={styles.jobImagesWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.jobImagesScrollContent}
          >
            {imageUrls.slice(0, 5).map((uri, index) => (
              <Image
                key={`${j.id}-img-${index}`}
                source={{ uri }}
                style={styles.jobPreviewImage}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.jobContent}>
        <Text
          style={[styles.jobDescription, { color: colors.textSecondary }]}
          numberOfLines={3}
        >
          {j.description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ThemeSwipePicker({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { currentTheme, setTheme } = useTheme() as {
    currentTheme: ThemeType;
    setTheme?: (theme: ThemeType) => void;
  };
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);

  const selectedIndex = Math.max(
    0,
    THEME_OPTIONS.findIndex((item) => item.key === currentTheme),
  );

  const centerOffset = Math.max(
    0,
    (width - THEME_ITEM_SIZE) / 2 - THEME_SIDE_PADDING,
  );

  const scrollToIndex = useCallback((index: number, animated = true) => {
    const x = index * THEME_SNAP_INTERVAL;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x, animated });
    });
  }, []);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        scrollToIndex(selectedIndex, false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visible, selectedIndex, scrollToIndex]);

  const applyTheme = useCallback(
    (theme: ThemeType, index: number) => {
      if (typeof setTheme === "function") {
        setTheme(theme);
      }
      scrollToIndex(index);
    },
    [setTheme, scrollToIndex],
  );

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const index = Math.round(x / THEME_SNAP_INTERVAL);
      const safeIndex = Math.max(0, Math.min(index, THEME_OPTIONS.length - 1));
      const picked = THEME_OPTIONS[safeIndex];

      if (
        picked &&
        picked.key !== currentTheme &&
        typeof setTheme === "function"
      ) {
        setTheme(picked.key);
      }

      scrollToIndex(safeIndex, true);
    },
    [currentTheme, setTheme, scrollToIndex],
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.themeOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.themeSheet,
            {
              paddingBottom: Math.max(insets.bottom, 14) + 12,
            },
          ]}
        >
          <View style={styles.themeSheetHeader}>
            <View style={styles.themeHandle} />
            <TouchableOpacity
              style={styles.themeCloseButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <X size={22} color="#201A2E" />
            </TouchableOpacity>
          </View>

          <View style={styles.themeIntroRow}>
            <Palette size={18} color="#6E0AB0" />
            <Text style={styles.themeIntroTitle}>Theme</Text>
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={THEME_SNAP_INTERVAL}
            snapToAlignment="start"
            disableIntervalMomentum
            bounces={false}
            onMomentumScrollEnd={onMomentumEnd}
            contentContainerStyle={{
              paddingLeft: THEME_SIDE_PADDING + centerOffset,
              paddingRight: THEME_SIDE_PADDING + centerOffset,
              alignItems: "center",
            }}
          >
            {THEME_OPTIONS.map((item, index) => {
              const active = item.key === currentTheme;

              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.9}
                  onPress={() => applyTheme(item.key, index)}
                  style={[
                    styles.themeCircleWrap,
                    {
                      marginRight:
                        index === THEME_OPTIONS.length - 1 ? 0 : THEME_ITEM_GAP,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.themeCircleOuter,
                      active && {
                        width: 68,
                        height: 68,
                        borderRadius: 34,
                        borderColor: item.ringColor,
                        shadowOpacity: 0.18,
                        elevation: 8,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.themeCircle,
                        {
                          backgroundColor: item.color,
                        },
                        active && styles.themeCircleActive,
                      ]}
                    >
                      {active ? (
                        <Check size={18} color={item.ringColor} />
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const { jobs, loadJobs, isLoading, searchJobs, clearSearch } = useJobs();
  const { colors, currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmall = width < 380;

  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<
    string[]
  >([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [dbCategories, setDbCategories] = useState<DbCategoryRow[]>([]);
  const [dbSubcategories, setDbSubcategories] = useState<DbSubcategoryRow[]>(
    [],
  );
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [openCategoryIds, setOpenCategoryIds] = useState<
    Record<string, boolean>
  >({});
  const [searchText, setSearchText] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchJobsRef = useRef(searchJobs);
  const clearSearchRef = useRef(clearSearch);

  useEffect(() => {
    searchJobsRef.current = searchJobs;
  }, [searchJobs]);

  useEffect(() => {
    clearSearchRef.current = clearSearch;
  }, [clearSearch]);

  const [homeBanners, setHomeBanners] = useState<any[]>([]);

  const loadHomeBanners = useCallback(async () => {
    try {
      const b = await fetchBanners("home_feed", 3);
      setHomeBanners(b ?? []);
    } catch (e) {
      console.log("FETCH HOME BANNERS ERROR:", e);
      setHomeBanners([]);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,sort_order")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setDbCategories((data as DbCategoryRow[]) ?? []);

      const { data: subs, error: subErr } = await supabase
        .from("subcategories")
        .select("id,name,category_id,sort_order")
        .order("sort_order", { ascending: true });

      if (subErr) throw subErr;
      setDbSubcategories((subs as DbSubcategoryRow[]) ?? []);
    } catch (e) {
      console.log("FETCH CATEGORIES ERROR:", e);
      setDbCategories([]);
      setDbSubcategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    loadHomeBanners();
  }, [loadHomeBanners]);

  useEffect(() => {
    if (!lastUpdatedAt && jobs.length > 0) {
      setLastUpdatedAt(new Date());
    }
  }, [jobs, lastUpdatedAt]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const q = searchText.trim();
      await Promise.all([
        q
          ? searchJobsRef.current
            ? searchJobsRef.current(q)
            : Promise.resolve()
          : loadJobs(),
        fetchCategories(),
        loadHomeBanners(),
      ]);
      setLastUpdatedAt(new Date());
    } catch (e) {
      console.log("REFRESH ERROR:", e);
    } finally {
      setRefreshing(false);
    }
  }, [loadJobs, fetchCategories, searchText, loadHomeBanners]);

  const normalizedJobs: NormalizedJob[] = useMemo(
    () => (jobs as any[]).map(normalizeJob),
    [jobs],
  );

  const subByCategoryId = useMemo(() => {
    const m: Record<string, DbSubcategoryRow[]> = {};
    for (const s of dbSubcategories) {
      if (!m[s.category_id]) m[s.category_id] = [];
      m[s.category_id].push(s);
    }
    return m;
  }, [dbSubcategories]);

  const categoryById = useMemo(() => {
    const map: Record<string, DbCategoryRow> = {};
    for (const item of dbCategories) map[item.id] = item;
    return map;
  }, [dbCategories]);

  const subcategoryById = useMemo(() => {
    const map: Record<string, DbSubcategoryRow> = {};
    for (const item of dbSubcategories) map[item.id] = item;
    return map;
  }, [dbSubcategories]);

  const categoryNames = useMemo(
    () => dbCategories.map((c) => c.name).filter(Boolean),
    [dbCategories],
  );

  const categoryIconMap = useMemo(
    () => buildUniqueIconMap(categoryNames),
    [categoryNames],
  );

  const getCategoryIcon = useCallback(
    (name: string) => {
      if (!name) return Tag;
      return categoryIconMap[name] ?? Tag;
    },
    [categoryIconMap],
  );

  const selectedCategoryNames = useMemo(
    () =>
      selectedCategoryIds.map((id) => categoryById[id]?.name).filter(Boolean),
    [selectedCategoryIds, categoryById],
  );

  const selectedSubcategoryNames = useMemo(
    () =>
      selectedSubcategoryIds
        .map((id) => subcategoryById[id]?.name)
        .filter(Boolean),
    [selectedSubcategoryIds, subcategoryById],
  );

  const filteredJobs = useMemo(() => {
    return normalizedJobs
      .filter((job) => {
        if (job?.isActive === false) return false;

        let matches = true;

        if (selectedFilter === "need") {
          matches = matches && job.postType === "worker";
        } else if (selectedFilter === "rent") {
          matches = matches && job.postType === "job";
        }

        const hasMain = selectedCategoryIds.length > 0;
        const hasSub = selectedSubcategoryIds.length > 0;

        if (hasMain || hasSub) {
          const mainOk = hasMain
            ? selectedCategoryIds.some((id) => {
                const pickedName = categoryById[id]?.name;
                return (
                  (!!job.category_id && String(job.category_id) === id) ||
                  (!!pickedName &&
                    !!job.category &&
                    normalizeText(job.category) === normalizeText(pickedName))
                );
              })
            : true;

          const subOk = hasSub
            ? selectedSubcategoryIds.some((id) => {
                const pickedName = subcategoryById[id]?.name;
                return (
                  (!!job.subcategory_id && String(job.subcategory_id) === id) ||
                  (!!pickedName &&
                    !!job.subcategory &&
                    normalizeText(job.subcategory) ===
                      normalizeText(pickedName))
                );
              })
            : true;

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
  }, [
    normalizedJobs,
    selectedFilter,
    selectedCategoryIds,
    selectedSubcategoryIds,
    categoryById,
    subcategoryById,
  ]);

  const toggleOpen = (id: string) => {
    setOpenCategoryIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleMain = (catId: string) => {
    setSelectedCategoryIds((prev) => {
      const on = prev.includes(catId);
      const next = on ? prev.filter((x) => x !== catId) : [...prev, catId];

      if (on) {
        const subs = (subByCategoryId[catId] ?? []).map((s) => s.id);
        setSelectedSubcategoryIds((current) =>
          current.filter((id) => !subs.includes(id)),
        );
      }

      return next;
    });
  };

  const toggleSub = (catId: string, subId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev : [...prev, catId],
    );
    setSelectedSubcategoryIds((prev) => {
      const on = prev.includes(subId);
      return on ? prev.filter((x) => x !== subId) : [...prev, subId];
    });
  };

  const matchesSearch = useCallback(
    (text: string) => searchMatch(text, categorySearch),
    [categorySearch],
  );

  const canApply =
    selectedCategoryIds.length > 0 || selectedSubcategoryIds.length > 0;

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(async () => {
      const q = searchText.trim();

      try {
        if (!q) {
          if (clearSearchRef.current) await clearSearchRef.current();
        } else {
          if (searchJobsRef.current) await searchJobsRef.current(q);
        }
        setLastUpdatedAt(new Date());
      } catch (e) {
        console.log("SEARCH ERROR:", e);
      }
    }, 350);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchText]);

  const clearTopSearch = useCallback(async () => {
    setSearchText("");
    try {
      if (clearSearchRef.current) await clearSearchRef.current();
      setLastUpdatedAt(new Date());
    } catch (e) {
      console.log("CLEAR SEARCH ERROR:", e);
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.safeArea, { backgroundColor: colors.headerBackground }]}
      >
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.headerText }]}>
            Сайн байна уу
          </Text>
          <Image
            source={getLogoSource(currentTheme)}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color="#666666" />
          <TextInput
            style={[styles.searchInput, { color: "#111111" }]}
            placeholder="Хайх"
            placeholderTextColor="#666666"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          {!!searchText.trim() && (
            <TouchableOpacity
              onPress={clearTopSearch}
              activeOpacity={0.8}
              style={{ padding: 4 }}
            >
              <X size={18} color="#666666" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.filterButton,
              styles.touchSafeButton,
              isSmall && { paddingHorizontal: 6, paddingVertical: 9 },
              pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => {
              Keyboard.dismiss();
              setShowCategoryModal(true);
            }}
            android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
            hitSlop={8}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              allowFontScaling={false}
              style={[
                styles.filterButtonText,
                { color: colors.text, fontSize: isSmall ? 12 : 13 },
              ]}
            >
              Категори
              {selectedCategoryIds.length || selectedSubcategoryIds.length
                ? ` (${selectedCategoryIds.length}/${selectedSubcategoryIds.length})`
                : ""}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.filterButton,
              styles.touchSafeButton,
              isSmall && { paddingHorizontal: 6, paddingVertical: 9 },
              selectedFilter === "need" && styles.filterButtonActive,
            ]}
            onPress={() =>
              setSelectedFilter((prev) => (prev === "need" ? "all" : "need"))
            }
            android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
            hitSlop={8}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              allowFontScaling={false}
              style={[
                styles.filterButtonText,
                {
                  color: selectedFilter === "need" ? "#fff" : colors.text,
                  fontSize: isSmall ? 12 : 13,
                },
              ]}
            >
              Түрээслэх
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.filterButton,
              styles.touchSafeButton,
              isSmall && { paddingHorizontal: 6, paddingVertical: 9 },
              selectedFilter === "rent" && styles.filterButtonActive,
            ]}
            onPress={() =>
              setSelectedFilter((prev) => (prev === "rent" ? "all" : "rent"))
            }
            android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
            hitSlop={8}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              allowFontScaling={false}
              style={[
                styles.filterButtonText,
                {
                  color: selectedFilter === "rent" ? "#fff" : colors.text,
                  fontSize: isSmall ? 11 : 13,
                },
              ]}
            >
              Түрээслүүлэх
            </Text>
          </Pressable>
        </View>

        {(selectedCategoryNames.length > 0 ||
          selectedSubcategoryNames.length > 0) && (
          <View style={styles.selectedCategoryContainer}>
            <View
              style={[
                styles.selectedCategoryBadge,
                { backgroundColor: colors.backgroundSecondary },
              ]}
            >
              <View style={{ flex: 1 }}>
                {selectedCategoryNames.length > 0 && (
                  <Text
                    style={[
                      styles.selectedCategoryText,
                      { color: colors.text },
                    ]}
                  >
                    Категори: {selectedCategoryNames.join(", ")}
                  </Text>
                )}
                {selectedSubcategoryNames.length > 0 && (
                  <Text
                    style={[
                      styles.selectedCategoryText,
                      { color: colors.text, marginTop: 4 },
                    ]}
                  >
                    Дэд: {selectedSubcategoryNames.join(", ")}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={() => {
                  setSelectedCategoryIds([]);
                  setSelectedSubcategoryIds([]);
                }}
                style={styles.clearCategoryButton}
                activeOpacity={0.7}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Шинэ зарууд
          </Text>

          <TouchableOpacity
            onPress={async () => {
              setSelectedFilter("all");
              setSelectedCategoryIds([]);
              setSelectedSubcategoryIds([]);
              await clearTopSearch();
            }}
            activeOpacity={0.75}
          >
            <Text style={[styles.seeAll, { color: colors.text }]}>
              Бүгдийг харах
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading && !refreshing && (
          <View style={{ paddingVertical: 16, alignItems: "center" }}>
            <ActivityIndicator />
          </View>
        )}

        {lastUpdatedAt && (
          <Text
            style={{
              paddingHorizontal: 20,
              marginBottom: 10,
              opacity: 0.6,
              color: colors.textSecondary,
            }}
          >
            Сүүлийн шинэчлэлт: {lastUpdatedAt.toLocaleTimeString()}
          </Text>
        )}

        {!isLoading && filteredJobs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Зар олдсонгүй
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Хайлтын үг эсвэл шүүлтүүрээ өөрчлөөд дахин үзээрэй
            </Text>
          </View>
        ) : (
          filteredJobs.map((job, idx) => {
            const oneBased = idx + 1;
            const shouldShowBanner = oneBased >= 6 && (oneBased - 6) % 20 === 0;

            return (
              <React.Fragment key={job.id}>
                <JobCard job={job as Job} getCategoryIcon={getCategoryIcon} />

                {shouldShowBanner && homeBanners.length > 0 ? (
                  <View style={{ marginTop: 8, marginBottom: 12 }}>
                    <BannerCarousel banners={homeBanners} />
                  </View>
                ) : null}
              </React.Fragment>
            );
          })
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.floatingButton, { backgroundColor: colors.accent }]}
        onPress={() => setShowThemeSelector(true)}
        activeOpacity={0.8}
      >
        <Palette size={24} color={colors.headerText} />
      </TouchableOpacity>

      <ThemeSwipePicker
        visible={showThemeSelector}
        onClose={() => setShowThemeSelector(false)}
      />

      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent
        statusBarTranslucent
        onShow={() => {
          Keyboard.dismiss();
        }}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCategoryModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalKeyboardWrap}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={[
                styles.modalContent,
                {
                  backgroundColor: colors.card,
                  paddingBottom: Math.max(insets.bottom, 12) + 12,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Категори сонгох
                </Text>
                <TouchableOpacity
                  onPress={() => setShowCategoryModal(false)}
                  style={styles.closeButton}
                >
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.modalSearchInput,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    color: colors.text,
                  },
                ]}
                placeholder="Категори / дэд хайх..."
                placeholderTextColor={colors.textSecondary}
                value={categorySearch}
                onChangeText={setCategorySearch}
              />

              {(selectedCategoryIds.length > 0 ||
                selectedSubcategoryIds.length > 0) && (
                <TouchableOpacity
                  style={[
                    styles.clearButton,
                    { backgroundColor: colors.accent },
                  ]}
                  onPress={() => {
                    setSelectedCategoryIds([]);
                    setSelectedSubcategoryIds([]);
                    setCategorySearch("");
                    setShowCategoryModal(false);
                  }}
                >
                  <Text
                    style={[styles.clearButtonText, { color: colors.text }]}
                  >
                    Бүгдийг харах
                  </Text>
                </TouchableOpacity>
              )}

              <ScrollView
                style={styles.categoryList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {categoriesLoading ? (
                  <View
                    style={{
                      paddingVertical: 24,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ActivityIndicator />
                    <Text
                      style={{ marginTop: 10, color: colors.textSecondary }}
                    >
                      Категори татаж байна...
                    </Text>
                  </View>
                ) : dbCategories.length === 0 ? (
                  <View
                    style={{
                      paddingVertical: 24,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        textAlign: "center",
                      }}
                    >
                      Категори олдсонгүй.
                      {"\n"}(Supabase дээр seed ажилласан эсэхээ шалгаарай)
                    </Text>
                  </View>
                ) : (
                  dbCategories
                    .filter((c) => {
                      const subs = subByCategoryId[c.id] ?? [];
                      const categoryMatches = matchesSearch(c.name);
                      const hasMatchingSub = subs.some((s) =>
                        matchesSearch(s.name),
                      );
                      return categoryMatches || hasMatchingSub;
                    })
                    .map((c) => {
                      const subs = subByCategoryId[c.id] ?? [];
                      const categoryMatches = matchesSearch(c.name);
                      const hasMatchingSub = subs.some((s) =>
                        matchesSearch(s.name),
                      );
                      const isSearching = !!categorySearch.trim();

                      const isOpen = isSearching
                        ? categoryMatches ||
                          hasMatchingSub ||
                          !!openCategoryIds[c.id]
                        : !!openCategoryIds[c.id];

                      const mainOn = selectedCategoryIds.includes(c.id);
                      const MainIcon = getCategoryIcon(c.name);

                      const visibleSubs = isSearching
                        ? categoryMatches
                          ? subs
                          : subs.filter((s) => matchesSearch(s.name))
                        : subs;

                      return (
                        <View key={c.id} style={{ marginBottom: 8 }}>
                          <TouchableOpacity
                            style={[
                              styles.categoryItem,
                              {
                                backgroundColor: colors.backgroundSecondary,
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 10,
                              },
                              mainOn && { backgroundColor: colors.accent },
                            ]}
                            activeOpacity={0.85}
                            onPress={() => toggleOpen(c.id)}
                          >
                            <View style={{ flex: 1 }}>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <MainIcon size={18} color={colors.text} />
                                <Text
                                  style={[
                                    styles.categoryItemText,
                                    {
                                      color: colors.text,
                                      fontWeight: mainOn ? "800" : "700",
                                    },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {c.name}
                                </Text>
                              </View>

                              {subs.length > 0 ? (
                                <Text
                                  style={{
                                    marginTop: 2,
                                    opacity: 0.6,
                                    color: colors.textSecondary,
                                  }}
                                  numberOfLines={1}
                                >
                                  {isOpen
                                    ? "Дэдүүдийг нуух"
                                    : "Дэдүүдийг харах"}
                                </Text>
                              ) : (
                                <View style={{ height: 0 }} />
                              )}
                            </View>

                            <TouchableOpacity
                              onPress={() => toggleMain(c.id)}
                              activeOpacity={0.85}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 7,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.12)",
                              }}
                            >
                              <Text
                                style={{
                                  fontWeight: "800",
                                  color: colors.text,
                                }}
                              >
                                {mainOn ? "Сонгосон" : "Сонгох"}
                              </Text>
                            </TouchableOpacity>
                          </TouchableOpacity>

                          {isOpen && visibleSubs.length > 0 && (
                            <View
                              style={{ paddingLeft: 12, paddingTop: 6, gap: 6 }}
                            >
                              {visibleSubs.map((s) => {
                                const subOn = selectedSubcategoryIds.includes(
                                  s.id,
                                );

                                return (
                                  <TouchableOpacity
                                    key={s.id}
                                    activeOpacity={0.85}
                                    onPress={() => toggleSub(c.id, s.id)}
                                    style={[
                                      styles.categoryItem,
                                      {
                                        backgroundColor:
                                          colors.backgroundSecondary,
                                        paddingVertical: 12,
                                      },
                                      subOn && {
                                        backgroundColor: colors.accent,
                                      },
                                    ]}
                                  >
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 10,
                                      }}
                                    >
                                      <Tag size={16} color={colors.text} />
                                      <Text
                                        style={[
                                          styles.categoryItemText,
                                          {
                                            color: colors.text,
                                            fontWeight: subOn ? "800" : "600",
                                          },
                                        ]}
                                      >
                                        {s.name} {subOn ? "✓" : ""}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })
                )}
              </ScrollView>

              <TouchableOpacity
                style={[
                  styles.applyButton,
                  { backgroundColor: colors.accent },
                  !canApply && { opacity: 0.45 },
                ]}
                disabled={!canApply}
                onPress={() => {
                  setShowCategoryModal(false);
                  setCategorySearch("");
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.applyButtonText, { color: colors.text }]}>
                  Сонгох
                </Text>
              </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  greeting: { fontSize: 18, fontWeight: "600" as const },
  logo: { width: 140, height: 60 },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 16, padding: 0 },

  content: { flex: 1 },
  contentContainer: { paddingTop: 16 },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" as const },
  seeAll: { fontSize: 14, fontWeight: "600" as const },

  jobCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  ratingLine: {
    marginTop: 6,
  },
  ratingLineText: {
    fontSize: 12,
    fontWeight: "700" as const,
  },

  jobMetaInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 6,
  },
  metaDot: { fontSize: 12, color: "#666666" },

  jobPosterSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  jobHeaderContent: { flex: 1 },

  jobImagesWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  jobImagesScrollContent: {
    paddingRight: 4,
    gap: 8,
  },
  jobPreviewImage: {
    width: 150,
    height: 110,
    borderRadius: 12,
    backgroundColor: "#E9E9E9",
  },

  jobContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
    gap: 6,
  },

  jobTitle: { fontSize: 18, fontWeight: "700" as const, color: "#1A1A1A" },
  jobDescription: { fontSize: 14, color: "#666666", lineHeight: 20 },

  posterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F8E75D",
    alignItems: "center",
    justifyContent: "center",
  },
  posterInitial: { fontSize: 20, fontWeight: "700" as const, color: "#1A1A1A" },
  posterName: { fontSize: 13, fontWeight: "400" as const, color: "#666666" },
  posterDate: { fontSize: 13, fontWeight: "400" as const, color: "#666666" },

  sponsoredUnderCategory: {
    fontSize: 14,
    fontWeight: "800" as const,
    marginTop: 6,
    color: "#FFB800",
  },

  emptyWrap: {
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  bottomPadding: { height: 20 },

  filterContainer: {
    flexDirection: "row",
    zIndex: 20,
    elevation: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  filterButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9F9F9",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: "#F9F9F9",
  },
  filterButtonActive: {
    backgroundColor: "#1A1A1A",
    borderColor: "#1A1A1A",
  },
  touchSafeButton: {
    zIndex: 30,
    elevation: 30,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600" as const,
    textAlign: "center" as const,
    flexShrink: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalKeyboardWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: "82%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "700" as const },
  closeButton: { padding: 4 },

  modalSearchInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  clearButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  clearButtonText: { fontSize: 15, fontWeight: "600" as const },

  applyButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  applyButtonText: { fontSize: 15, fontWeight: "800" as const },

  categoryList: { marginBottom: 8 },
  categoryItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F9F9F9",
  },
  categoryItemText: { fontSize: 15 },

  floatingButton: {
    position: "absolute" as const,
    right: 20,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  selectedCategoryContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  selectedCategoryBadge: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  selectedCategoryText: { fontSize: 14, fontWeight: "700" as const },
  clearCategoryButton: { padding: 4 },

  themeOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  themeSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 0,
  },
  themeSheetHeader: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
    position: "relative",
  },
  themeHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D0D2D8",
  },
  themeCloseButton: {
    position: "absolute",
    right: 18,
    top: -4,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F4F8",
  },
  themeIntroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },
  themeIntroTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#201A2E",
  },
  themeCircleWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  themeCircleOuter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0,
    shadowRadius: 10,
    elevation: 0,
  },
  themeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  themeCircleActive: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
});
