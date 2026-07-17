// app/my-jobs.tsx
import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Eye, EyeOff, Trash2, Pause, Play, TrendingUp, Award, Clock, Image as ImageIcon, Star } from "lucide-react-native";
import { Stack, useRouter } from "expo-router";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import AppHeader from "@/components/AppHeader"; // 🎯 НЭМСЭН: Бидний нэгдсэн толгой

function formatTimeLeft(date: Date | null) {
  if (!date) return null;
  const now = new Date().getTime();
  const diff = date.getTime() - now;
  if (diff <= 0) return "Хугацаа дууссан";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / 1000 / 60) % 60);
  const secs = Math.floor((diff / 1000) % 60);

  return `${days} хоног ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDateToYMD(date: Date | null) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${d}, ${h}:${min}`;
}

export default function MyJobsScreen() {
  const router = useRouter();
  const { jobs, deleteJob, toggleJobActive } = useJobs() as any;
  const { user } = useAuth() as any;
  const { colors } = useTheme();
  
  const [showInactive, setShowInactive] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [, setCurrentTime] = useState(Date.now());

  // Таймер шинэчлэх
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const myJobs = useMemo(() => {
    if (!user) return [];
    let list = (jobs as any[]).filter((job: any) => {
      const postedBy = job?.postedBy ?? {};
      return String(postedBy.phone ?? postedBy.id ?? "") === String(user.phone ?? user.id ?? "");
    });
    
    if (!showInactive) {
      list = list.filter(j => j.isActive !== false && j.is_active !== false);
    }
    return list;
  }, [jobs, user, showInactive]);

  const handleDelete = (jobId: string) => {
    Alert.alert("Анхаар", "Та энэ зарыг устгахдаа итгэлтэй байна уу?", [
      { text: "Болих", style: "cancel" },
      { 
        text: "Устгах", 
        style: "destructive", 
        onPress: async () => {
          try {
            setLoadingId(jobId);
            await deleteJob(jobId);
          } catch {
            Alert.alert("Алдаа", "Устгахад алдаа гарлаа");
          } finally {
            setLoadingId(null);
          }
        } 
      }
    ]);
  };

  const handleToggleActive = async (jobId: string, currentStatus: boolean) => {
    try {
      setLoadingId(jobId);
      await toggleJobActive(jobId, !currentStatus);
    } catch {
      Alert.alert("Алдаа", "Төлөв өөрчлөхөд алдаа гарлаа");
    } finally {
      setLoadingId(null);
    }
  };

  const getDaysAgoText = (date: Date | null) => {
    if (!date) return "";
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Өнөөдөр";
    if (days === 1) return "Өчигдөр";
    return `${days} хоногийн өмнө`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["bottom"]}>
      {/* 🎯 ЗАССАН: Expo-ийн үндсэн толгойг унтраасан */}
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* 🎯 ЗАССАН: Бидний шинээр хийсэн стандартын толгойг дуудсан */}
      <AppHeader title="Миний зарууд" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        
        {/* Идэвхгүйг харуулах товч */}
        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setShowInactive(!showInactive)} activeOpacity={0.7}>
          {showInactive ? <EyeOff size={18} color={colors.text} /> : <Eye size={18} color={colors.text} />}
          <Text style={[styles.filterBtnText, { color: colors.text }]}>{showInactive ? "Идэвхгүйг нуух" : "Идэвхгүйг харуулах"}</Text>
        </TouchableOpacity>

        {myJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Зар олдсонгүй</Text>
          </View>
        ) : (
          myJobs.map((job: any) => {
            const img = job.image_urls?.[0] || job.image_url;
            const imgCount = job.image_urls?.length || 0;
            const isActive = job.isActive !== false && job.is_active !== false;
            const rating = job.itemRatingAvg || job.item_rating_avg || 0;
            const reviewCount = job.itemReviewCount || job.item_review_count || 0;
            const rentalCount = job.rentalCount || job.rental_count || 0;
            
            const isSponsored = job.isSponsored || job.is_sponsored;
            const sponsoredUntil = job.sponsoredUntil || job.sponsored_until ? new Date(job.sponsoredUntil || job.sponsored_until) : null;
            const isCurrentlySponsored = isSponsored && sponsoredUntil && sponsoredUntil.getTime() > Date.now();

            return (
              <View key={job.id} style={[styles.jobCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                
                {/* Толгой хэсэг */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={2}>{job.title || job.category}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: isActive ? "rgba(16, 185, 129, 0.15)" : colors.backgroundSecondary }]}>
                    <Text style={[styles.statusText, { color: isActive ? "#059669" : colors.textSecondary }]}>{isActive ? "Идэвхтэй" : "Идэвхгүй"}</Text>
                  </View>
                </View>

                {job.subcategory && (
                  <View style={[styles.categoryPill, { backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={[styles.categoryPillText, { color: colors.textSecondary }]} numberOfLines={1}>{job.subcategory}</Text>
                  </View>
                )}

                <View style={styles.statsRow}>
                  <Star size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.statsText, { color: colors.textSecondary }]}>
                    {rating > 0 ? rating.toFixed(1) : "Шинэ эд зүйл"} · {reviewCount} үнэлгээ · {rentalCount} түрээс
                  </Text>
                </View>

                <Text style={[styles.descText, { color: colors.textSecondary }]} numberOfLines={2}>{job.description}</Text>

                {/* Зураг */}
                {imgCount > 0 && (
                  <View style={styles.imageSection}>
                    <View style={styles.imageCountWrap}>
                      <ImageIcon size={14} color={colors.textSecondary} />
                      <Text style={[styles.imageCountText, { color: colors.textSecondary }]}>{imgCount} зураг</Text>
                    </View>
                    <Image source={{ uri: img }} style={styles.thumbnail} contentFit="cover" />
                  </View>
                )}

                <View style={styles.timeWrap}>
                  <Clock size={14} color={colors.textSecondary} />
                  <Text style={[styles.timeText, { color: colors.textSecondary }]}>{getDaysAgoText(job.postedDate || new Date(job.created_at))}</Text>
                </View>

                {/* Үйлдлийн товчнууд (Устгах, Идэвхгүй) */}
                <View style={styles.actionsGrid}>
                  <TouchableOpacity style={[styles.halfBtn, { borderColor: colors.border }]} onPress={() => handleDelete(job.id)} disabled={loadingId === job.id}>
                    <Trash2 size={16} color={colors.text} />
                    <Text style={[styles.halfBtnText, { color: colors.text }]}>Устгах</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.halfBtn, { borderColor: colors.border }]} onPress={() => handleToggleActive(job.id, isActive)} disabled={loadingId === job.id}>
                    {loadingId === job.id ? <ActivityIndicator size="small" /> : (isActive ? <Pause size={16} color={colors.text} /> : <Play size={16} color={colors.text} />)}
                    <Text style={[styles.halfBtnText, { color: colors.text }]}>{isActive ? "Идэвхгүй" : "Идэвхтэй"}</Text>
                  </TouchableOpacity>
                </View>

                {/* 🎯 BUMP ТОВЧ (QPay рүү үсэрнэ) */}
                <TouchableOpacity 
                  style={[styles.fullBtn, { borderColor: colors.border }]} 
                  onPress={() => router.push({ pathname: "/sponsor-payment", params: { jobId: job.id, targetType: "bump" } })}
                  activeOpacity={0.7}
                >
                  <TrendingUp size={16} color={colors.text} />
                  <Text style={[styles.fullBtnText, { color: colors.text }]}>Зараа дээш гаргах (1,000₮)</Text>
                </TouchableOpacity>

                {/* SPONSOR ХЭСЭГ */}
                {isCurrentlySponsored ? (
                  <View style={[styles.sponsoredBox, { backgroundColor: "rgba(109, 40, 217, 0.05)", borderColor: "#6D28D9" }]}>
                    <View style={[styles.sponsoredBtn, { backgroundColor: "#6D28D9" }]}>
                      <Award size={16} color="#fff" />
                      <Text style={[styles.sponsoredBtnText, { color: "#fff" }]}>Sponsored зар</Text>
                    </View>
                    <Text style={[styles.sponsoredTimer, { color: colors.text }]}>Үлдсэн: {formatTimeLeft(sponsoredUntil)}</Text>
                    <Text style={[styles.sponsoredEnd, { color: colors.textSecondary }]}>Дуусах: {formatDateToYMD(sponsoredUntil)}</Text>
                    <Text style={[styles.sponsoredEnd, { color: colors.textSecondary, marginTop: 6 }]}>Үзэлт: {Number(job.sponsored_view_count ?? 0).toLocaleString()} · Даралт: {Number(job.sponsored_click_count ?? 0).toLocaleString()}</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={[styles.fullBtn, { backgroundColor: "#6D28D9", borderColor: "#6D28D9" }]} 
                    onPress={() => router.push({ pathname: "/sponsor-payment", params: { jobId: job.id, targetType: "sponsor" } })}
                    activeOpacity={0.8}
                  >
                    <Award size={16} color="#fff" />
                    <Text style={[styles.fullBtnText, { color: "#fff" }]}>Sponsored зар</Text>
                  </TouchableOpacity>
                )}

              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40, gap: 16 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
  filterBtnText: { fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 15 },
  
  jobCard: { borderRadius: 16, padding: 16, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  jobTitle: { fontSize: 18, fontWeight: '800' },
  categoryPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
  categoryPillText: { fontSize: 12, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },
  
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statsText: { fontSize: 13, fontWeight: '600' },
  descText: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  
  imageSection: { marginBottom: 14 },
  imageCountWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  imageCountText: { fontSize: 13 },
  thumbnail: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#EAEAEA' },
  
  timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  timeText: { fontSize: 13 },
  
  actionsGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  halfBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderWidth: 1, borderRadius: 12, gap: 8 },
  halfBtnText: { fontSize: 14, fontWeight: '600' },
  
  fullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderWidth: 1, borderRadius: 12, gap: 8, marginBottom: 10 },
  fullBtnText: { fontSize: 14, fontWeight: '700' },

  sponsoredBox: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  sponsoredBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, width: '100%', gap: 8, marginBottom: 12 },
  sponsoredBtnText: { fontSize: 15, fontWeight: '700' },
  sponsoredTimer: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sponsoredEnd: { fontSize: 12 },
});