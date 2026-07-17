// app/saved-jobs.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heart, Image as ImageIcon } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useJobs } from "@/contexts/JobsContext";
import { useTheme } from "@/contexts/ThemeContext";
import AppHeader from "@/components/AppHeader";
import { isSponsoredPromotionActive, recordPromotionMetric } from "@/lib/promotionMetrics";

export default function SavedJobsScreen() {
  const router = useRouter();
  const { jobs, savedJobIds, toggleSaveJob } = useJobs();
  const { colors } = useTheme();
  
  // 🎯 ШИНЭ: Лого дуудах

  const savedJobs = useMemo(() => {
    return jobs.filter((j) => savedJobIds.includes(j.id));
  }, [jobs, savedJobIds]);

  const handleCardPress = (job: any) => {
    if (isSponsoredPromotionActive(job)) void recordPromotionMetric("sponsored_job", job.id, "click");
    router.push(`/job-detail?id=${job.id}`);
  };

  const getFirstImage = (job: any) => {
    if (Array.isArray(job.image_urls) && job.image_urls.length > 0) return job.image_urls[0];
    if (job.image_url) return job.image_url;
    return null;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["bottom"]}>
      {/* 🎯 ШИНЭ: Ягаан толгой, Буцах сум, Лого */}
      <AppHeader title="Хадгалсан зарууд" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {savedJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Heart size={48} color={colors.textSecondary} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Хадгалсан зар алга</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Таалагдсан зарынхаа зүрхэн дээр дарж энд хадгалаарай.
            </Text>
          </View>
        ) : (
          savedJobs.map((job) => {
            const img = getFirstImage(job);
            return (
              <TouchableOpacity key={job.id} style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.8} onPress={() => handleCardPress(job)}>
                {img ? (
                  <Image source={{ uri: img }} style={styles.jobImage} contentFit="cover" transition={200} />
                ) : (
                  <View style={[styles.jobImage, { backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }]}><ImageIcon size={32} color={colors.textSecondary} /></View>
                )}
                <View style={styles.jobInfo}>
                  <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={2}>{job.title || job.category}</Text>
                  <Text style={[styles.jobPrice, { color: colors.primary }]}>{Number(job.price).toLocaleString()} ₮</Text>
                </View>
                <TouchableOpacity style={styles.saveBtn} onPress={(e) => { e.stopPropagation(); toggleSaveJob(job.id); }}>
                  <Heart size={24} color="#FF4B4B" fill="#FF4B4B" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40, gap: 12 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  jobCard: { flexDirection: "row", borderRadius: 16, overflow: "hidden", borderWidth: 1, padding: 12, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  jobImage: { width: 80, height: 80, borderRadius: 10 },
  jobInfo: { flex: 1, justifyContent: "center" },
  jobTitle: { fontSize: 15, fontWeight: "600", marginBottom: 6, lineHeight: 20 },
  jobPrice: { fontSize: 16, fontWeight: "800" },
  saveBtn: { padding: 4, justifyContent: "center" },
});