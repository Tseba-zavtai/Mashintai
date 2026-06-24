// components/SkeletonCard.tsx
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function SkeletonCard() {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.card, opacity: fadeAnim }]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.border }]} />
        <View style={styles.headerText}>
          <View style={[styles.nameLine, { backgroundColor: colors.border }]} />
          <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
        </View>
      </View>
      <View style={[styles.titleLine, { backgroundColor: colors.border }]} />
      <View style={[styles.descLine, { backgroundColor: colors.border }]} />
      <View style={[styles.descLineShort, { backgroundColor: colors.border }]} />
      <View style={styles.imagesWrap}>
        <View style={[styles.imageBox, { backgroundColor: colors.border }]} />
        <View style={[styles.imageBox, { backgroundColor: colors.border }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  headerText: { marginLeft: 12, flex: 1, gap: 6 },
  nameLine: { height: 14, borderRadius: 4, width: '40%' },
  dateLine: { height: 10, borderRadius: 4, width: '25%' },
  titleLine: { height: 18, borderRadius: 4, width: '70%', marginBottom: 10 },
  descLine: { height: 12, borderRadius: 4, width: '100%', marginBottom: 6 },
  descLineShort: { height: 12, borderRadius: 4, width: '80%', marginBottom: 16 },
  imagesWrap: { flexDirection: 'row', gap: 8 },
  imageBox: { width: 150, height: 110, borderRadius: 12 },
});