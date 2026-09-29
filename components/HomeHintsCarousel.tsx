import React, { useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

// Keep this explicit order in sync with the supplied numbered artwork.
const HINTS = [
  { image: require('@/assets/home-hints/1.jpg'), label: 'Түрээс илүү ашигтай. Түрээслүүлсэн нь орлоготой, түрээсэлсэн нь хэмнэлттэй.' },
  { image: require('@/assets/home-hints/2.jpg'), label: 'Хүссэнээ түрээслүүл, түрээслэ. Өөрт байгаагаа түрээслүүлж, өөрт хэрэгтэйгээ түрээслээрэй.' },
  { image: require('@/assets/home-hints/3.jpg'), label: 'Түрээсээ хялбар удирд. Түрээсийн өдөр, цагаа харилцан тохиролцож сонгоорой.' },
  { image: require('@/assets/home-hints/4.jpg'), label: 'Өөрт хэрэгтэйгээ ойроосоо. Өөртөө ойрхон заруудыг газрын зургаас олоорой.' },
  { image: require('@/assets/home-hints/5.jpg'), label: 'Нэмэлт шимтгэлгүй түрээслэ. Түрээсэлсэн ч, түрээслүүлсэн ч шимтгэлгүйг санаарай.' },
];

export default function HomeHintsCarousel() {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(1, windowWidth - 40);
  // Explicit dimensions prevent the native image's intrinsic height from
  // expanding a horizontal list inside the Home vertical ScrollView.
  const source = Image.resolveAssetSource(HINTS[0].image);
  const imageHeight = Math.round(width * source.height / source.width);
  const cardHeight = imageHeight + 36;
  const [activeIndex, setActiveIndex] = useState(0);
  const list = useRef<FlatList<(typeof HINTS)[number]>>(null);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Tureesly-г ашиглахын давуу тал</Text>
      <View style={[styles.card, { width, height: cardHeight }]}>
        {width > 0 ? (
          <FlatList
            key={width}
            ref={list}
            style={{ width, height: cardHeight, flexGrow: 0 }}
            data={HINTS}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={activeIndex}
            keyExtractor={(_, index) => String(index + 1)}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onMomentumScrollEnd={event => setActiveIndex(Math.max(0, Math.min(HINTS.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
            renderItem={({ item }) => {
              return <View style={{ width, height: cardHeight }}>
                <Image source={item.image} accessibilityLabel={item.label} accessible style={{ width, height: imageHeight }} resizeMode="contain" />
              </View>;
            }}
          />
        ) : null}
        <View style={styles.dots} accessibilityRole="tablist" pointerEvents="box-none">
          {HINTS.map((_, index) => (
            <Pressable key={index} accessibilityRole="tab" accessibilityLabel={`${index + 1} / ${HINTS.length} зөвлөгөө`} accessibilityState={{ selected: activeIndex === index }}
              onPress={() => { list.current?.scrollToOffset({ offset: width * index, animated: true }); setActiveIndex(index); }} style={styles.dotButton}>
              <View style={[styles.dot, { backgroundColor: activeIndex === index ? colors.primary : '#CFC8D6', width: activeIndex === index ? 20 : 7 }]} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28, marginHorizontal: 20 },
  heading: { fontSize: 21, fontWeight: '800', textAlign: 'center', marginBottom: 14 },
  card: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#F5FAFD' },
  dots: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  dotButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 7, borderRadius: 4 },
});
