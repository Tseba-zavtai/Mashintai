// lib/injectBanners.ts
export type FeedWithBannersItem =
  | { type: "post"; id: string; [k: string]: any }
  | { type: "banner_carousel"; key: string };

export function injectBannerEvery20(posts: { id: string; [k: string]: any }[]) {
  const out: FeedWithBannersItem[] = [];

  for (let i = 0; i < posts.length; i++) {
    out.push({ type: "post", ...posts[i] });

    const oneBased = i + 1; // 1-index
    if (oneBased >= 6 && (oneBased - 6) % 20 === 0) {
      out.push({ type: "banner_carousel", key: `banner_${oneBased}` });
    }
  }

  return out;
}