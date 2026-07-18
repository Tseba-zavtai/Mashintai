// app/review.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Star } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import AppHeader from "@/components/AppHeader";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

export default function ReviewScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<any>();
  
  const jobId = params.jobId;
  const targetUserId = params.ownerId || params.owner_id;
  const rentalRequestId = params.requestId || params.request_id;
  const isOwnerView = params.isOwnerView;
  const isOwner = isOwnerView === "true";

  const [rating, setRating] = useState(1);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(Boolean(rentalRequestId));
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  useEffect(() => {
    let active = true;

    const checkExistingReview = async () => {
      if (!rentalRequestId) {
        if (active) setCheckingExisting(false);
        return;
      }

      try {
        if (active) setCheckingExisting(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("rental_reviews")
          .select("id")
          .eq("request_id", rentalRequestId)
          .eq("reviewer_id", user.id)
          .limit(1);
        if (error) throw error;
        if (active) setAlreadyReviewed((data ?? []).length > 0);
      } catch (error) {
        console.log("Review status check error:", error);
      } finally {
        if (active) setCheckingExisting(false);
      }
    };

    void checkExistingReview();
    return () => { active = false; };
  }, [rentalRequestId]);

  const handleSubmitReview = async () => {
    try {
      if (alreadyReviewed) throw new Error("Та энэ түрээсийн хүсэлтэд үнэлгээ өгсөн байна.");
      if (!targetUserId) throw new Error("Үнэлэгдэх хэрэглэгчийн мэдээлэл олдсонгүй.");
      setSubmitting(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Хэрэглэгч нэвтрээгүй байна.");

      if (rentalRequestId) {
        const { data: existingReviews, error: existingReviewError } = await supabase
          .from("rental_reviews")
          .select("id")
          .eq("request_id", rentalRequestId)
          .eq("reviewer_id", user.id)
          .limit(1);

        if (existingReviewError) throw existingReviewError;
        if ((existingReviews ?? []).length > 0) {
          setAlreadyReviewed(true);
          Alert.alert("Мэдэгдэл", "Та энэ түрээсийн хүсэлтэд үнэлгээ өгсөн байна.", [
            { text: "Буцах", onPress: () => router.back() },
          ]);
          return;
        }
      }
      const insertData: any = {
        job_id: jobId,
        reviewer_id: user.id,
        reviewed_user_id: targetUserId,
        item_rating: rating,
        user_rating: rating,
        comment: comment.trim(),
        ...(rentalRequestId ? { request_id: rentalRequestId } : {}),
      };

      const { error } = await supabase.from("rental_reviews").insert([insertData]);
      if (error) throw error;

      setAlreadyReviewed(true);
      Alert.alert("Баярлалаа", "Үнэлгээг амжилттай хүлээн авлаа.", [
        { text: "Буцах", onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert("Алдаа", e.message || "Үнэлгээ хадгалахад алдаа гарлаа.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
      {/* 🎯 ЗАСВАР: Буцах товч бүхий Header нэмэв */}
      <AppHeader title="Үнэлгээ өгөх" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>
          {isOwner ? "Түрээслэгч хэрэглэгчийг үнэлэх" : "Түрээсийн үйлчилгээний үнэлгээ"}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {isOwner 
            ? "Хэрэглэгч барааг заасан хугацаандаа, бүрэн бүтэн хүлээлгэж өгсөн эсэхэд үнэлгээ өгнө үү."
            : "Түрээсэлсэн үйлчилгээ болон сэтгэгдлээ үнэлнэ үү."}
        </Text>

        <View style={[styles.reviewSection, { borderColor: colors.border }]}>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                <Star size={44} fill={star <= rating ? "#FFCC00" : "none"} color={star <= rating ? "#FFCC00" : colors.textSecondary} style={{ marginHorizontal: 6 }} />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.backgroundSecondary }]}
            placeholder="Сэтгэгдэл, харилцаа хандлагын талаар бичих (заавал биш)..."
            placeholderTextColor={colors.textSecondary}
            multiline
            value={comment}
            onChangeText={setComment}
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting || checkingExisting || alreadyReviewed ? 0.55 : 1 }]}
          onPress={handleSubmitReview}
          disabled={submitting || checkingExisting || alreadyReviewed}
        >
          {submitting || checkingExisting ? <ActivityIndicator color={colors.buttonText} /> : <Text style={[styles.submitBtnText, { color: colors.buttonText }]}>{alreadyReviewed ? "Үнэлгээ өгсөн" : "Үнэлгээ илгээх"}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  scrollContent: { padding: 20, alignItems: "center" },
  title: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 18, paddingHorizontal: 10 },
  reviewSection: { width: "100%", borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 20, alignItems: "center" },
  starsContainer: { flexDirection: "row", marginBottom: 14 },
  input: { width: "100%", borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 13, height: 80, textAlignVertical: "top" },
  submitBtn: { width: "100%", height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 10 },
  submitBtnText: { fontSize: 15, fontWeight: "800" }
});