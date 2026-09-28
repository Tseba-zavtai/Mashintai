import { SeasonalIcon } from '@/lib/seasonalIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

/**
 * A small, presentation-only model so the home screen can use its existing
 * seasonal collection data without coupling this component to a data source.
 * The alternate image keys make it painless to use either API-shaped data or
 * locally composed cards while marketing cover images are being added.
 */
export type SeasonalCarouselItem = {
  id: string;
  title: string;
  description?: string | null;
  ctaLabel?: string | null;
  icon?: string | null;
  coverImageUrl?: string | null;
  imageUrl?: string | null;
  cover_image_url?: string | null;
};

type SeasonalCarouselProps = {
  collections: readonly SeasonalCarouselItem[];
  onPressCollection: (collection: SeasonalCarouselItem) => void;
  title?: string;
  testID?: string;
};

const HORIZONTAL_PADDING = 20;
const CARD_GAP = 12;

function getCoverUri(collection: SeasonalCarouselItem): string | undefined {
  const candidate =
    collection.coverImageUrl ??
    collection.imageUrl ??
    collection.cover_image_url ??
    undefined;

  return candidate?.trim() || undefined;
}

/**
 * Full-bleed seasonal promotion cards.  The cover image is deliberately
 * optional: a branded purple fallback is retained until a real collection
 * visual is supplied, so empty collections never look like a broken image.
 */
export function SeasonalCarousel({
  collections,
  onPressCollection,
  title = 'Танд яг одоо хэрэгтэй',
  testID,
}: SeasonalCarouselProps) {
  const { colors } = useTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<SeasonalCarouselItem>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Leave a visible slice of the next campaign card as an interaction cue.
  const cardWidth = useMemo(
    () => Math.max(180, Math.min(Math.round(viewportWidth * 0.68), 272)),
    [viewportWidth],
  );
  const snapInterval = cardWidth + CARD_GAP;

  const updateActiveIndex = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
      setActiveIndex(Math.max(0, Math.min(collections.length - 1, nextIndex)));
    },
    [collections.length, snapInterval],
  );

  const scrollTo = useCallback(
    (index: number) => {
      listRef.current?.scrollToOffset({ offset: snapInterval * index, animated: true });
      setActiveIndex(index);
    },
    [snapInterval],
  );

  if (!collections.length) {
    return null;
  }

  return (
    <View style={styles.section} testID={testID}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>

      <FlatList
        ref={listRef}
        horizontal
        data={collections as SeasonalCarouselItem[]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SeasonalCard
            collection={item}
            width={cardWidth}
            onPress={() => onPressCollection(item)}
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        onMomentumScrollEnd={updateActiveIndex}
      />

      {collections.length > 1 ? (
        <View accessibilityRole="tablist" style={styles.pagination}>
          {collections.map((collection, index) => {
            const selected = index === activeIndex;

            return (
              <Pressable
                key={collection.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${index + 1}-р улирлын сонголт`}
                hitSlop={8}
                onPress={() => scrollTo(index)}
                style={[styles.dotHitbox, selected && styles.dotHitboxSelected]}
              >
                <View style={[styles.dot, selected && styles.dotSelected]} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function SeasonalCard({
  collection,
  width,
  onPress,
}: {
  collection: SeasonalCarouselItem;
  width: number;
  onPress: () => void;
}) {
  const coverUri = getCoverUri(collection);
  const content = (
    <>
      {!coverUri ? <FallbackArtwork icon={collection.icon} /> : null}
      <View pointerEvents="none" style={styles.imageShade} />
      <LinearGradient pointerEvents="none" colors={["transparent", "rgba(28,4,55,0.94)"]} style={StyleSheet.absoluteFillObject} />

      <View style={styles.copy}>
        <View style={styles.kickerRow}>
          <View style={styles.kickerDot} />
          <Text numberOfLines={1} style={styles.kicker}>
            УЛИРЛЫН СОНГОЛТ
          </Text>
        </View>
        <Text numberOfLines={2} style={styles.cardTitle}>
          {collection.title}
        </Text>
        {collection.description ? (
          <Text numberOfLines={2} style={styles.description}>
            {collection.description}
          </Text>
        ) : null}
        <View style={styles.ctaRow}>
          <Text style={styles.cta}>{collection.ctaLabel || 'Заруудыг харах'}</Text>
          <Text accessibilityElementsHidden style={styles.ctaArrow}>
            →
          </Text>
        </View>
      </View>
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${collection.title} — заруудыг харах`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width },
        pressed && styles.cardPressed,
      ]}
    >
      {coverUri ? (
        <ImageBackground source={{ uri: coverUri }} style={styles.fill} imageStyle={styles.cover}>
          {content}
        </ImageBackground>
      ) : (
        <View style={[styles.fill, styles.fallback]}>{content}</View>
      )}
    </Pressable>
  );
}

function FallbackArtwork({ icon }: { icon?: string | null }) {
  return (
    <View pointerEvents="none" style={styles.fallbackArtwork}>
      <View style={styles.orbitLarge} />
      <View style={styles.orbitSmall} />
      <View style={styles.iconBubble}>
        <SeasonalIcon iconKey={icon} size={30} color="#7311C7" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 26,
  },
  sectionTitle: {
    color: '#15131B',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.35,
    marginBottom: 14,
    marginHorizontal: HORIZONTAL_PADDING,
  },
  carouselContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  card: {
    borderRadius: 24,
    height: 220,
    marginRight: CARD_GAP,
    overflow: 'hidden',
    backgroundColor: '#7010C6',
    shadowColor: '#2D055B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 5,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  fill: {
    flex: 1,
  },
  cover: {
    borderRadius: 24,
    resizeMode: 'cover',
  },
  fallback: {
    backgroundColor: '#7410C8',
  },
  fallbackArtwork: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orbitLarge: {
    position: 'absolute',
    width: 275,
    height: 275,
    borderRadius: 138,
    backgroundColor: 'rgba(255,255,255,0.13)',
    right: -86,
    top: -112,
  },
  orbitSmall: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(255,195,240,0.28)',
    left: -34,
    bottom: -42,
  },
  iconBubble: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 31,
    height: 62,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    top: 24,
    width: 62,
  },
  fallbackIcon: {
    color: '#7311C7',
    fontSize: 30,
    fontWeight: '800',
  },
  imageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 4, 55, 0.15)',
  },
  contentShade: {
    backgroundColor: 'rgba(28, 4, 55, 0.82)',
    bottom: 0,
    height: '62%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  copy: {
    bottom: 0,
    left: 0,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
  },
  kickerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 5,
  },
  kickerDot: {
    backgroundColor: '#FFD5F5',
    borderRadius: 3,
    height: 6,
    marginRight: 7,
    width: 6,
  },
  kicker: {
    color: '#F5D7FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.35,
    lineHeight: 28,
  },
  description: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  ctaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 10,
  },
  cta: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  ctaArrow: {
    color: '#FFD0F3',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 20,
    marginLeft: 7,
  },
  pagination: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 13,
  },
  dotHitbox: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    marginHorizontal: 3,
    width: 20,
  },
  dotHitboxSelected: {
    width: 30,
  },
  dot: {
    backgroundColor: '#DDD5E4',
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  dotSelected: {
    backgroundColor: '#780FC8',
    width: 22,
  },
});

export default SeasonalCarousel;
