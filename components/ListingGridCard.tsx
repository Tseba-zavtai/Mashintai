import React, { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { Heart, ShieldCheck, Star, Tag } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { isSponsoredPromotionActive, recordPromotionMetric } from "@/lib/promotionMetrics";

const BRAND_PURPLE = "#6E0AB0";

function toSafeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeImageUrls(job: any): string[] {
  const source = job?.image_urls ?? job?.imageUrls ?? null;

  if (Array.isArray(source)) {
    return source.filter((value) => typeof value === "string" && value.trim().length > 0);
  }

  if (typeof source === "string" && source.trim()) {
    try {
      const parsed = JSON.parse(source);
      if (Array.isArray(parsed)) {
        return parsed.filter((value) => typeof value === "string" && value.trim().length > 0);
      }
    } catch {
      return [source];
    }
  }

  const fallback = job?.image_url ?? job?.imageUrl ?? null;
  return typeof fallback === "string" && fallback.trim() ? [fallback] : [];
}

function formatDate(value: unknown): string {
  const date = toSafeDate(value);
  if (!date) return "";

  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Өнөөдөр";
  if (diffDays === 1) return "Өчигдөр";
  return `${diffDays} өдрийн өмнө`;
}

function formatPrice(job: any): string {
  const price = Number(String(job?.price ?? "").replace(/,/g, ""));
  if (!Number.isFinite(price) || price <= 0) return "Үнэ тохирно";

  const priceType = job?.price_type ?? job?.priceType;
  const unit = priceType === "hourly" ? "цаг" : priceType === "monthly" ? "сар" : "өдөр";
  return `${Math.round(price).toLocaleString("en-US")}₮ / ${unit}`;
}

function getRating(value: unknown): number | null {
  const rating = Number(value);
  return Number.isFinite(rating) && rating > 0 ? rating : null;
}

function isDisplayedSponsored(job: any): boolean {
  const flagged = Boolean(job?.isSponsored ?? job?.is_sponsored);
  if (!flagged) return false;

  const until = toSafeDate(job?.sponsoredUntil ?? job?.sponsored_until);
  // Older jobs may not have an expiry field yet; keep their current sponsored flag visible.
  return !!until && until.getTime() > Date.now();
}

type Props = {
  job: any;
  imageSwipeEnabled?: boolean;
  isSaved: boolean;
  onToggleSave: (id: string) => void | Promise<void>;
};

/**
 * Shared two-column listing card for full listing hubs. It intentionally keeps
 * the same information hierarchy as the Home cards: image, trust/date, price.
 */
export default function ListingGridCard({ job, isSaved, onToggleSave, imageSwipeEnabled = true }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [mediaWidth, setMediaWidth] = useState(0);
  const mediaTouchRef = useRef({ startX: 0, startY: 0, moved: false });

  const imageUrls = useMemo(() => normalizeImageUrls(job), [job]);
  const listingLabel = String(job?.subcategory ?? job?.subcategory_name ?? job?.category ?? job?.title ?? "").trim() || "Түрээсийн зар";
  const isSponsored = isDisplayedSponsored(job);
  const postedDate = job?.postedDate ?? job?.created_at ?? job?.updated_at ?? null;
  const rating = getRating(job?.itemRatingAvg ?? job?.item_rating_avg);
  const reviewCount = Number(job?.itemReviewCount ?? job?.item_review_count ?? 0) || 0;
  const hasRating = Boolean(rating && reviewCount > 0);
  const isDanVerified = Boolean(
    job?.postedBy?.isDanVerified ?? job?.postedBy?.is_dan_verified ?? job?.posted_by_is_dan_verified,
  );
  const hasTrustMeta = isDanVerified || hasRating;

  const openListing = () => {
    if (isSponsoredPromotionActive(job)) {
      void recordPromotionMetric("sponsored_job", String(job?.id ?? ""), "click");
    }
    router.push(`/job-detail?id=${encodeURIComponent(String(job?.id ?? ""))}`);
  };

  const beginMediaTouch = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    mediaTouchRef.current = { startX: pageX, startY: pageY, moved: false };
  };

  const moveMediaTouch = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    const touch = mediaTouchRef.current;
    if (Math.abs(pageX - touch.startX) > 8 || Math.abs(pageY - touch.startY) > 8) {
      mediaTouchRef.current.moved = true;
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View
        style={[styles.media, { backgroundColor: colors.backgroundSecondary }]}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          if (width > 0 && Math.abs(width - mediaWidth) > 0.5) setMediaWidth(width);
        }}
      >
        {imageUrls.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            directionalLockEnabled
            nestedScrollEnabled
            scrollEnabled={imageSwipeEnabled && imageUrls.length > 1}
            showsHorizontalScrollIndicator={false}
            onTouchStart={beginMediaTouch}
            onTouchMove={moveMediaTouch}
            onTouchEnd={() => {
              if (!mediaTouchRef.current.moved) openListing();
            }}
            onTouchCancel={() => {
              mediaTouchRef.current.moved = true;
            }}
            onScrollBeginDrag={() => {
              mediaTouchRef.current.moved = true;
            }}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(event) => {
              const width = event.nativeEvent.layoutMeasurement.width;
              if (width > 0) {
                setActiveImageIndex(Math.max(0, Math.min(imageUrls.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))));
              }
            }}
            style={styles.imageScroller}
          >
            {imageUrls.map((uri, index) => (
              <Image
                key={`${job?.id ?? "listing"}-image-${index}`}
                source={{ uri }}
                style={[styles.image, { width: mediaWidth || 160 }]}
                contentFit="cover"
                transition={180}
              />
            ))}
          </ScrollView>
        ) : (
          <Pressable
            style={[styles.image, styles.imageFallback, { backgroundColor: colors.accent }]}
            onPress={openListing}
            accessibilityRole="button"
            accessibilityLabel={`${listingLabel} дэлгэрэнгүй харах`}
          >
            <Tag size={30} color={colors.primary} />
          </Pressable>
        )}

        {isSponsored ? (
          <View style={[styles.sponsoredBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.sponsoredText, { color: colors.buttonText }]}>Sponsored</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.heartButton}
          onPress={(event) => {
            event.stopPropagation();
            void onToggleSave(String(job?.id ?? ""));
          }}
          hitSlop={6}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={isSaved ? "Хадгалснаас хасах" : "Зар хадгалах"}
        >
          <Heart
            size={21}
            color={isSaved ? "#FF4B4B" : BRAND_PURPLE}
            fill={isSaved ? "#FF4B4B" : "transparent"}
            strokeWidth={2.4}
          />
        </TouchableOpacity>
      </View>

      {imageSwipeEnabled && imageUrls.length > 1 ? (
        <View style={styles.pagination} pointerEvents="none">
          {imageUrls.map((_, index) => (
            <View
              key={`${job?.id ?? "listing"}-dot-${index}`}
              style={[styles.paginationDot, { backgroundColor: index === activeImageIndex ? BRAND_PURPLE : colors.border }]}
            />
          ))}
        </View>
      ) : null}

      <Pressable
        style={styles.content}
        onPress={openListing}
        accessibilityRole="button"
        accessibilityLabel={`${listingLabel} дэлгэрэнгүй харах`}
      >
        <Text style={[styles.listingLabel, { color: colors.text }]} numberOfLines={2}>{listingLabel}</Text>
        {(hasTrustMeta || formatDate(postedDate)) ? (
          <View style={[styles.metaRow, !hasTrustMeta && styles.metaRowDateOnly]}>
            {hasTrustMeta ? (
              <View style={styles.trustMeta}>
                {isDanVerified ? (
                  <View style={styles.danBadge} accessibilityRole="text" accessibilityLabel="DAN баталгаажсан">
                    <ShieldCheck size={12} color="#087F4F" strokeWidth={2.8} />
                    <Text style={styles.danText}>DAN</Text>
                  </View>
                ) : null}
                {hasRating ? (
                  <View style={styles.ratingWrap}>
                    <Star size={12} color={BRAND_PURPLE} fill={BRAND_PURPLE} strokeWidth={2.4} />
                    <Text style={[styles.ratingText, { color: colors.textSecondary }]}>{rating!.toFixed(1)} ({reviewCount})</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {!!formatDate(postedDate) ? (
              <Text style={[styles.date, { color: colors.textSecondary }]} numberOfLines={1}>{formatDate(postedDate)}</Text>
            ) : null}
          </View>
        ) : null}
        <Text style={[styles.price, { color: BRAND_PURPLE }]} numberOfLines={1}>{formatPrice(job)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  media: { width: "100%", aspectRatio: 1, position: "relative", overflow: "hidden" },
  imageScroller: { width: "100%", height: "100%" },
  image: { height: "100%", backgroundColor: "#E9E9E9" },
  imageFallback: { width: "100%", alignItems: "center", justifyContent: "center" },
  sponsoredBadge: { position: "absolute", top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  sponsoredText: { fontSize: 10, fontWeight: "800" },
  heartButton: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  pagination: { minHeight: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 4 },
  paginationDot: { width: 5, height: 5, borderRadius: 3 },
  content: { paddingHorizontal: 10, paddingTop: 3, paddingBottom: 11 },
  listingLabel: { minHeight: 36, fontSize: 14, lineHeight: 18, fontWeight: "800" },
  metaRow: { minHeight: 20, marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  metaRowDateOnly: { justifyContent: "flex-start" },
  trustMeta: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  danBadge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999, backgroundColor: "#E8F8EF", flexShrink: 0 },
  danText: { color: "#087F4F", fontSize: 10, fontWeight: "800" },
  ratingWrap: { flexDirection: "row", alignItems: "center", gap: 3, minWidth: 0, flexShrink: 1 },
  ratingText: { fontSize: 11, fontWeight: "600" },
  date: { flexShrink: 1, fontSize: 11, textAlign: "right" },
  price: { marginTop: 4, fontSize: 15, lineHeight: 20, fontWeight: "800" },
});
