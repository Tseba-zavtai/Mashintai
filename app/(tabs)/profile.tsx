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
  Info,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useJobs } from "@/contexts/JobsContext";
import { useMemo, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import ThemeSelector from "@/components/ThemeSelector";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import SponsorCountdown from "@/components/SponsorCountdown";
import type { Href } from "expo-router";
import { supabase } from "@/lib/supabase";
import { getLogoSource } from "@/constants/logo";

const APP_VERSION = "1.0.0";
const DELETE_USER_URL = "https://iijtaosyryyxervjjuzd.functions.supabase.co/delete-user";
const STORAGE_BUCKET = "post-images"; 

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let bufferLength = base64.length * 0.75;
  const len = base64.length;

  if (base64[len - 1] === "=") bufferLength--;
  if (base64[len - 2] === "=") bufferLength--;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);
  let p = 0;

  for (let i = 0; i < len; i += 4) {
    const encoded1 = chars.indexOf(base64[i]);
    const encoded2 = chars.indexOf(base64[i + 1]);
    const encoded3 = chars.indexOf(base64[i + 2]);
    const encoded4 = chars.indexOf(base64[i + 3]);

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);

    if (encoded3 !== 64 && encoded3 !== -1) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (encoded4 !== 64 && encoded4 !== -1) {
      bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
    }
  }
  return arrayBuffer;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { jobs } = useJobs();
  const {
    user,
    logout,
    isAuthenticated,
    updateProfile,
    isSuperAdmin,
    unlockAdmin,
    isAdminUnlocked,
    lockAdmin,
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
  
  // 🎯 НЭМЭЛТ: Таны бусдаас түрээсэлсэн барааны тоог хадгалах хувьсагч (Одоогоор 0 байна, дараа нь баазаас уншина)
  const [rentedFromOthersCount, setRentedFromOthersCount] = useState(0);

  const formatRating = (value: any) => {
    if (value === null || value === undefined || value === "") return "Шинэ";
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(1) : "Шинэ";
  };

  const myEmployerJobs = useMemo(() => {
    if (!user) return [];
    return jobs.filter(
      (job) => job.postType === "job" && job.postedBy.phone === user.phone,
    );
  }, [jobs, user]);

  const myProfileStats = useMemo(() => {
    if (!user) {
      return { userRatingAvg: null, userReviewCount: 0, rentalCount: 0 };
    }

    const myPostedJob = (jobs as any[]).find((job: any) => {
      const postedBy = job?.postedBy ?? {};
      return postedBy.phone === user.phone || postedBy.id === user.id;
    }) as any;

    return {
      userRatingAvg: myPostedJob?.postedBy?.userRatingAvg ?? null,
      userReviewCount: myPostedJob?.postedBy?.userReviewCount ?? 0,
      rentalCount: myPostedJob?.postedBy?.rentalCount ?? 0,
    };
  }, [jobs, user]);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/auth");
  }, [isAuthenticated, router]);

  useEffect(() => {
    refetchProfile?.().catch(() => {});
  }, []);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingImage(true);
        const imageUri = result.assets[0].uri;
        const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: "base64" });
        const fileData = base64ToArrayBuffer(base64);

        const userId = user?.id || "anonymous";
        const fileName = `avatar-${userId}-${Date.now()}.jpg`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, fileData, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(filePath);

        if (publicData?.publicUrl) {
          await updateProfile({ photoUri: publicData.publicUrl });
        }
      }
    } catch (error) {
      console.error("Failed to pick image:", error);
      Alert.alert("Алдаа", "Зураг хуулж хадгалахад алдаа гарлаа. Та дахин оролдоно уу.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleEditName = () => {
    setEditedName(user?.name || "");
    setIsEditModalVisible(true);
  };

  const handleSaveName = async () => {
    try {
      if (editedName.trim()) {
        await updateProfile({ name: editedName.trim() });
        setIsEditModalVisible(false);
      }
    } catch (error) {
      console.error("Failed to update name:", error);
      Alert.alert("Алдаа", "Нэр өөрчлөхөд алдаа гарлаа");
    }
  };

  const openAdminPanel = () => {
    if (!isSuperAdmin) return;
    if (isAdminUnlocked) {
      router.push("/admin");
      return;
    }

    setAdminPassword("");
    setIsAdminModalVisible(true);
  };

  const handleUnlockAdmin = async () => {
    try {
      if (!adminPassword.trim()) {
        Alert.alert("Алдаа", "Admin password оруулна уу");
        return;
      }
      setIsUnlockingAdmin(true);
      await unlockAdmin(adminPassword.trim());
      setIsAdminModalVisible(false);
      setAdminPassword("");
      router.push("/admin");
    } catch (e: any) {
      Alert.alert("Алдаа", e?.message ?? "Admin password буруу байна");
    } finally {
      setIsUnlockingAdmin(false);
    }
  };

  const openPasswordModal = () => {
    setCurrentPw("");
    setNewPw("");
    setNewPw2("");
    setPwShow(false);
    setIsPwModalVisible(true);
  };

  const handleChangePassword = async () => {
    try {
      if (!currentPw.trim() || !newPw.trim() || !newPw2.trim()) {
        Alert.alert("Алдаа", "Бүх талбарыг бөглөнө үү");
        return;
      }
      if (newPw.trim().length < 6) {
        Alert.alert("Алдаа", "Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байна");
        return;
      }
      if (newPw.trim() !== newPw2.trim()) {
        Alert.alert("Алдаа", "Шинэ нууц үг давталт таарахгүй байна");
        return;
      }

      setPwBusy(true);
      await changePassword(currentPw.trim(), newPw.trim());
      setIsPwModalVisible(false);
      Alert.alert("Амжилттай", "Нууц үг амжилттай солигдлоо");
    } catch (e: any) {
      Alert.alert("Алдаа", e?.message ?? "Нууц үг солиход алдаа гарлаа");
    } finally {
      setPwBusy(false);
    }
  };

  const runDeleteAccount = async () => {
    if (!user?.id) throw new Error("UserId олдсонгүй");
    const { data: s } = await supabase.auth.getSession();
    const token = s?.session?.access_token;
    if (!token) throw new Error("Session token олдсонгүй");
    const res = await fetch(DELETE_USER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: user.id }),
    });
    const json = await res.json().catch(() => ({}) as any);
    if (!res.ok)
      throw new Error(json?.error ?? "Профайл устгахад алдаа гарлаа");
    if (!json?.ok) throw new Error("Профайл устгахад алдаа гарлаа");
  };

  const handleDeleteAccount = () => {
    if (deleteBusy) return;
    Alert.alert(
      "Профайл устгах",
      "Та профайлаа устгахдаа итгэлтэй байна уу? Энэ үйлдлийг буцаах боломжгүй.",
      [
        { text: "Болих", style: "cancel" },
        {
          text: "Устгах",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleteBusy(true);
              await runDeleteAccount();
              try {
                await logout();
              } catch {}
              router.replace("/auth");
            } catch (e: any) {
              Alert.alert(
                "Алдаа",
                e?.message ?? "Профайл устгахад алдаа гарлаа",
              );
            } finally {
              setDeleteBusy(false);
            }
          },
        },
      ],
    );
  };

  if (!isAuthenticated) return null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.backgroundSecondary },
      ]}
    >
      <SafeAreaView
        edges={["top"]}
        style={[styles.safeArea, { backgroundColor: colors.headerBackground }]}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>
            Профайл
          </Text>
          <Image
            source={logoSource}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View
          style={[styles.profileCard, { backgroundColor: colors.background }]}
        >
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8} disabled={isUploadingImage}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              {isUploadingImage ? (
                <ActivityIndicator color={colors.headerText} />
              ) : user?.photoUri ? (
                <Image
                  source={{ uri: user.photoUri }}
                  style={styles.avatarImage}
                />
              ) : (
                <User size={40} color={colors.headerText} strokeWidth={2} />
              )}
              <View
                style={[
                  styles.cameraIcon,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.background,
                  },
                ]}
              >
                <Camera size={16} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {user?.name || "Хэрэглэгч"}
            </Text>
            <Text
              style={[styles.profilePhone, { color: colors.textSecondary }]}>
              {user?.phone || "+976 9999 9999"}
            </Text>

            <SponsorCountdown />

            {/* Дэлгэрэнгүй Үнэлгээ болон Түрээслүүлсэн тоо энд харагдана */}
            <Text style={[styles.profileRatingText, { color: colors.text }]}>
              ★ {formatRating(myProfileStats.userRatingAvg)} ·{" "}
              {myProfileStats.userReviewCount} үнэлгээ
            </Text>
            <Text
              style={[
                styles.profileRentalText,
                { color: colors.textSecondary },
              ]}
            >
              {myProfileStats.rentalCount} удаа түрээслүүлсэн
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleEditName}
            style={[styles.editButton, { backgroundColor: "#000000" }]}
          >
            <Edit2 size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={{ 
          marginHorizontal: 20, 
          borderRadius: 16, 
          padding: 16, 
          borderWidth: 1, 
          borderColor: colors.border,
          backgroundColor: colors.background,
          flexDirection: "row", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: 16 
        }}>
          <View>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>Зар оруулах боломжит эрх</Text>
            <Text style={{ fontSize: 18, fontWeight: "900", marginTop: 2, color: colors.primary }}>{user?.available_post_credits ?? 0} эрх үлдсэн</Text>
          </View>
          <TouchableOpacity 
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary }}
            onPress={() => router.push({ pathname: "/sponsor-payment", params: { targetType: "credit" } })}
            activeOpacity={0.8}
          >
            <Text style={{ color: colors.headerText, fontWeight: "800", fontSize: 13 }}>Эрх авах (5,000₮)</Text>
          </TouchableOpacity>
        </View>

        {/* 🎯 ЗАСВАР: 4 хайрцгийг 2 болгож цөөлсөн хэсэг */}
        <View style={styles.statsContainer}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: "/my-jobs", params: { type: "job" } })}
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {myEmployerJobs.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Түрээслүүлэх зар
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
            activeOpacity={0.7}
            onPress={() => router.push("/rental-requests")}
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {rentedFromOthersCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Нийт түрээслэсэн
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Аккаунт
          </Text>
          <View
            style={[styles.menuList, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
          >
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => router.push("/location-picker")}
            >
              <View
                style={[
                  styles.menuIconContainer,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                <MapPin size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuText, { color: colors.text }]}>
                  Байршил
                </Text>
                <Text style={[styles.menuSubText, { color: colors.textSecondary }]}>
                  Өөрийн байршлаа тохируулах
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              activeOpacity={0.7}
              onPress={openPasswordModal}
            >
              <View
                style={[
                  styles.menuIconContainer,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                <Lock size={20} color={colors.textSecondary} />
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>
                Нууц үг өөрчлөх
              </Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => setShowThemeSelector(true)}
            >
              <View
                style={[
                  styles.menuIconContainer,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                <Palette size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuText, { color: colors.text }]}>
                  Theme
                </Text>
                <Text style={[styles.menuSubText, { color: colors.textSecondary }]}>
                  Өнгөний төрх солих
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {isSuperAdmin && (
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: colors.border }]}
                activeOpacity={0.7}
                onPress={openAdminPanel}
              >
                <View
                  style={[styles.menuIconContainer, styles.adminIconContainer]}
                >
                  <Shield size={20} color="#FF9500" />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuText, { color: colors.text }]}>
                    Админ панел
                  </Text>
                  <Text style={styles.adminSubText}>
                    Хэрэглэгч болон зарууд харах
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            {isSuperAdmin && isAdminUnlocked && (
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: colors.border }]}
                activeOpacity={0.7}
                onPress={async () => {
                  await lockAdmin?.();
                  Alert.alert("Амжилттай", "Admin panel дахин түгжигдлээ");
                }}
              >
                <View
                  style={[
                    styles.menuIconContainer,
                    { backgroundColor: colors.backgroundSecondary },
                  ]}
                >
                  <Lock size={20} color={colors.textSecondary} />
                </View>
                <Text style={[styles.menuText, { color: colors.text }]}>
                  Admin panel түгжих
                </Text>
                <ChevronRight size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.menuItem,
                {
                  borderBottomColor: colors.border,
                  opacity: deleteBusy ? 0.6 : 1,
                  borderBottomWidth: 0, 
                },
              ]}
              activeOpacity={0.7}
              onPress={handleDeleteAccount}
              disabled={deleteBusy}
            >
              <View
                style={[
                  styles.menuIconContainer,
                  { backgroundColor: "rgba(239, 68, 68, 0.1)" },
                ]}
              >
                {deleteBusy ? (
                  <ActivityIndicator />
                ) : (
                  <Trash2 size={20} color={colors.error} />
                )}
              </View>
              <Text style={[styles.menuText, { color: colors.error }]}>
                {deleteBusy ? "Устгаж байна..." : "Профайл устгах"}
              </Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Тусламж
          </Text>
          <View
            style={[styles.menuList, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
          >
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => router.push("/feedback" as Href)}
            >
              <View
                style={[
                  styles.menuIconContainer,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                <MessageSquare size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuText, { color: colors.text }]}>
                  Санал хүсэлт
                </Text>
                <Text style={[styles.menuSubText, { color: colors.textSecondary }]}>
                  Сайжруулах санал, хүсэлт илгээх
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => router.push("/help")}
            >
              <View
                style={[
                  styles.menuIconContainer,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                <HelpCircle size={20} color={colors.textSecondary} />
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>
                Тусламж
              </Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => {
                Alert.alert(
                  "Гарах",
                  "Та системээс гарахдаа итгэлтэй байна уу?",
                  [
                    { text: "Үгүй", style: "cancel" },
                    {
                      text: "Тийм",
                      onPress: async () => {
                        await logout();
                        router.push("/");
                      },
                      style: "destructive",
                    },
                  ],
                );
              }}
            >
              <View
                style={[
                  styles.menuIconContainer,
                  { backgroundColor: "rgba(239, 68, 68, 0.1)" },
                ]}
              >
                <LogOut size={20} color={colors.error} />
              </View>
              <Text style={[styles.menuText, { color: colors.error }]}>
                Гарах
              </Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.versionRow, { borderBottomWidth: 0 }]}>
              <View
                style={[
                  styles.versionIconContainer,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                <Info size={16} color={colors.textSecondary} />
              </View>
              <Text
                style={[styles.versionText, { color: colors.textSecondary }]}
              >
                Version {APP_VERSION}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <ThemeSelector
        visible={showThemeSelector}
        onClose={() => setShowThemeSelector(false)}
      />

      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsEditModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: colors.background },
                ]}
              >
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    Нэр өөрчлөх
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsEditModalVisible(false)}
                  >
                    <X size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  value={editedName}
                  onChangeText={setEditedName}
                  placeholder="Нэр оруулах"
                  placeholderTextColor={colors.textSecondary}
                  autoFocus
                />
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={handleSaveName}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.saveButtonText, { color: colors.headerText }]}>
                    Хадгалах
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={isPwModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsPwModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsPwModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: colors.background },
                ]}
              >
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    Нууц үг өөрчлөх
                  </Text>
                  <TouchableOpacity onPress={() => setIsPwModalVisible(false)}>
                    <X size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  value={currentPw}
                  onChangeText={setCurrentPw}
                  placeholder="Одоогийн нууц үг"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!pwShow}
                />

                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  value={newPw}
                  onChangeText={setNewPw}
                  placeholder="Шинэ нууц үг"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!pwShow}
                />

                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  value={newPw2}
                  onChangeText={setNewPw2}
                  placeholder="Шинэ нууц үг (дахин)"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!pwShow}
                />

                <TouchableOpacity
                  style={[styles.eyeBtn, { borderColor: colors.border }]}
                  onPress={() => setPwShow((p) => !p)}
                  activeOpacity={0.8}
                >
                  {pwShow ? (
                    <EyeOff size={18} color={colors.textSecondary} />
                  ) : (
                    <Eye size={18} color={colors.textSecondary} />
                  )}
                  <Text
                    style={{ color: colors.text, fontWeight: "700" as const }}
                  >
                    {pwShow ? "Нууцлах" : "Харах"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: pwBusy ? 0.7 : 1,
                    },
                  ]}
                  onPress={handleChangePassword}
                  activeOpacity={0.8}
                  disabled={pwBusy}
                >
                  <Text style={[styles.saveButtonText, { color: colors.headerText }]}>
                    {pwBusy ? "Сольж байна..." : "Хадгалах"}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={isAdminModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAdminModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsAdminModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: colors.background },
                ]}
              >
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    Admin panel
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setIsAdminModalVisible(false);
                      setAdminPassword("");
                    }}
                  >
                    <X size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <Text
                  style={[styles.adminHint, { color: colors.textSecondary }]}
                >
                  Админ панел руу орохын тулд нууц үгээ оруулна уу.
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  placeholder="Admin password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  autoFocus
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: isUnlockingAdmin ? 0.7 : 1,
                    },
                  ]}
                  onPress={handleUnlockAdmin}
                  activeOpacity={0.8}
                  disabled={isUnlockingAdmin}
                >
                  <Text style={[styles.saveButtonText, { color: colors.headerText }]}>
                    {isUnlockingAdmin ? "Шалгаж байна..." : "Нээх"}
                  </Text>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  logo: { width: 140, height: 60 },
  headerTitle: { fontSize: 18, fontWeight: "600" as const },
  content: { flex: 1 },
  contentContainer: { paddingTop: 20 },

  profileCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 70, height: 70 },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: "700" as const, marginBottom: 4 },
  profilePhone: { fontSize: 14 },
  profileRatingText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "800" as const,
  },
  profileRentalText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600" as const,
  },

  statsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: { fontSize: 28, fontWeight: "700" as const, marginBottom: 4 },
  statLabel: { fontSize: 12, textAlign: "center", fontWeight: "500" },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    marginLeft: 24,
    marginBottom: 10,
  },
  menuList: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuTextContainer: { flex: 1 },
  menuText: { fontSize: 15, fontWeight: "600" as const, flex: 1 },
  menuSubText: { fontSize: 12, marginTop: 2 },

  adminIconContainer: { backgroundColor: "#FFF3E0" },
  adminSubText: { fontSize: 12, color: "#FF9500", marginTop: 2 },

  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  versionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  versionText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },

  bottomPadding: { height: 20 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "700" as const },
  adminHint: { fontSize: 13, marginBottom: 12 },
  input: { borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16, borderWidth: 1 },
  saveButton: { borderRadius: 12, padding: 16, alignItems: "center" },
  saveButtonText: { fontSize: 16, fontWeight: "700" as const },

  eyeBtn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 14,
  },
});