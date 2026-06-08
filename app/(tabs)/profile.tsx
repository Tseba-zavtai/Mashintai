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
import SponsorCountdown from "@/components/SponsorCountdown";
import type { Href } from "expo-router";
import { supabase } from "@/lib/supabase";

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

  const DELETE_USER_URL =
    "https://iijtaosyryyxervjjuzd.functions.supabase.co/delete-user";
  const APP_VERSION = "1.0.0";

  const formatRating = (value: any) => {
    if (value === null || value === undefined || value === "") return "Шинэ";
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(1) : "Шинэ";
  };

  const myWorkerJobs = useMemo(() => {
    if (!user) return [];
    return jobs.filter(
      (job) => job.postType === "worker" && job.postedBy.phone === user.phone,
    );
  }, [jobs, user]);

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
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await updateProfile({ photoUri: result.assets[0].uri });
      }
    } catch (error) {
      console.error("Failed to pick image:", error);
      Alert.alert("Алдаа", "Зураг оруулахад алдаа гарлаа");
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
            source={{
              uri:
                currentTheme === "navy"
                  ? "https://r2-pub.rork.com/attachments/7h0ju4xu59gyen0tzh8ns"
                  : "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/0rqqd3riktgmfxudfl0s8",
            }}
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
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              {user?.photoUri ? (
                <Image
                  source={{ uri: user.photoUri }}
                  style={styles.avatarImage}
                />
              ) : (
                <User size={40} color={colors.text} strokeWidth={2} />
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
              style={[styles.profilePhone, { color: colors.textSecondary }]}
            >
              {user?.phone || "+976 9999 9999"}
            </Text>

            <SponsorCountdown />

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

        <View style={styles.statsContainer}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.background }]}
            activeOpacity={0.7}
            onPress={() =>
              router.push({ pathname: "/my-jobs", params: { type: "worker" } })
            }
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {myWorkerJobs.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Түрээслэх зар
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.background }]}
            activeOpacity={0.7}
            onPress={() =>
              router.push({ pathname: "/my-jobs", params: { type: "job" } })
            }
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {myEmployerJobs.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Түрээслүүлэх зар
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View
            style={[styles.statCard, { backgroundColor: colors.background }]}
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>
              ★ {formatRating(myProfileStats.userRatingAvg)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Хэрэглэгчийн үнэлгээ
            </Text>
          </View>

          <View
            style={[styles.statCard, { backgroundColor: colors.background }]}
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {myProfileStats.rentalCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Нийт түрээс
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Аккаунт
          </Text>
          <View
            style={[styles.menuList, { backgroundColor: colors.background }]}
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
                <MapPin size={20} color={colors.text} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuText, { color: colors.text }]}>
                  Байршил
                </Text>
                <Text style={[styles.menuSubText, { color: "#000000" }]}>
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
                <Lock size={20} color={colors.text} />
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
                <Palette size={20} color={colors.text} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuText, { color: colors.text }]}>
                  Theme
                </Text>
                <Text style={[styles.menuSubText, { color: "#000000" }]}>
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
                  <Lock size={20} color={colors.text} />
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
                },
              ]}
              activeOpacity={0.7}
              onPress={handleDeleteAccount}
              disabled={deleteBusy}
            >
              <View
                style={[
                  styles.menuIconContainer,
                  { backgroundColor: colors.backgroundSecondary },
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
            style={[styles.menuList, { backgroundColor: colors.background }]}
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
                <MessageSquare size={20} color={colors.text} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuText, { color: colors.text }]}>
                  Санал хүсэлт
                </Text>
                <Text style={[styles.menuSubText, { color: "#000000" }]}>
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
                <HelpCircle size={20} color={colors.text} />
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
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                <LogOut size={20} color={colors.error} />
              </View>
              <Text style={[styles.menuText, { color: colors.error }]}>
                Гарах
              </Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.versionRow}>
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
                  <Text style={[styles.saveButtonText, { color: colors.text }]}>
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
                    <EyeOff size={18} color={colors.text} />
                  ) : (
                    <Eye size={18} color={colors.text} />
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
                  <Text style={[styles.saveButtonText, { color: colors.text }]}>
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
                  <Text style={[styles.saveButtonText, { color: colors.text }]}>
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
  statLabel: { fontSize: 12, textAlign: "center" },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    marginLeft: 20,
    marginBottom: 12,
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
  menuText: { fontSize: 16, fontWeight: "600" as const, flex: 1 },
  menuSubText: { fontSize: 12, marginTop: 2 },

  adminIconContainer: { backgroundColor: "#FFF3E0" },
  adminSubText: { fontSize: 12, color: "#FF9500", marginTop: 2 },

  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
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
    fontWeight: "500" as const,
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
  input: { borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16 },
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
