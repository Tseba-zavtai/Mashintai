// lib/banners.ts
import { supabase } from "@/lib/supabase";

export type BannerPlacement = "home_feed" | "add_tab";

export type BannerRow = {
  id: string;
  placement: BannerPlacement;
  image_path: string;
  click_url: string | null;
  title: string | null;
  subtitle: string | null;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
};

export type Banner = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  media_url: string;
  media_type: "image" | "video";
  click_url?: string | null;
};

const BUCKET = "banners";
const VIDEO_FILE_PATTERN = /\.(mp4|m4v|mov|webm)(?:$|[?#])/i;

function publicUrlFromPath(path: string) {
  if (!path) return "";
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? "";
}

function mediaTypeFromPath(path: string): "image" | "video" {
  return VIDEO_FILE_PATTERN.test(path.trim()) ? "video" : "image";
}

export async function fetchBanners(placement: BannerPlacement, limit = 3): Promise<Banner[]> {
  const nowIso = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from("banners")
      .select("id,placement,image_path,click_url,title,subtitle,sort_order,starts_at,ends_at")
      .eq("placement", placement)
      .eq("is_active", true)
      // (starts_at is null OR starts_at <= now) AND (ends_at is null OR ends_at >= now)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.log("FETCH BANNERS ERROR:", error);
      return [];
    }

    const rows = (data ?? []) as BannerRow[];

    return rows
      .filter((r) => !!r.image_path)
      .map((r): Banner => ({
        id: r.id,
        title: r.title,
        subtitle: r.subtitle,
        click_url: r.click_url,
        media_url: publicUrlFromPath(r.image_path),
        media_type: mediaTypeFromPath(r.image_path),
      }))
      .filter((banner) => !!banner.media_url);
  } catch (e) {
    console.log("FETCH BANNERS EXCEPTION:", e);
    return [];
  }
}