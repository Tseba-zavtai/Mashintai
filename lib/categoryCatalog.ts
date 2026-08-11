import AsyncStorage from "@react-native-async-storage/async-storage";
import { JOB_CATEGORIES, JOB_SUBCATEGORIES } from "@/mocks/jobs";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "@tureesly_category_catalog_v1";
const FALLBACK_ID_PREFIX = "bundled-category-";

export type CatalogSubcategory = {
  id: string;
  name: string;
  icon: string | null;
  category_id: string;
  sort_order: number;
};

export type CatalogCategory = {
  id: string;
  name: string;
  icon: string | null;
  form_schema: unknown[];
  sort_order: number;
  subcategories: CatalogSubcategory[];
};

export type CategoryCatalogSnapshot = {
  version: 1;
  signature: string;
  savedAt: string;
  categories: CatalogCategory[];
};

function buildBundledCatalog(): CatalogCategory[] {
  return JOB_CATEGORIES.map((name, categoryIndex) => {
    const id = `${FALLBACK_ID_PREFIX}${categoryIndex}`;
    const subcategories = (JOB_SUBCATEGORIES[name] ?? []).map((subcategoryName, subcategoryIndex) => ({
      id: `${id}-subcategory-${subcategoryIndex}`,
      name: subcategoryName,
      icon: null,
      category_id: id,
      sort_order: subcategoryIndex,
    }));

    return {
      id,
      name,
      icon: null,
      form_schema: [],
      sort_order: categoryIndex,
      subcategories,
    };
  });
}

function normalizeCatalog(rows: any[]): CatalogCategory[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row, categoryIndex) => {
      const id = String(row?.id ?? "").trim();
      const name = String(row?.name ?? "").trim();
      if (!id || !name) return null;

      const subcategories: CatalogSubcategory[] = (Array.isArray(row?.subcategories) ? row.subcategories : [])
        .map((subcategory: any, subcategoryIndex: number) => {
          const subcategoryId = String(subcategory?.id ?? "").trim();
          const subcategoryName = String(subcategory?.name ?? "").trim();
          if (!subcategoryId || !subcategoryName) return null;
          return {
            id: subcategoryId,
            name: subcategoryName,
            icon: typeof subcategory?.icon === "string" && subcategory.icon.trim() ? subcategory.icon : null,
            category_id: id,
            sort_order: Number.isFinite(Number(subcategory?.sort_order)) ? Number(subcategory.sort_order) : subcategoryIndex,
          };
        })
        .filter((subcategory: CatalogSubcategory | null): subcategory is CatalogSubcategory => !!subcategory)
        .sort((a: CatalogSubcategory, b: CatalogSubcategory) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

      return {
        id,
        name,
        icon: typeof row?.icon === "string" && row.icon.trim() ? row.icon : null,
        form_schema: Array.isArray(row?.form_schema) ? row.form_schema : [],
        sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : categoryIndex,
        subcategories,
      };
    })
    .filter((category): category is CatalogCategory => !!category)
    .sort((a: CatalogCategory, b: CatalogCategory) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function makeSignature(categories: CatalogCategory[]) {
  return JSON.stringify(categories.map((category) => ({
    id: category.id,
    name: category.name,
    icon: category.icon,
    form_schema: category.form_schema,
    subcategories: category.subcategories.map((subcategory) => ({
      id: subcategory.id,
      name: subcategory.name,
      icon: subcategory.icon,
      sort_order: subcategory.sort_order,
    })),
  })));
}

function createSnapshot(categories: CatalogCategory[]): CategoryCatalogSnapshot {
  return {
    version: 1,
    signature: makeSignature(categories),
    savedAt: new Date().toISOString(),
    categories,
  };
}

function isSnapshot(value: unknown): value is CategoryCatalogSnapshot {
  const snapshot = value as CategoryCatalogSnapshot | null;
  return !!snapshot && snapshot.version === 1 && Array.isArray(snapshot.categories) && typeof snapshot.signature === "string";
}

const BUNDLED_SNAPSHOT = createSnapshot(buildBundledCatalog());
let memorySnapshot: CategoryCatalogSnapshot = BUNDLED_SNAPSHOT;
let refreshPromise: Promise<CategoryCatalogSnapshot> | null = null;

export function getCategoryCatalogImmediately() {
  return memorySnapshot;
}

export function isBundledCategoryId(value: unknown) {
  return typeof value === "string" && value.startsWith(FALLBACK_ID_PREFIX);
}

export async function loadCachedCategoryCatalog() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return memorySnapshot;
    const parsed = JSON.parse(raw);
    if (!isSnapshot(parsed) || parsed.categories.length === 0) return memorySnapshot;
    const categories = normalizeCatalog(parsed.categories);
    if (!categories.length) return memorySnapshot;
    memorySnapshot = createSnapshot(categories);
    return memorySnapshot;
  } catch (error) {
    console.log("CATEGORY CACHE READ ERROR:", error);
    return memorySnapshot;
  }
}

export async function refreshCategoryCatalog() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id,name,icon,form_schema,sort_order,subcategories(id,name,icon,sort_order)")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    const categories = normalizeCatalog(data ?? []);
    if (!categories.length) throw new Error("CATEGORY_CATALOG_EMPTY");

    const nextSnapshot = createSnapshot(categories);
    const hasChanged = nextSnapshot.signature !== memorySnapshot.signature;
    memorySnapshot = nextSnapshot;

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSnapshot));
    } catch (error) {
      console.log("CATEGORY CACHE WRITE ERROR:", error);
    }

    return { ...nextSnapshot, hasChanged };
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}
