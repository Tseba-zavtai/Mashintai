import { supabase } from "@/lib/supabase";
import { normalizeSeasonalIconKey, type SeasonalIconKey } from "@/lib/seasonalIcons";

export type SeasonalCollectionRule = {
  id: string;
  categoryId: string | null;
  subcategoryId: string | null;
};

export type SeasonalCollection = {
  id: string;
  title: string;
  subtitle: string | null;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  iconKey: SeasonalIconKey;
  rules: SeasonalCollectionRule[];
};

type SeasonalCollectionRow = {
  id?: string | null;
  title?: string | null;
  subtitle?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  sort_order?: number | null;
  icon_key?: string | null;
  seasonal_collection_rules?: Array<{
    id?: string | null;
    category_id?: string | null;
    subcategory_id?: string | null;
  }> | null;
};

function normalizeCollection(row: SeasonalCollectionRow | null | undefined): SeasonalCollection | null {
  const id = String(row?.id ?? "").trim();
  const title = String(row?.title ?? "").trim();
  const startsAt = String(row?.starts_at ?? "").trim();
  const endsAt = String(row?.ends_at ?? "").trim();
  if (!id || !title || !startsAt || !endsAt) return null;

  const rules = (Array.isArray(row?.seasonal_collection_rules) ? row.seasonal_collection_rules : [])
    .map((rule) => {
      const ruleId = String(rule?.id ?? "").trim();
      if (!ruleId) return null;
      return {
        id: ruleId,
        categoryId: typeof rule?.category_id === "string" && rule.category_id.trim() ? rule.category_id : null,
        subcategoryId: typeof rule?.subcategory_id === "string" && rule.subcategory_id.trim() ? rule.subcategory_id : null,
      };
    })
    .filter((rule): rule is SeasonalCollectionRule => !!rule);

  return {
    id,
    title,
    subtitle: typeof row?.subtitle === "string" && row.subtitle.trim() ? row.subtitle.trim() : null,
    startsAt,
    endsAt,
    sortOrder: Number.isFinite(Number(row?.sort_order)) ? Number(row?.sort_order) : 0,
    iconKey: normalizeSeasonalIconKey(row?.icon_key),
    rules,
  };
}

const COLLECTION_SELECT = "id,title,subtitle,starts_at,ends_at,sort_order,icon_key,seasonal_collection_rules(id,category_id,subcategory_id)";

export async function fetchActiveSeasonalCollections(): Promise<SeasonalCollection[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("seasonal_collections")
    .select(COLLECTION_SELECT)
    .eq("is_visible", true)
    .lte("starts_at", now)
    .gte("ends_at", now)
    .order("sort_order", { ascending: true })
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return (data ?? [])
    .map((row) => normalizeCollection(row as SeasonalCollectionRow))
    .filter((collection): collection is SeasonalCollection => !!collection && collection.rules.length > 0);
}

export async function fetchActiveSeasonalCollection(id: string): Promise<SeasonalCollection | null> {
  const normalizedId = String(id ?? "").trim();
  if (!normalizedId) return null;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("seasonal_collections")
    .select(COLLECTION_SELECT)
    .eq("id", normalizedId)
    .eq("is_visible", true)
    .lte("starts_at", now)
    .gte("ends_at", now)
    .maybeSingle();

  if (error) throw error;
  return normalizeCollection(data as SeasonalCollectionRow | null);
}

export function jobMatchesSeasonalCollection(job: any, collection: SeasonalCollection): boolean {
  if (!job || job?.isActive === false || job?.is_active === false) return false;
  if ((job?.postType ?? job?.post_type ?? "job") !== "job") return false;

  const available = Number(job?.available_quantity ?? job?.availableQuantity ?? job?.quantity ?? 1);
  if (Number.isFinite(available) && available <= 0) return false;

  const categoryId = String(job?.category_id ?? job?.categoryId ?? "").trim();
  const subcategoryId = String(job?.subcategory_id ?? job?.subcategoryId ?? "").trim();

  return collection.rules.some((rule) => {
    if (rule.subcategoryId) return subcategoryId === rule.subcategoryId;
    return !!rule.categoryId && categoryId === rule.categoryId;
  });
}
