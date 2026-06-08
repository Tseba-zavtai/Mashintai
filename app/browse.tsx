import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Search,
  SlidersHorizontal,
  ArrowLeft,
  X,
  Tag,
  Car,
  Wrench,
  Ticket,
  Home,
  Plane,
  Camera,
  Gamepad2,
  Briefcase,
  Truck,
  Shirt,
  Dumbbell,
  Leaf,
  Monitor,
  Smartphone,
  Package,
  Bike,
  Music,
  Baby,
  MapPin,
  Users,
  ClipboardList,
  Shield,
  PhoneCall,
  Settings,
  Building2,
  Utensils,
  Gift,
  BadgeHelp,
  Check,
  Sofa,
  Hammer,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useJobs } from "@/contexts/JobsContext";
import { useTheme } from "@/contexts/ThemeContext";

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;

type BrowseJob = {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  subcategory?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  postedDate: Date | string;
  isSponsored?: boolean;
  postType?: string | null;
  postedBy: {
    name: string;
    phone: string;
    jobsCompleted?: number;
    photoUri?: string | null;
    id?: string | null;
  };
};

type SearchResultItem = {
  id: string;
  type: "job" | "category" | "subcategory" | "person";
  title: string;
  subtitle?: string;
  data?: BrowseJob | string;
};

const RENTAL_CATEGORY_MAP: Record<string, string[]> = {
  "Тээврийн хэрэгсэл": [
    "Суудлын машин",
    "SUV",
    "Pickup",
    "Ачааны машин",
    "Микро",
    "Мотоцикл",
    "Скүүтер",
    "Унадаг дугуй",
    "Цахилгаан дугуй",
    "Caravan / trailer",
  ],
  "Барилга, засварын тоног төхөөрөмж": [
    "Өрөм",
    "Дрилл",
    "Бетон зүсэгч",
    "Цахилгаан хөрөө",
    "Гагнуурын аппарат",
    "Шат",
    "Лазер тэгш ус",
    "Компрессор",
    "Генератор",
    "Усны насос",
  ],
  "Арга хэмжээ, event-ийн хэрэгсэл": [
    "Майхан",
    "Ширээ сандал",
    "Тайзны тоноглол",
    "Speaker",
    "Microphone",
    "Karaoke set",
    "Projector",
    "LED screen",
    "Photo booth",
    "Гэрэлтүүлэг",
  ],
  "Ахуйн болон өдөр тутмын хэрэглээ": [
    "Хүүхдийн тэрэг",
    "Хүүхдийн машины суудал",
    "Нялх хүүхдийн ор",
    "Wheelchair",
    "Өвчтөний ор",
    "Зөөврийн халаагуур",
    "Air purifier",
    "Vacuum cleaner",
    "Carpet cleaner",
  ],
  "Аялал, outdoor хэрэгсэл": [
    "Кемпийн майхан",
    "Унтлагын уут",
    "Кемпийн ширээ сандал",
    "Хийн плитка",
    "Cool box",
    "Загасчлалын хэрэгсэл",
    "Уулын дугуй",
    "GPS төхөөрөмж",
    "Walkie talkie/станц",
    "Portable battery/power bank",
  ],
  "Фото, видео, контентын тоног төхөөрөмж": [
    "Camera",
    "Lens",
    "Gimbal",
    "Tripod",
    "Drone",
    "Action camera",
    "Lighting kit",
    "Microphone",
    "Teleprompter",
    "Backdrop stand",
  ],
  "Тоглоом, entertainment": [
    "Projector + screen set",
    "Karaoke set",
    "VR headset",
    "Board games багц",
    "Air hockey / party game set",
    "Sim racing setup",
    "PS, Nintendo, Sega, etc",
  ],
  "Оффис, бизнесийн хэрэглээ": [
    "Зөөврийн компьютер",
    "Printer",
    "Scanner",
    "POS төхөөрөмж",
    "Barcode scanner",
    "Label printer",
    "Meeting speakerphone",
    "Tablet",
    "Wi-Fi router",
    "Зөөврийн дэлгэц",
  ],
  "Хүнд машин механизм, тусгай хэрэгсэл": [
    "Сэрээт ачигч",
    "Кран",
    "Ковш",
    "Индүү",
    "Excavator төрлийн техник",
    "Pallet jack",
    "Hand stacker",
  ],
  "Хувцас, тусгай хэрэглээ": [
    "Гоёлын даашинз",
    "Үндэсний хувцас",
    "Костюм",
    "Тайзны хувцас",
    "Mascot хувцас",
    "Хамгаалалтын хувцас",
  ],
  "Спорт, хобби": [
    "Цанын хэрэгсэл",
    "Snowboard",
    "Тэшүүр",
    "Фитнес тоног төхөөрөмж",
    "Paddle board",
    "Kayak",
    "Tennis racket",
    "Boxing gear",
  ],
  "Мал аж ахуй, хөдөө аж ахуйн хэрэгсэл": [
    "Өвс хадах машин",
    "Газар сэндийлэгч",
    "Мотоблок",
    "Шүршигч аппарат",
    "Усалгааны насос",
    "Цахилгаан хашааны төхөөрөмж",
  ],
};

const SUBCATEGORY_TO_CATEGORY = Object.entries(RENTAL_CATEGORY_MAP).reduce(
  (acc, [category, subcategories]) => {
    subcategories.forEach((subcategory) => {
      acc[subcategory] = category;
    });
    return acc;
  },
  {} as Record<string, string>
);

function toSafeDate(value: any): Date {
  if (!value) return new Date();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatDate(date: Date | string): string {
  const safeDate = toSafeDate(date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - safeDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Өнөөдөр";
  if (diffDays === 1) return "Өчигдөр";
  if (diffDays < 7) return `${diffDays} өдрийн өмнө`;
  return safeDate.toLocaleDateString("mn-MN");
}

function normalizeText(input: string) {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яёөү0-9]+/gi, "");
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
    const n = normalizeText(v);
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

function searchMatch(text: string, query: string): boolean {
  const variants = buildSearchVariants(query);
  if (variants.length === 0) return true;

  const original = normalizeText(text);
  const translit = normalizeText(cyrillicToLatin(text));

  return variants.some((q) => original.includes(q) || translit.includes(q));
}

function normalizeJob(raw: any): BrowseJob {
  return {
    ...raw,
    category: raw?.category ?? null,
    subcategory:
      raw?.subcategory ?? raw?.subcategory_name ?? raw?.subcategories?.name ?? null,
    category_id: raw?.category_id ?? null,
    subcategory_id: raw?.subcategory_id ?? null,
    postedDate: raw?.postedDate ?? raw?.created_at ?? raw?.updated_at ?? new Date(),
    isSponsored: !!(raw?.isSponsored ?? raw?.is_sponsored ?? false),
    postType: raw?.postType ?? raw?.post_type ?? null,
    postedBy: raw?.postedBy ?? {
      name: raw?.posted_by_name ?? "Unknown",
      phone: raw?.posted_by_phone ?? "",
      jobsCompleted: raw?.posted_by_jobs_completed ?? 0,
      photoUri: raw?.posted_by_photo ?? null,
      id: raw?.posted_by_id ?? null,
    },
  };
}

const CATEGORY_ICON_OVERRIDE: Record<string, LucideIcon> = {
  "Тээврийн хэрэгсэл": Car,
  "Барилга, засварын тоног төхөөрөмж": Wrench,
  "Арга хэмжээ, event-ийн хэрэгсэл": Ticket,
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
  const t = (name ?? "").toLowerCase().trim();

  if (
    t.includes("тээвэр") ||
    t.includes("машин") ||
    t.includes("suv") ||
    t.includes("pickup") ||
    t.includes("мото") ||
    t.includes("дугуй")
  ) {
    return Car;
  }

  if (
    t.includes("барилга") ||
    t.includes("засвар") ||
    t.includes("өрөм") ||
    t.includes("дрилл") ||
    t.includes("генератор") ||
    t.includes("компрессор")
  ) {
    return Wrench;
  }

  if (
    t.includes("арга хэмжээ") ||
    t.includes("event") ||
    t.includes("projector") ||
    t.includes("karaoke") ||
    t.includes("speaker") ||
    t.includes("microphone") ||
    t.includes("гэрэлтүүлэг")
  ) {
    return Ticket;
  }

  if (
    t.includes("ахуйн") ||
    t.includes("өдөр тутмын") ||
    t.includes("heater") ||
    t.includes("vacuum") ||
    t.includes("wheelchair") ||
    t.includes("хүүхдийн")
  ) {
    return Home;
  }

  if (
    t.includes("аялал") ||
    t.includes("outdoor") ||
    t.includes("кемп") ||
    t.includes("унтлагын") ||
    t.includes("загас") ||
    t.includes("gps")
  ) {
    return Plane;
  }

  if (
    t.includes("фото") ||
    t.includes("видео") ||
    t.includes("camera") ||
    t.includes("lens") ||
    t.includes("drone") ||
    t.includes("tripod") ||
    t.includes("gimbal")
  ) {
    return Camera;
  }

  if (
    t.includes("тоглоом") ||
    t.includes("entertainment") ||
    t.includes("vr") ||
    t.includes("ps") ||
    t.includes("nintendo") ||
    t.includes("sega") ||
    t.includes("sim racing")
  ) {
    return Gamepad2;
  }

  if (
    t.includes("оффис") ||
    t.includes("бизнес") ||
    t.includes("printer") ||
    t.includes("scanner") ||
    t.includes("tablet") ||
    t.includes("router") ||
    t.includes("computer")
  ) {
    return Briefcase;
  }

  if (
    t.includes("хүнд машин") ||
    t.includes("кран") ||
    t.includes("ковш") ||
    t.includes("excavator") ||
    t.includes("pallet") ||
    t.includes("ачигч")
  ) {
    return Truck;
  }

  if (
    t.includes("хувцас") ||
    t.includes("даашинз") ||
    t.includes("костюм") ||
    t.includes("үндэсний") ||
    t.includes("mascot") ||
    t.includes("хамгаалалт")
  ) {
    return Shirt;
  }

  if (
    t.includes("спорт") ||
    t.includes("хобби") ||
    t.includes("snowboard") ||
    t.includes("тэшүүр") ||
    t.includes("fitness") ||
    t.includes("kayak") ||
    t.includes("boxing")
  ) {
    return Dumbbell;
  }

  if (
    t.includes("мал") ||
    t.includes("хөдөө") ||
    t.includes("мотоблок") ||
    t.includes("усалгаа") ||
    t.includes("шүршигч") ||
    t.includes("хадах")
  ) {
    return Leaf;
  }

  if (t.includes("computer") || t.includes("дэлгэц") || t.includes("monitor")) return Monitor;
  if (t.includes("tablet") || t.includes("pos") || t.includes("router")) return Smartphone;
  if (t.includes("projector") || t.includes("led")) return Monitor;
  if (t.includes("майхан") || t.includes("ширээ") || t.includes("stand")) return Package;
  if (t.includes("bike") || t.includes("дугуй")) return Bike;
  if (t.includes("speaker") || t.includes("music")) return Music;
  if (t.includes("baby") || t.includes("нялх") || t.includes("хүүхдийн")) return Baby;
  if (t.includes("drone") || t.includes("camera")) return Camera;
  if (t.includes("office") || t.includes("business")) return Building2;
  if (t.includes("generator") || t.includes("apparat")) return Hammer;

  return Tag;
}

function buildUniqueIconMap(categoryNames: string[]) {
  const pool: LucideIcon[] = [
    Briefcase,
    Wrench,
    Leaf,
    MapPin,
    Users,
    ClipboardList,
    Shield,
    Home,
    PhoneCall,
    Settings,
    Building2,
    Utensils,
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
    Camera,
    Dumbbell,
    Plane,
    Ticket,
    Hammer,
    Check,
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

function getLogoUri(currentTheme: string) {
  return currentTheme === "navy"
    ? "https://r2-pub.rork.com/attachments/7h0ju4xu59gyen0tzh8ns"
    : "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/0rqqd3riktgmfxudfl0s8";
}

function JobCard({
  job,
  getCategoryIcon,
}: {
  job: BrowseJob;
  getCategoryIcon: (name: string) => LucideIcon;
}) {
  const router = useRouter();
  const { colors } = useTheme();

  const initial = (job.postedBy?.name?.charAt(0) || "?").toUpperCase();
  const IconComponent = getCategoryIcon(job.category ?? "");

  const handleAvatarPress = () => {
    const userId = job.postedBy?.phone || job.postedBy?.id || "";
    if (!userId) return;
    router.push(`/user-profile?userId=${encodeURIComponent(userId)}`);
  };

  const handleCardPress = () => {
    router.push(`/job-detail?id=${job.id}`);
  };

  return (
    <TouchableOpacity
      style={[styles.jobCard, { backgroundColor: colors.card }]}
      activeOpacity={0.7}
      onPress={handleCardPress}
    >
      <View style={styles.jobPosterSection}>
        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
          {job.postedBy?.photoUri ? (
            <Image source={{ uri: job.postedBy.photoUri }} style={styles.posterAvatarImage} />
          ) : (
            <View style={[styles.posterAvatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.posterInitial, { color: colors.text }]}>{initial}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.jobHeaderContent}>
          <View style={styles.titleRow}>
            <IconComponent size={18} color={colors.text} />
            <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={1}>
              {job.category ?? job.title}
            </Text>
          </View>

          {job.subcategory ? (
            <View style={styles.subcategoryRow}>
              <Tag size={14} color={colors.textSecondary} />
              <Text
                style={[styles.subcategoryText, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {job.subcategory}
              </Text>
            </View>
          ) : null}

          <View style={styles.jobMetaInfo}>
            <Text style={[styles.posterName, { color: colors.textSecondary }]}>
              {job.postedBy?.name ?? "Unknown"}
            </Text>
            <Text style={[styles.metaDot, { color: colors.textSecondary }]}>•</Text>
            <Text style={[styles.posterDate, { color: colors.textSecondary }]}>
              {formatDate(job.postedDate)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.jobContent}>
        <Text style={[styles.jobDescription, { color: colors.textSecondary }]} numberOfLines={3}>
          {job.description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function BrowseScreen() {
  const { jobs } = useJobs();
  const { colors, currentTheme } = useTheme();
  const router = useRouter();

  const normalizedJobs = useMemo<BrowseJob[]>(
    () => (jobs as any[]).map(normalizeJob),
    [jobs]
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const allCategories = useMemo(() => {
    return Object.keys(RENTAL_CATEGORY_MAP);
  }, []);

  const categoryIconMap = useMemo(
    () => buildUniqueIconMap(allCategories),
    [allCategories]
  );

  const getCategoryIcon = (name: string) => categoryIconMap[name] ?? iconByKeyword(name);

  const allSubcategories = useMemo(() => {
    return Array.from(new Set(Object.values(RENTAL_CATEGORY_MAP).flat()));
  }, []);

  const searchResults = useMemo<SearchResultItem[]>(() => {
    if (!searchQuery.trim()) return [];

    const results: SearchResultItem[] = [];

    allCategories.forEach((category) => {
      if (searchMatch(category, searchQuery)) {
        results.push({
          id: `category-${category}`,
          type: "category",
          title: category,
          subtitle: "Категори",
          data: category,
        });
      }
    });

    allSubcategories.forEach((subcategory) => {
      if (searchMatch(subcategory, searchQuery)) {
        results.push({
          id: `subcategory-${subcategory}`,
          type: "subcategory",
          title: subcategory,
          subtitle: SUBCATEGORY_TO_CATEGORY[subcategory] ?? "Дэд категори",
          data: subcategory,
        });
      }
    });

    normalizedJobs.forEach((job) => {
      const titleMatch = searchMatch(job.title ?? "", searchQuery);
      const descMatch = searchMatch(job.description ?? "", searchQuery);
      const categoryMatch = searchMatch(job.category ?? "", searchQuery);
      const subcategoryMatch = searchMatch(job.subcategory ?? "", searchQuery);
      const nameMatch = searchMatch(job.postedBy?.name ?? "", searchQuery);

      if (titleMatch || descMatch || categoryMatch || subcategoryMatch) {
        results.push({
          id: `job-${job.id}`,
          type: "job",
          title: job.title || job.category || "Зар",
          subtitle: `${job.category ?? "Ангилалгүй"} • ${formatDate(job.postedDate)}`,
          data: job,
        });
      }

      if (nameMatch && !results.find((r) => r.id === `job-${job.id}`)) {
        results.push({
          id: `person-${job.id}`,
          type: "person",
          title: job.postedBy?.name ?? "Unknown",
          subtitle: `${job.postedBy?.jobsCompleted ?? 0} түрээс`,
          data: job,
        });
      }
    });

    return results.slice(0, 50);
  }, [searchQuery, normalizedJobs, allCategories, allSubcategories]);

  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const suggestions: string[] = [];
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const masterWords = [
      ...allCategories,
      ...allSubcategories,
      ...normalizedJobs.flatMap((job) => [
        job.title ?? "",
        job.category ?? "",
        job.subcategory ?? "",
      ]),
    ]
      .join(" ")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    masterWords.forEach((word) => {
      if (word.startsWith(normalizedQuery) && word.length > normalizedQuery.length) {
        const normalized = word.charAt(0).toUpperCase() + word.slice(1);
        if (!suggestions.includes(normalized) && suggestions.length < 4) {
          suggestions.push(normalized);
        }
      }
    });

    return suggestions;
  }, [searchQuery, normalizedJobs, allCategories, allSubcategories]);

  const filteredJobs = useMemo(() => {
    return normalizedJobs
      .filter((job) => {
        const matchesSearch =
          !isSearchFocused &&
          (!searchQuery.trim() ||
            searchMatch(job.title ?? "", searchQuery) ||
            searchMatch(job.description ?? "", searchQuery) ||
            searchMatch(job.category ?? "", searchQuery) ||
            searchMatch(job.subcategory ?? "", searchQuery));

        const matchesCategory =
          !selectedCategory || (job.category ?? "") === selectedCategory;

        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (a.isSponsored && !b.isSponsored) return -1;
        if (!a.isSponsored && b.isSponsored) return 1;
        return toSafeDate(b.postedDate).getTime() - toSafeDate(a.postedDate).getTime();
      });
  }, [normalizedJobs, isSearchFocused, searchQuery, selectedCategory]);

  const activeFiltersCount = selectedCategory ? 1 : 0;

  const handleSearchResultPress = (result: SearchResultItem) => {
    if (result.type === "category") {
      setSelectedCategory((result.data as string) ?? null);
      setSearchQuery("");
      setIsSearchFocused(false);
      Keyboard.dismiss();
      return;
    }

    if (result.type === "subcategory") {
      const pickedSubcategory = result.data as string;
      const parentCategory = SUBCATEGORY_TO_CATEGORY[pickedSubcategory] ?? null;

      setSelectedCategory(parentCategory);
      setSearchQuery(pickedSubcategory);
      setIsSearchFocused(false);
      Keyboard.dismiss();
      return;
    }

    if (result.type === "job" || result.type === "person") {
      const job = result.data as BrowseJob;
      router.push(`/job-detail?id=${job.id}`);
      setIsSearchFocused(false);
      Keyboard.dismiss();
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    const parentCategory = SUBCATEGORY_TO_CATEGORY[suggestion];
    if (parentCategory) {
      setSelectedCategory(parentCategory);
    }
    setSearchQuery(suggestion);
  };

  const handleBackPress = () => {
    router.back();
  };

  if (isSearchFocused) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <View style={[styles.searchHeader, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={[styles.searchInputContainer, { backgroundColor: colors.card }]}>
            <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInputFocused, { color: colors.text }]}
              placeholder="Хайх..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                activeOpacity={0.7}
                style={styles.clearButton}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {searchQuery.trim() !== "" && searchSuggestions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.suggestionsContainer,
              {
                backgroundColor: colors.background,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.suggestionChip,
                styles.suggestionChipActive,
                { backgroundColor: colors.text, borderColor: colors.text },
              ]}
              onPress={() => {}}
            >
              <Text
                style={[
                  styles.suggestionText,
                  styles.suggestionTextActive,
                  { color: colors.primary },
                ]}
                numberOfLines={1}
              >
                {searchQuery}
              </Text>
            </TouchableOpacity>

            {searchSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.suggestionChip,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleSuggestionPress(suggestion)}
              >
                <Text
                  style={[styles.suggestionText, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {suggestion}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <ScrollView
          style={[styles.searchResultsContainer, { backgroundColor: colors.background }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {searchResults.map((result) => {
            const CategoryIcon =
              result.type === "category" ? getCategoryIcon(result.title) : null;

            return (
              <TouchableOpacity
                key={result.id}
                style={[styles.searchResultItem, { borderBottomColor: colors.border }]}
                onPress={() => handleSearchResultPress(result)}
              >
                <View
                  style={[
                    styles.searchResultIcon,
                    { backgroundColor: colors.backgroundSecondary },
                  ]}
                >
                  {result.type === "category" && CategoryIcon ? (
                    <View style={styles.iconWrap}>
                      <CategoryIcon size={18} color={colors.text} />
                    </View>
                  ) : result.type === "subcategory" ? (
                    <View style={styles.iconWrap}>
                      <Tag size={18} color={colors.text} />
                    </View>
                  ) : result.type === "person" ? (
                    <View style={[styles.personAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.personInitial, { color: colors.text }]}>
                        {result.title?.[0] ?? "?"}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.resultIconText}>📄</Text>
                  )}
                </View>

                <View style={styles.searchResultContent}>
                  <Text
                    style={[styles.searchResultTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {result.title}
                  </Text>

                  {result.subtitle && (
                    <Text
                      style={[styles.searchResultSubtitle, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {result.subtitle}
                    </Text>
                  )}

                  {result.type === "job" &&
                    result.data &&
                    typeof result.data === "object" &&
                    "description" in result.data && (
                      <Text
                        style={[
                          styles.searchResultDescription,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {result.data.description}
                      </Text>
                    )}
                </View>
              </TouchableOpacity>
            );
          })}

          {searchQuery.trim() !== "" && searchResults.length === 0 && (
            <View style={styles.noResultsContainer}>
              <Text style={[styles.noResultsText, { color: colors.text }]}>
                Илэрц олдсонгүй
              </Text>
              <Text style={[styles.noResultsSubtext, { color: colors.textSecondary }]}>
                Өөр хайлт оролдоно уу
              </Text>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.safeArea, { backgroundColor: colors.primary }]}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
              <ArrowLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Хайх</Text>
          </View>

          <Image
            source={{ uri: getLogoUri(currentTheme) }}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Түрээс хайх..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
          />

          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              activeOpacity={0.7}
              style={styles.clearButtonNonFocused}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={20} color={colors.text} />
            {activeFiltersCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.filterBadgeText, { color: colors.text }]}>
                  {activeFiltersCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {showFilters && (
        <View
          style={[
            styles.filtersContainer,
            {
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>Категори</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChips}
            >
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border,
                  },
                  !selectedCategory && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={[styles.filterChipText, { color: colors.text }]}>Бүгд</Text>
              </TouchableOpacity>

              {allCategories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      borderColor: colors.border,
                    },
                    selectedCategory === category && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[styles.filterChipText, { color: colors.text }]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsText, { color: colors.textSecondary }]}>
            {filteredJobs.length} Түрээс олдлоо
          </Text>
        </View>

        {filteredJobs.map((job) => (
          <JobCard key={job.id} job={job} getCategoryIcon={getCategoryIcon} />
        ))}

        {filteredJobs.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.text }]}>
              Түрээс олдсонгүй
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
              Өөр хайлт хийж үзнэ үү
            </Text>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    paddingBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 70,
    height: 32,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
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
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  searchIcon: {
    marginRight: 0,
  },
  filterButton: {
    padding: 8,
    position: "relative",
  },
  filterBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  filtersContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 20,
    marginBottom: 8,
  },
  filterChips: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 16,
  },
  resultsHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 14,
    fontWeight: "600",
  },
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
  jobPosterSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  jobHeaderContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subcategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  subcategoryText: {
    fontSize: 13,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  jobMetaInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  metaDot: {
    fontSize: 12,
  },
  posterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  posterAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  posterInitial: {
    fontSize: 20,
    fontWeight: "700",
  },
  posterName: {
    fontSize: 13,
    fontWeight: "400",
  },
  posterDate: {
    fontSize: 13,
    fontWeight: "400",
  },
  jobContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
    gap: 6,
  },
  jobDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
  },
  bottomPadding: {
    height: 20,
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInputFocused: {
    flex: 1,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonNonFocused: {
    padding: 4,
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 220,
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  suggestionChipActive: {},
  suggestionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  suggestionTextActive: {},
  searchResultsContainer: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: 1,
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  resultIconText: {
    fontSize: 20,
  },
  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  personInitial: {
    fontSize: 18,
    fontWeight: "700",
  },
  searchResultContent: {
    flex: 1,
    gap: 1,
  },
  searchResultTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  searchResultSubtitle: {
    fontSize: 12,
  },
  searchResultDescription: {
    fontSize: 12,
    marginTop: 1,
  },
  noResultsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
  },
});