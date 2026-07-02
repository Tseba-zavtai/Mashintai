// app/user-profile.tsx
import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
// 🎯 ЗАССАН: ChevronLeft-ийг хасаж, AppHeader-ийг дуудсан
import { User, Star, Briefcase, MessageSquare } from "lucide-react-native"; 
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader"; // 🎯 НЭМСЭН

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { colors, currentTheme } = useTheme();
  const { jobs, submitRentalReview, rentalRequests } = useJobs() as any;
  const { user: currentUser } = useAuth() as any;

  const [profileUser, setProfileUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);

  const [rating, setRating] = useState(1);
  const [comment, setComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const isDarkTheme = currentTheme === "purple" || currentTheme === "navy";
  const userBtnTextColor = isDarkTheme ? "#FFE3DD" : "#6E0AB0";

  useEffect(() => {
    const fetchUserAndReviews = async () => {
      if (!userId) return;
      try {
        setLoadingUser(true);
        const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', userId).single();

        if (userError) {
          const { data: phoneData } = await supabase.from('users').select('*').eq('phone', userId).single();
          if (phoneData) setProfileUser(phoneData);
        } else {
          setProfileUser(userData);
        }

        const targetId = profileUser?.id || userId;
        const { data: revData } = await supabase
          .from('rental_reviews')
          .select(`id, user_rating, comment, created_at, users!reviewer_id(name, photo_uri)`)
          .eq('reviewed_user_id', targetId)
          .not("comment", "is", null)
          .neq("comment", "")
          .order('created_at', { ascending: false });

        if (revData) setReviews(revData);
      } catch (e) {
        console.log(e);
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUserAndReviews();
  }, [userId, profileUser?.id]);

  const userJobs = useMemo(() => {
    return (jobs as any[]).filter((j: any) => {
      const pid = String(j?.postedBy?.id || "");
      const pphone = String(j?.postedBy?.phone || "");
      const uid = String(profileUser?.id || userId);
      return (pid === uid || pphone === uid) && j.isActive !== false && j.is_active !== false;
    });
  }, [jobs, profileUser, userId]);

  const pendingRequest = useMemo(() => {
     if (!rentalRequests || !currentUser) return null;
     const targetId = profileUser?.id || userId;
     return rentalRequests.find((req: any) =>
        req.status === 'completed' &&
        !req.is_reviewed &&
        ((req.requester_id === currentUser.id && req.owner_id === targetId) ||
         (req.owner_id === currentUser.id && req.requester_id === targetId))
     );
  }, [rentalRequests, currentUser, profileUser, userId]);

  const handleSubmitReview = async () => {
    if (!pendingRequest) return;
    try {
      setReviewSubmitting(true);
      await submitRentalReview({
        jobId: pendingRequest.job_id,
        itemRating: rating,
        userRating: rating,
        comment: comment
      });
      Alert.alert("Баярлалаа", "Таны үнэлгээг хүлээж авлаа!");
      setComment("");
    } catch (e) {
      Alert.alert("Анхаар", "Үнэлгээ илгээхэд алдаа гарлаа.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const getFirstImage = (job: any) => {
    if (Array.isArray(job.image_urls) && job.image_urls.length > 0) return job.image_urls[0];
    if (job.image_url) return job.image_url;
    return null;
  };

  const renderStars = (currentRating: number, onSetRating?: (r: number) => void) => {
    return (
      <View style={{ flexDirection: 'row', gap: 10, marginVertical: 12 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} disabled={!onSetRating} onPress={() => onSetRating && onSetRating(star)} activeOpacity={0.7}>
            <Star size={36} color={star <= currentRating ? "#FFB800" : colors.border} fill={star <= currentRating ? "#FFB800" : "transparent"} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    // 🎯 ЗАССАН: edges=["bottom"] болгож, "top"-ийг хассанаар дээд талын цагаан зай алга болно
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 🎯 ЗАССАН: Хуучин гараар зурсан толгойг устгаад AppHeader-ийг оруулж ирэв */}
      <AppHeader title="Хэрэглэгчийн профайл" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {loadingUser ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={[styles.profileCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.backgroundSecondary }]}>
                {profileUser?.photo_uri || profileUser?.photoUri ? (
                  <Image source={{ uri: profileUser.photo_uri || profileUser.photoUri }} style={{ width: 80, height: 80 }} />
                ) : (
                  <User size={40} color={colors.textSecondary} />
                )}
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.text }]}>{profileUser?.name || "Хэрэглэгч"}</Text>
                <Text style={[styles.profilePhone, { color: colors.textSecondary }]}>{profileUser?.phone || userId}</Text>
                <Text style={[styles.profileRatingText, { color: colors.text }]}>★ {profileUser?.user_rating_avg ? profileUser.user_rating_avg.toFixed(1) : "Шинэ"} · {profileUser?.user_review_count || 0} үнэлгээ</Text>
                <Text style={[styles.profileRentalText, { color: colors.textSecondary }]}>{profileUser?.rental_count || 0} удаа түрээслүүлсэн</Text>
              </View>
            </View>

            {pendingRequest ? (
              <View style={[styles.pendingReviewBox, { backgroundColor: colors.background, borderColor: colors.primary }]}>
                <Text style={[styles.pendingReviewTitle, { color: colors.text }]}>📣 Түрээсийн үнэлгээ өгнө үү!</Text>
                <Text style={[styles.pendingReviewSub, { color: colors.textSecondary }]}>Захиалга: {pendingRequest.jobs?.title || pendingRequest.jobs?.category || "Бараа"}</Text>
                
                <View style={{ alignItems: 'center', marginTop: 10 }}>
                  {renderStars(rating, setRating)}
                </View>

                <TextInput 
                  style={[styles.commentInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                  placeholder="Сэтгэгдэл үлдээх (заавал биш)"
                  placeholderTextColor={colors.textSecondary}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                />

                <TouchableOpacity style={[styles.submitReviewBtn, { backgroundColor: colors.primary }]} onPress={handleSubmitReview} disabled={reviewSubmitting} activeOpacity={0.8}>
                  {reviewSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={[styles.submitReviewText, { color: userBtnTextColor }]}>Үнэлгээ илгээх</Text>}
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Хэрэглэгчдийн сэтгэгдэл</Text>
              {reviews.length === 0 ? (
                <View style={[styles.emptyReviewBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <MessageSquare size={32} color={colors.textSecondary} style={{ marginBottom: 10 }} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Одоогоор сэтгэгдэл байхгүй байна</Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {reviews.map((r: any) => (
                    <View key={r.id} style={[styles.reviewCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <View style={styles.reviewHeader}>
                        <View style={[styles.reviewAvatar, { backgroundColor: colors.backgroundSecondary }]}>
                          {r.users?.photo_uri ? <Image source={{ uri: r.users.photo_uri }} style={{ width: "100%", height: "100%" }} /> : <User size={18} color={colors.textSecondary} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.reviewerName, { color: colors.text }]}>{r.users?.name || "Хэрэглэгч"}</Text>
                          <Text style={{ fontSize: 11, color: colors.textSecondary }}>{new Date(r.created_at).toLocaleDateString()}</Text>
                        </View>
                        <View style={styles.reviewStars}>
                          <Star size={14} fill="#FFB800" color="#FFB800" />
                          <Text style={[styles.reviewRatingText, { color: colors.text }]}>{(r.user_rating || 5).toFixed(1)}</Text>
                        </View>
                      </View>
                      <Text style={[styles.reviewComment, { color: colors.text }]}>{r.comment}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Нийтэлсэн зарууд ({userJobs.length})</Text>
              {userJobs.length === 0 ? (
                <Text style={{ color: colors.textSecondary, marginLeft: 4 }}>Зар олдсонгүй</Text>
              ) : (
                userJobs.map((job: any) => {
                  const img = getFirstImage(job);
                  return (
                    <TouchableOpacity key={job.id} style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.8} onPress={() => router.push(`/job-detail?id=${job.id}`)}>
                      {img ? (
                        <Image source={{ uri: img }} style={styles.jobImage} contentFit="cover" transition={200} />
                      ) : (
                        <View style={[styles.jobImage, { backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }]}><Briefcase size={32} color={colors.textSecondary} /></View>
                      )}
                      <View style={styles.jobInfo}>
                        <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={2}>{job.title || job.category}</Text>
                        <Text style={[styles.jobPrice, { color: "#6E0AB0" }]}>{Number(job.price).toLocaleString()} ₮</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // 🎯 ЗАССАН: header, headerTitle гэсэн хуучин стилиудийг устгасан.
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  profileCard: { borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "center", marginBottom: 24, borderWidth: 1, gap: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  profilePhone: { fontSize: 14, marginBottom: 8 },
  profileRatingText: { fontSize: 13, fontWeight: "800" },
  profileRentalText: { marginTop: 2, fontSize: 12, fontWeight: "600" },
  pendingReviewBox: { padding: 20, borderRadius: 16, borderWidth: 2, marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  pendingReviewTitle: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  pendingReviewSub: { fontSize: 13, marginBottom: 8 },
  commentInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  submitReviewBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  submitReviewText: { fontSize: 15, fontWeight: "700" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12, marginLeft: 4 },
  emptyReviewBox: { padding: 24, borderRadius: 16, borderWidth: 1, alignItems: "center" },
  reviewCard: { padding: 16, borderRadius: 16, borderWidth: 1 },
  reviewHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  reviewerName: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  reviewStars: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewRatingText: { fontSize: 14, fontWeight: "800" },
  reviewComment: { fontSize: 14, lineHeight: 20 },
  jobCard: { flexDirection: "row", borderRadius: 16, overflow: "hidden", borderWidth: 1, padding: 12, gap: 12, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  jobImage: { width: 80, height: 80, borderRadius: 10 },
  jobInfo: { flex: 1, justifyContent: "center" },
  jobTitle: { fontSize: 15, fontWeight: "600", marginBottom: 6, lineHeight: 20 },
  jobPrice: { fontSize: 16, fontWeight: "800" },
});