import { useEffect, useMemo, useState, useCallback } from "react";
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
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useJobs } from "@/contexts/JobsContext";
import { useTheme } from "@/contexts/ThemeContext";
import AppHeader from "@/components/AppHeader";
import { supabase } from "@/lib/supabase";

type LocalSubcategory = { id: string; name: string; icon?: string | null; };
type LocalCategory = { id: string; name: string; icon?: string | null; subcategories: LocalSubcategory[]; };

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
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j",
    з: "z", и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o",
    ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ү: "u", ф: "f",
    х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "ii",
    ь: "", э: "e", ю: "yu", я: "ya",
  };

  let out = "";
  for (const ch of text) out += map[ch] ?? ch;
  return out;
}

function latinToCyrillic(input: string) {
  let s = (input ?? "").trim().toLowerCase().replace(/\s+/g, " ");

  const rules: Array<[RegExp, string]> = [
    [/sch/g, "щ"], [/sh/g, "ш"], [/ch/g, "ч"], [/ts/g, "ц"],
    [/ya/g, "я"], [/yo/g, "ё"], [/yu/g, "ю"], [/ye/g, "е"],
    [/kh/g, "х"],
  ];

  for (const [re, rep] of rules) s = s.replace(re, rep);

  const map: Record<string, string> = {
    a: "а", b: "б", v: "в", g: "г", d: "д", e: "е", z: "з", i: "и",
    j: "ж", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", r: "р",
    s: "с", t: "t", u: "у", f: "ф", h: "х", y: "й", q: "к", w: "в",
    x: "кс", c: "к",
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



function JobCard({
  job,
  getCategoryIcon,
}: {
  job: BrowseJob;
  getCategoryIcon: (name: string) => string;
}) {
  const router = useRouter();
  const { colors } = useTheme();

  const initial = (job.postedBy?.name?.charAt(0) || "?").toUpperCase();
  const iconEmoji = getCategoryIcon(job.category ?? "");

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
            <Text style={{ fontSize: 16 }}>{iconEmoji}</Text>
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
  const { colors } = useTheme();
  const router = useRouter();

  const normalizedJobs = useMemo<BrowseJob[]>(
    () => (jobs as any[]).map(normalizeJob),
    [jobs]
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [dbCategories, setDbCategories] = useState<LocalCategory[]>([]);
  
  const fetchCategoriesFromDB = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select(`
          id, name, icon,
          subcategories ( id, name, icon )
        `);
      if (error) throw error;
      
      if (data) {
        const formattedCats: LocalCategory[] = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          subcategories: Array.isArray(c.subcategories) ? c.subcategories.map((sub: any) => ({
            id: sub.id,
            name: sub.name,
            icon: sub.icon
          })) : []
        }));
        setDbCategories(formattedCats);
      }
    } catch (err) {
      console.log("Error fetching categories:", err);
    }
  }, []);

  useEffect(() => {
    fetchCategoriesFromDB();
  }, [fetchCategoriesFromDB]);

  const allCategories = useMemo(() => dbCategories.map(c => c.name), [dbCategories]);
  
  const allSubcategories = useMemo(() => {
    return dbCategories.flatMap(c => c.subcategories.map(s => s.name));
  }, [dbCategories]);

  const subcategoryToCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    dbCategories.forEach((cat) => {
      cat.subcategories.forEach((sub) => {
        map[sub.name] = cat.name;
      });
    });
    return map;
  }, [dbCategories]);

  const getCategoryIcon = useCallback((name: string): string => {
    if (!name) return "🏷️";
    const cat = dbCategories.find(c => c.name === name);
    if (cat?.icon) return cat.icon;
    for (const c of dbCategories) {
      const sub = c.subcategories.find(s => s.name === name);
      if (sub?.icon) return sub.icon;
      if (sub && c.icon) return c.icon;
    }
    return "🏷️";
  }, [dbCategories]);

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
          subtitle: subcategoryToCategoryMap[subcategory] ?? "Дэд категори",
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
  }, [searchQuery, normalizedJobs, allCategories, allSubcategories, subcategoryToCategoryMap]);

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
      const parentCategory = subcategoryToCategoryMap[pickedSubcategory] ?? null;

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
    const parentCategory = subcategoryToCategoryMap[suggestion];
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
            const categoryIcon = result.type === "category" ? getCategoryIcon(result.title) : null;

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
                  {result.type === "category" && categoryIcon ? (
                    <View style={styles.iconWrap}>
                      <Text style={{fontSize: 18}}>{categoryIcon}</Text>
                    </View>
                  ) : result.type === "subcategory" ? (
                    <View style={styles.iconWrap}>
                      <Text style={{fontSize: 18}}>{getCategoryIcon(result.title)}</Text>
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
        edges={["bottom"]}
        style={[styles.safeArea, { backgroundColor: colors.headerBackground }]}
      >
        <AppHeader title="Хайх" />

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

              {dbCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      borderColor: colors.border,
                    },
                    selectedCategory === category.name && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setSelectedCategory(category.name)}
                >
                  <Text style={[styles.filterChipText, { color: colors.text }]}>
                    {category.icon ? `${category.icon} ` : ''}{category.name}
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