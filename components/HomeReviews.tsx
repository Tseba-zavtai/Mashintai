import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Star } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

type Review = {
  id: string;
  user_rating: number | null;
  item_rating: number | null;
  comment: string;
  created_at: string;
  users?: { name?: string | null } | { name?: string | null }[] | null;
};

export default function HomeReviews({ refreshing }: { refreshing: boolean }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [reviews, setReviews] = useState<Review[]>([]);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (refreshing) return () => { active = false; };
    void (async () => {
      try {
        let { data, error } = await supabase.from('rental_reviews')
          .select('id,user_rating,item_rating,comment,created_at,users!reviewer_id(name)')
          .not('comment', 'is', null).neq('comment', '')
          .order('created_at', { ascending: false }).limit(10);
        if (error) {
          const fallback = await supabase.from('rental_reviews')
            .select('id,user_rating,item_rating,comment,created_at')
            .not('comment', 'is', null).neq('comment', '')
            .order('created_at', { ascending: false }).limit(10);
          data = fallback.data as typeof data;
          error = fallback.error;
        }
        if (error) throw error;
        if (active) setReviews(((data ?? []) as Review[]).filter(review => review.comment?.trim()));
      } catch (error) {
        console.warn('Home reviews unavailable', error);
        if (active) setReviews([]);
      }
    })();
    return () => { active = false; };
  }, [refreshing]));

  if (!reviews.length) return null;
  const cardWidth = Math.max(1, width - (reviews.length === 1 ? 40 : 64));
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Хэрэглэгчдийн сэтгэгдэл</Text>
      <FlatList horizontal data={reviews} keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}
        snapToInterval={cardWidth + 12} decelerationRate="fast" disableIntervalMomentum
        renderItem={({ item }) => {
          const author = Array.isArray(item.users) ? item.users[0] : item.users;
          const rating = Number(item.user_rating ?? item.item_rating);
          const validRating = Number.isFinite(rating) && rating >= 1 && rating <= 5;
          const date = new Date(item.created_at);
          return (
            <View style={[styles.card, { width: cardWidth, backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.row}>
                <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{author?.name?.trim() || 'Хэрэглэгч'}</Text>
                {validRating ? <View style={styles.rating}><Star size={16} color="#E9AA22" fill="#E9AA22" /><Text style={{ color: colors.text, fontWeight: '600' }}>{rating.toFixed(1)}</Text></View> : null}
              </View>
              <Text style={[styles.comment, { color: colors.text }]}>{item.comment.trim()}</Text>
              <Text style={[styles.date, { color: colors.textSecondary }]}>{Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-CA')}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  title: { marginHorizontal: 20, marginBottom: 12, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  list: { paddingHorizontal: 20, gap: 12 },
  card: { padding: 14, borderRadius: 16, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { flex: 1, fontSize: 15, fontWeight: '600' },
  rating: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  comment: { fontSize: 14, lineHeight: 20, marginVertical: 10 },
  date: { fontSize: 12, textAlign: 'right', marginTop: 'auto' },
});
