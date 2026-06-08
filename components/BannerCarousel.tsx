// components/BannerCarousel.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import * as Linking from "expo-linking";

export type Banner = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  image_url: string;
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

const { width: SCREEN_W } = Dimensions.get("window");
const H_PADDING = 16;
const CARD_W = SCREEN_W - H_PADDING * 2;

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

  const data = useMemo(() => (banners ?? []).filter(Boolean), [banners]);

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

  const onPressBanner = useCallback(async (url?: string | null) => {
    if (!url) return;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
    } catch {
      // ignore
    }
  }, []);

  if (data.length === 0) return null;

  return (
    <View style={[styles.wrap, { height: computedHeight }]}>
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
        renderItem={({ item }) => (
          <Pressable
            style={[styles.slide, { width: SCREEN_W, height: computedHeight }]}
            onPress={() => onPressBanner(item.click_url)}
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
              <Image
                source={{ uri: item.image_url }}
                style={styles.image}
                resizeMode="cover"
              />

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