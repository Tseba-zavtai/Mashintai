// app/(tabs)/profile.tsx
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  TextInput,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  User,
  HelpCircle,
  LogOut,
  ChevronRight,
  Lock,
  Trash2,
  MapPin,
  Camera,
  Edit2,
  X,
  Shield,
  Palette,
  Eye,
  EyeOff,
  MessageSquare,
  Star,
  Heart,
  Briefcase,
  Info, // 🎯 Version-д зориулж нэмэв
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useJobs } from "@/contexts/JobsContext";
import { useMemo, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import ThemeSelector from "@/components/ThemeSelector";
import * as ImagePicker from "expo-image-picker";
import type { Href } from "expo-router";
import { supabase } from "@/lib/supabase";
import { getLogoSource } from "@/constants/logo";

const APP_VERSION = "1.0.0";
const DELETE_USER_URL = "https://iijtaosyryyxervjjuzd.functions.supabase.co/delete-user";
const STORAGE_BUCKET = "avatars";

export default function ProfileScreen() {
  const router = useRouter();
  const { jobs } = useJobs() as any;
  const {
    user,
    logout,
    isAuthenticated,
    updateProfile,
    isSuperAdmin,
    unlockAdmin,
    isAdminUnlocked,
    refetchProfile,
    changePassword,
  } = useAuth() as any;

  const { colors, currentTheme } = useTheme();
  const logoSource = useMemo(() => getLogoSource(currentTheme), [currentTheme]);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [isAdminModalVisible, setIsAdminModalVisible] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isUnlockingAdmin, setIsUnlockingAdmin] = useState(false);
  const [isPwModalVisible, setIsPwModalVisible] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwShow, setPwShow] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false); 

  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [isReviewsModalVisible, setIsReviewsModalVisible] = useState(false);

  const myJobs = useMemo(() => {
    if (!user) return [];
    return (jobs as any[]).filter((job: any) => {
      const postedBy = job?.postedBy ?? {};
      return String(postedBy.phone ?? postedBy.id ?? "") === String(user.phone ?? user.id ?? "");
    });
  }, [jobs, user]);

  const formatRating = (value: any) => {
    if (value === null || value === undefined || value === "") return "Шинэ";
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(1) : "Шинэ";
  };

  const myProfileStats = useMemo(() => {
    if (!user) return { userRatingAvg: null, userReviewCount: 0, rentalCount: 0 };
    const myPostedJob = myJobs[0] as any;
    return {
      userRatingAvg: myPostedJob?.postedBy?.userRatingAvg ?? null,
      userReviewCount: myPostedJob?.postedBy?.userReviewCount ?? 0,
      rentalCount: myPostedJob?.postedBy?.rentalCount ?? 0,
    };
  }, [myJobs, user]);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/auth");
  }, [isAuthenticated, router]);

  useEffect(() => {
    refetchProfile?.().catch(() => {});
  }, []);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!user?.id) return;
      try {
        setLoadingReviews(true);
        const { data, error } = await supabase
          .from("rental_reviews")
          .select(`id, user_rating, item_rating, comment, created_at, users!reviewer_id(name, photo_uri)`)
          .eq("reviewed_user_id", user.id)
          .not("comment", "is", null)
          .neq("comment", "")
          .order("created_at", { ascending: false });

        if (error) {
          const { data: fallbackData } = await supabase
            .from("rental_reviews")
            .select('*')
            .eq("reviewed_user_id", user.id)
            .not("comment", "is", null)
            .neq("comment", "")
            .order("created_at", { ascending: false });
          setReviews(fallbackData || []);
        } else {
          setReviews(data || []);
        }
      } catch (e) {
        console.log("Fetch reviews error:", e);
      } finally {
        setLoadingReviews(false);
      }
    };
    fetchReviews();
  }, [user?.id]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5, 
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingImage(true);
        const imageUri = result.assets[0].uri;
        const response = await fetch(imageUri);
        const arrayBuffer = await response.arrayBuffer();
        const userId = user?.id || "anonymous";
        const fileExt = imageUri.substring(imageUri.lastIndexOf('.') + 1).toLowerCase() || 'jpeg';
        const mimeType = fileExt === 'jpg' ? 'image/jpeg' : `image/${fileExt}`;
        const fileName = `avatar-${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, arrayBuffer, { contentType: mimeType, upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
        if (publicData?.publicUrl) {
          const freshUrl = `${publicData.publicUrl}?t=${Date.now()}`;
          await updateProfile({ photoUri: freshUrl });
        }
      }
    } catch (error: any) {
      Alert.alert("Алдаа", error.message || "Зураг хадгалахад алдаа гарлаа.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleEditName = () => {
    setEditedName(user?.name || "");
    setIsEditModalVisible(true);
  };

  const handleSaveName = async () => {
    if (editedName.trim()) {
      await updateProfile({ name: editedName.trim() });
      setIsEditModalVisible(false);
    }
  };

  const openAdminPanel = () => {
    if (!isSuperAdmin) return;
    if (isAdminUnlocked) { router.push("/admin"); return; }
    setAdminPassword("");
    setIsAdminModalVisible(true);
  };

  const handleUnlockAdmin = async () => {
    try {
      setIsUnlockingAdmin(true);
      await unlockAdmin(adminPassword.trim());
      setIsAdminModalVisible(false);
      setAdminPassword("");
      router.push("/admin");
    } catch (e: any) {
      Alert.alert("Алдаа", "Пасворд буруу байна");
    } finally {
      setIsUnlockingAdmin(false);
    }
  };

  const openPasswordModal = () => {
    setCurrentPw(""); setNewPw(""); setNewPw2(""); setPwShow(false); setIsPwModalVisible(true);
  };

  const handleChangePassword = async () => {
    if (newPw.trim() !== newPw2.trim()) { Alert.alert("Алдаа", "Шинэ нууц үг давталт таарахгүй байна"); return; }
    try {
      setPwBusy(true);
      await changePassword(currentPw.trim(), newPw.trim());
      setIsPwModalVisible(false);
      Alert.alert("Амжилттай", "Нууц үг солигдлоо");
    } catch (e: any) {
      Alert.alert("Алдаа", "Алдаа гарлаа");
    } finally {
      setPwBusy(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert("Профайл устгах", "Та итгэлтэй байна уу?", [
      { text: "Болих", style: "cancel" },
      {
        text: "Устгах", style: "destructive", onPress: async () => {
          try {
            setDeleteBusy(true);
            const { data: s } = await supabase.auth.getSession();
            await fetch(DELETE_USER_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.session?.access_token}` }, body: JSON.stringify({ userId: user.id }) });
            await logout();
            router.replace("/auth");
          } catch (e) { Alert.alert("Алдаа", "Алдаа гарлаа"); } finally { setDeleteBusy(false); }
        }
      }
    ]);
  };

  const visibleReviews = reviews.slice(0, 3);
  const renderReviewItem = (r: any) => {
    const reviewerName = r.users?.name || r.reviewer?.name || "Хэрэглэгч";
    const reviewerPhoto = r.users?.photo_uri || r.reviewer?.photo_uri || null;
    const rating = r.user_rating || r.item_rating || 5;
    return (
      <View key={r.id} style={[styles.reviewCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.reviewHeader}>
          <View style={[styles.reviewAvatar, { backgroundColor: colors.backgroundSecondary }]}>
            {reviewerPhoto ? <Image source={{ uri: reviewerPhoto }} style={{ width: "100%", height: "100%" }} /> : <User size={18} color={colors.textSecondary} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.reviewerName, { color: colors.text }]}>{reviewerName}</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>{new Date(r.created_at).toLocaleDateString()}</Text>
          </View>
          <View style={styles.reviewStars}><Star size={14} fill="#FFB800" color="#FFB800" /><Text style={[styles.reviewRatingText, { color: colors.text }]}>{rating.toFixed(1)}</Text></View>
        </View>
        <Text style={[styles.reviewComment, { color: colors.text }]}>{r.comment}</Text>
      </View>
    );
  };

  if (!isAuthenticated) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <SafeAreaView edges={["top"]} style={[styles.safeArea, { backgroundColor: colors.headerBackground }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>Профайл</Text>
          <Image source={logoSource} style={styles.logo} resizeMode="contain" />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.profileCard, { backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8} disabled={isUploadingImage}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              {isUploadingImage ? <ActivityIndicator color={colors.headerText} /> : user?.photoUri ? <Image source={{ uri: user.photoUri }} style={styles.avatarImage} /> : <User size={40} color={colors.headerText} strokeWidth={2} />}
              <View style={[styles.cameraIcon, { backgroundColor: colors.primary, borderColor: colors.background }]}><Camera size={16} color="#fff" /></View>
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>{user?.name || "Хэрэглэгч"}</Text>
            <Text style={[styles.profilePhone, { color: colors.textSecondary }]}>{user?.phone || "+976 9999 9999"}</Text>
            <Text style={[styles.profileRatingText, { color: colors.text }]}>★ {formatRating(myProfileStats.userRatingAvg)} · {myProfileStats.userReviewCount} үнэлгээ</Text>
            <Text style={[styles.profileRentalText, { color: colors.textSecondary }]}>{myProfileStats.rentalCount} удаа түрээслүүлсэн</Text>
          </View>
          <TouchableOpacity onPress={handleEditName} style={[styles.editButton, { backgroundColor: "#000000" }]}><Edit2 size={20} color={colors.primary} /></TouchableOpacity>
        </View>

        <View style={{ marginHorizontal: 20, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <View>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>Зар оруулах боломжит эрх</Text>
            <Text style={{ fontSize: 18, fontWeight: "900", marginTop: 2, color: colors.primary }}>{user?.available_post_credits ?? 0} эрх үлдсэн</Text>
          </View>
          <TouchableOpacity style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary }} onPress={() => router.push({ pathname: "/sponsor-payment", params: { targetType: "credit" } })} activeOpacity={0.8}><Text style={{ color: colors.headerText, fontWeight: "800", fontSize: 13 }}>Эрх авах (5,000₮)</Text></TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Хэрэглэгчдийн сэтгэгдэл</Text>
          {loadingReviews ? (
            <ActivityIndicator color={colors.primary} />
          ) : reviews.length === 0 ? (
            <View style={[styles.emptyReviewBox, { backgroundColor: colors.background, borderColor: colors.border }]}><MessageSquare size={32} color={colors.textSecondary} style={{ marginBottom: 10 }} /><Text style={{ color: colors.textSecondary, fontSize: 13 }}>Одоогоор сэтгэгдэл байхгүй</Text></View>
          ) : (
            <View style={{ marginHorizontal: 20, gap: 12 }}>
              {visibleReviews.map(renderReviewItem)}
              {reviews.length > 3 && (
                <TouchableOpacity style={[styles.seeAllBtn, { borderColor: colors.border }]} onPress={() => setIsReviewsModalVisible(true)}><Text style={{ color: colors.text, fontWeight: "700" }}>Бүх {reviews.length} сэтгэгдлийг харах</Text></TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Аккаунт</Text>
          <View style={[styles.menuList, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}>
            
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push("/my-jobs" as any)}>
              <View style={[styles.menuIconContainer, { backgroundColor: "rgba(16, 185, 129, 0.1)" }]}><Briefcase size={20} color="#10B981" /></View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuText, { color: colors.text }]}>Миний зарууд</Text>
                <Text style={[styles.menuSubText, { color: colors.textSecondary }]}>Өөрийн оруулсан заруудаа удирдах ({myJobs.length})</Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push("/saved-jobs" as any)}>
              <View style={[styles.menuIconContainer, { backgroundColor: "rgba(255, 75, 75, 0.1)" }]}><Heart size={20} color="#FF4B4B" /></View>
              <View style={styles.menuTextContainer}><Text style={[styles.menuText, { color: colors.text }]}>Хадгалсан зарууд</Text><Text style={[styles.menuSubText, { color: colors.textSecondary }]}>Таны зүрх дарж хадгалсан зарууд</Text></View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push("/location-picker")}>
              <View style={[styles.menuIconContainer, { backgroundColor: colors.backgroundSecondary }]}><MapPin size={20} color={colors.textSecondary} /></View>
              <View style={styles.menuTextContainer}><Text style={[styles.menuText, { color: colors.text }]}>Байршил</Text><Text style={[styles.menuSubText, { color: colors.textSecondary }]}>Өөрийн байршлаа тохируулах</Text></View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} activeOpacity={0.7} onPress={openPasswordModal}>
              <View style={[styles.menuIconContainer, { backgroundColor: colors.backgroundSecondary }]}><Lock size={20} color={colors.textSecondary} /></View>
              <Text style={[styles.menuText, { color: colors.text }]}>Нууц үг өөрчлөх</Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} activeOpacity={0.7} onPress={() => setShowThemeSelector(true)}>
              <View style={[styles.menuIconContainer, { backgroundColor: colors.backgroundSecondary }]}><Palette size={20} color={colors.textSecondary} /></View>
              <View style={styles.menuTextContainer}><Text style={[styles.menuText, { color: colors.text }]}>Theme</Text><Text style={[styles.menuSubText, { color: colors.textSecondary }]}>Өнгөний төрх солих</Text></View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {isSuperAdmin && (
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} activeOpacity={0.7} onPress={openAdminPanel}>
                <View style={[styles.menuIconContainer, styles.adminIconContainer]}><Shield size={20} color="#FF9500" /></View>
                <View style={styles.menuTextContainer}><Text style={[styles.menuText, { color: colors.text }]}>Админ панел</Text><Text style={styles.adminSubText}>Хэрэглэгч болон зарууд харах</Text></View>
                <ChevronRight size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border, borderBottomWidth: 0 }]} activeOpacity={0.7} onPress={handleDeleteAccount}>
              <View style={[styles.menuIconContainer, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>{deleteBusy ? <ActivityIndicator /> : <Trash2 size={20} color={colors.error} />}</View>
              <Text style={[styles.menuText, { color: colors.error }]}>Профайл устгах</Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Тусламж</Text>
          <View style={[styles.menuList, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}>
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push("/feedback" as Href)}>
              <View style={[styles.menuIconContainer, { backgroundColor: colors.backgroundSecondary }]}><MessageSquare size={20} color={colors.textSecondary} /></View>
              <View style={styles.menuTextContainer}><Text style={[styles.menuText, { color: colors.text }]}>Санал хүсэлт</Text><Text style={[styles.menuSubText, { color: colors.textSecondary }]}>Сайжруулах санал илгээх</Text></View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push("/help" as any)}>
              <View style={[styles.menuIconContainer, { backgroundColor: colors.backgroundSecondary }]}><HelpCircle size={20} color={colors.textSecondary} /></View>
              <Text style={[styles.menuText, { color: colors.text }]}>Тусламж ба Нөхцөл</Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} activeOpacity={0.7} onPress={async () => { await logout(); router.push("/"); }}>
              <View style={[styles.menuIconContainer, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}><LogOut size={20} color={colors.error} /></View>
              <Text style={[styles.menuText, { color: colors.error }]}>Гарах</Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 🎯 ЯГ ЭНД НЭМНЭ: Version харуулах хэсэг */}
        <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 10 }}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>
            Хувилбар 1.0.0
          </Text>
        </View>
        <View style={styles.bottomPadding} />
      </ScrollView>

      <Modal visible={isReviewsModalVisible} animationType="slide" onRequestClose={() => setIsReviewsModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
            <TouchableOpacity onPress={() => setIsReviewsModalVisible(false)}><X size={28} color={colors.text} /></TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Бүх сэтгэгдэл ({reviews.length})</Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>{reviews.map(renderReviewItem)}</ScrollView>
        </SafeAreaView>
      </Modal>

      <ThemeSelector visible={showThemeSelector} onClose={() => setShowThemeSelector(false)} />

      <Modal visible={isEditModalVisible} animationType="slide" transparent onRequestClose={() => setIsEditModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsEditModalVisible(false)}>
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Нэр өөрчлөх</Text>
                  <TouchableOpacity onPress={() => setIsEditModalVisible(false)}><X size={24} color={colors.text} /></TouchableOpacity>
                </View>
                <TextInput style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]} value={editedName} onChangeText={setEditedName} placeholder="Нэр оруулах" placeholderTextColor={colors.textSecondary} autoFocus />
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSaveName} activeOpacity={0.8}>
                  <Text style={[styles.saveButtonText, { color: colors.headerText }]}>Хадгалах</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isPwModalVisible} animationType="slide" transparent onRequestClose={() => setIsPwModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsPwModalVisible(false)}>
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Нууц үг өөрчлөх</Text>
                  <TouchableOpacity onPress={() => setIsPwModalVisible(false)}><X size={24} color={colors.text} /></TouchableOpacity>
                </View>
                <TextInput style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]} value={currentPw} onChangeText={setCurrentPw} placeholder="Одоогийн нууц үг" placeholderTextColor={colors.textSecondary} secureTextEntry={!pwShow} />
                <TextInput style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]} value={newPw} onChangeText={setNewPw} placeholder="Шинэ нууц үг" placeholderTextColor={colors.textSecondary} secureTextEntry={!pwShow} />
                <TextInput style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]} value={newPw2} onChangeText={setNewPw2} placeholder="Шинэ нууц үг (дахин)" placeholderTextColor={colors.textSecondary} secureTextEntry={!pwShow} />
                <TouchableOpacity style={[styles.eyeBtn, { borderColor: colors.border }]} onPress={() => setPwShow((p) => !p)} activeOpacity={0.8}>
                  {pwShow ? <EyeOff size={18} color={colors.textSecondary} /> : <Eye size={18} color={colors.textSecondary} />}
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{pwShow ? "Нууцлах" : "Харах"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary, opacity: pwBusy ? 0.7 : 1 }]} onPress={handleChangePassword} activeOpacity={0.8} disabled={pwBusy}>
                  <Text style={[styles.saveButtonText, { color: colors.headerText }]}>{pwBusy ? "Сольж байна..." : "Хадгалах"}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isAdminModalVisible} animationType="slide" transparent onRequestClose={() => setIsAdminModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsAdminModalVisible(false)}>
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Admin panel</Text>
                  <TouchableOpacity onPress={() => { setIsAdminModalVisible(false); setAdminPassword(""); }}><X size={24} color={colors.text} /></TouchableOpacity>
                </View>
                <Text style={{ fontSize: 13, marginBottom: 12, color: colors.textSecondary }}>Админ панел руу орохын тулд нууц үгээ оруулна уу.</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]} value={adminPassword} onChangeText={setAdminPassword} placeholder="Admin password" placeholderTextColor={colors.textSecondary} secureTextEntry autoFocus autoCapitalize="none" />
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary, opacity: isUnlockingAdmin ? 0.7 : 1 }]} onPress={handleUnlockAdmin} activeOpacity={0.8} disabled={isUnlockingAdmin}>
                  <Text style={[styles.saveButtonText, { color: colors.headerText }]}>{isUnlockingAdmin ? "Шалгаж байна..." : "Нээх"}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { paddingBottom: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  logo: { width: 140, height: 60 },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  content: { flex: 1 },
  contentContainer: { paddingTop: 20 },
  profileCard: { marginHorizontal: 20, borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "center", marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: "#E5E7EB", gap: 16 },
  avatar: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: 70, height: 70 },
  cameraIcon: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  editButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  profilePhone: { fontSize: 14 },
  profileRatingText: { marginTop: 8, fontSize: 14, fontWeight: "800" },
  profileRentalText: { marginTop: 2, fontSize: 12, fontWeight: "600" },
  emptyReviewBox: { marginHorizontal: 20, padding: 24, borderRadius: 16, borderWidth: 1, alignItems: "center" },
  reviewCard: { padding: 16, borderRadius: 16, borderWidth: 1 },
  reviewHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  reviewerName: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  reviewStars: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewRatingText: { fontSize: 14, fontWeight: "800" },
  reviewComment: { fontSize: 14, lineHeight: 20 },
  seeAllBtn: { paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginLeft: 24, marginBottom: 10 },
  menuList: { marginHorizontal: 20, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  menuIconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 },
  menuTextContainer: { flex: 1 },
  menuText: { fontSize: 15, fontWeight: "600", flex: 1 },
  menuSubText: { fontSize: 12, marginTop: 2 },
  adminIconContainer: { backgroundColor: "#FFF3E0" },
  adminSubText: { fontSize: 12, color: "#FF9500", marginTop: 2 },
  versionRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingTop: 14, paddingBottom: 16, gap: 10 },
  versionIconContainer: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  versionText: { fontSize: 12, fontWeight: "600" },
  bottomPadding: { height: 20 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  input: { borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16, borderWidth: 1 },
  saveButton: { borderRadius: 12, padding: 16, alignItems: "center" },
  saveButtonText: { fontSize: 16, fontWeight: "700" },
  eyeBtn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 12, marginBottom: 14 },
});