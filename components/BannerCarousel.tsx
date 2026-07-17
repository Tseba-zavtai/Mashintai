// components/BannerCarousel.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,

  Pressable,
  StyleSheet,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import * as Linking from "expo-linking";
import { Image as ExpoImage } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { recordPromotionMetric } from "@/lib/promotionMetrics";

export type Banner = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  media_url?: string;
  media_type?: "image" | "video";
  image_url?: string;
  click_url?: string | null;
};

type Props = {
  banners: Banner[];
  height?: number;
  borderRadius?: number;
  autoSlideMs?: number;
  aspectRatio?: number;
  backgroundColor?: string;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const H_PADDING = 16;
const CARD_W = SCREEN_W - H_PADDING * 2;
const VIDEO_FILE_PATTERN = /\.(mp4|m4v|mov|webm)(?:$|[?#])/i;

function mediaUrlForBanner(banner: Banner) {
  return banner.media_url ?? banner.image_url ?? "";
}

function isVideoBanner(banner: Banner) {
  if (banner.media_type === "video") return true;
  if (banner.media_type === "image") return false;
  return VIDEO_FILE_PATTERN.test(mediaUrlForBanner(banner));
}

function VideoBannerMedia({ mediaUrl, isActive }: { mediaUrl: string; isActive: boolean }) {
  const player = useVideoPlayer(mediaUrl, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.staysActiveInBackground = false;
    videoPlayer.keepScreenOnWhilePlaying = false;
  });

  useEffect(() => {
    if (isActive) player.play();
    else player.pause();
    return () => player.pause();
  }, [isActive, player]);

  return <VideoView style={styles.image} player={player} contentFit="cover" nativeControls={false} allowsFullscreen={false} />;
}

function BannerMedia({ banner, isActive }: { banner: Banner; isActive: boolean }) {
  const mediaUrl = mediaUrlForBanner(banner);
  if (isVideoBanner(banner)) return <VideoBannerMedia mediaUrl={mediaUrl} isActive={isActive} />;
  return <ExpoImage source={{ uri: mediaUrl }} style={styles.image} contentFit="cover" transition={200} cachePolicy="memory-disk" />;
}

export default function BannerCarousel({
  banners,
  height,
  borderRadius = 16,
  autoSlideMs = 6000,
  aspectRatio = 2,
  backgroundColor = "#fff",
}: Props) {
  const listRef = useRef<FlatList<Banner>>(null);
  const [index, setIndex] = useState(0);
  const viewedBannerIdsRef = useRef<Set<string>>(new Set());
  const wrapRef = useRef<View>(null);
  const [isInViewport, setIsInViewport] = useState(false);

  const data = useMemo(() => (banners ?? []).filter(Boolean), [banners]);

  const checkViewport = useCallback(() => {
    wrapRef.current?.measureInWindow((_, y, __, measuredHeight) => {
      setIsInViewport(y < SCREEN_H && y + measuredHeight > 0);
    });
  }, []);

  useEffect(() => {
    checkViewport();
    const interval = setInterval(checkViewport, 500);
    return () => clearInterval(interval);
  }, [checkViewport]);

  useEffect(() => {
    const activeBanner = data[index];
    if (!isInViewport || !activeBanner || viewedBannerIdsRef.current.has(activeBanner.id)) return;

    const timer = setTimeout(() => {
      if (viewedBannerIdsRef.current.has(activeBanner.id)) return;
      viewedBannerIdsRef.current.add(activeBanner.id);
      void recordPromotionMetric("banner", activeBanner.id, "impression");
    }, 750);

    return () => clearTimeout(timer);
  }, [data, index, isInViewport]);

  const computedHeight = useMemo(() => {
    if (typeof height === "number" && height > 0) return Math.round(height);
    return Math.round(CARD_W / (aspectRatio || 2));
  }, [height, aspectRatio]);

  useEffect(() => {
    setIndex(0);
    if (data.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }
  }, [data.length]);

  useEffect(() => {
    if (data.length <= 1) return;

    const t = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % data.length;
        listRef.current?.scrollToOffset({
          offset: next * SCREEN_W,
          animated: true,
        });
        return next;
      });
    }, autoSlideMs);

    return () => clearInterval(t);
  }, [data.length, autoSlideMs]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / SCREEN_W);
    if (!Number.isNaN(i)) setIndex(i);
  };

  const onPressBanner = useCallback(async (banner: Banner) => {
    const safeUrl = banner.click_url?.trim();
    if (!safeUrl || !safeUrl.toLowerCase().startsWith("https://")) return;

    try {
      const can = await Linking.canOpenURL(safeUrl);
      if (!can) return;
      void recordPromotionMetric("banner", banner.id, "click");
      await Linking.openURL(safeUrl);
    } catch {
      // A bad external link must not affect the carousel itself.
    }
  }, []);
  if (data.length === 0) return null;

  return (
    <View ref={wrapRef} onLayout={checkViewport} style={[styles.wrap, { height: computedHeight }]}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        removeClippedSubviews={false}
        initialNumToRender={data.length}
        windowSize={3}
        getItemLayout={(_, i) => ({
          length: SCREEN_W,
          offset: SCREEN_W * i,
          index: i,
        })}
        renderItem={({ item, index: itemIndex }) => (
          <Pressable
            style={[styles.slide, { width: SCREEN_W, height: computedHeight }]}
            onPress={() => onPressBanner(item)}
          >
            <View
              style={[
                styles.card,
                {
                  height: computedHeight,
                  borderRadius,
                  backgroundColor,
                },
              ]}
            >
              <BannerMedia banner={item} isActive={itemIndex === index} />

              {item.title || item.subtitle ? (
                <View style={styles.overlay}>
                  {item.title ? <Text style={styles.title}>{item.title}</Text> : null}
                  {item.subtitle ? (
                    <Text style={styles.subtitle}>{item.subtitle}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </Pressable>
        )}
      />

      {data.length > 1 ? (
        <View style={styles.dots}>
          {data.map((_, i) => (
            <View key={i} style={[styles.dot, i === index ? styles.dotActive : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },

  slide: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: H_PADDING,
  },

  card: {
    width: "100%",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  subtitle: {
    color: "#fff",
    fontSize: 12,
    marginTop: 2,
    opacity: 0.9,
  },

  dots: {
    position: "absolute",
    bottom: 8,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.5)",
  },

  dotActive: {
    width: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
});