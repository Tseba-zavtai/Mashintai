// app/admin.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Keyboard,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { RefreshCw, Trash2, Edit2, Award, X, Search, MessageSquare, ShieldAlert, LockKeyhole, UnlockKeyhole, CalendarDays } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { Job, JOB_CATEGORIES } from "@/mocks/jobs";
import { useJobs } from "@/contexts/JobsContext";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader";
import { useTheme } from "@/contexts/ThemeContext";

type AdminUser = {
  id: string;
  phone: string | null;
  name: string | null;
  photo_uri: string | null;
  is_super_admin: boolean;
  sponsored_from: string | null;
  sponsored_until: string | null;
  suspended_until: string | null;
  suspension_reason: string | null;
  created_at: string;
};

type RentalDispute = {
  id: string;
  rental_request_id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: "not_returned" | "damaged" | "payment" | "conduct" | "other";
  description: string;
  status: "open" | "under_review" | "resolved" | "dismissed";
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

type FeedbackItem = {
  id: string;
  user_id: string | null;
  name: string | null;
  phone: string | null;
  message: string;
  platform: string | null;
  app_version: string | null;
  created_at: string;
};

const isUserSuspended = (u: Pick<AdminUser, "suspended_until">) => Boolean(u.suspended_until && new Date(u.suspended_until).getTime() > Date.now());

const disputeReasonLabel: Record<RentalDispute["reason"], string> = {
  not_returned: "Бараа буцаагаагүй",
  damaged: "Эвдрэл, гэмтэл",
  payment: "Төлбөр",
  conduct: "Харилцаа",
  other: "Бусад",
};

const isNowSponsored = (u: AdminUser) => {
  if (!u.sponsored_from || !u.sponsored_until) return false;
  const now = Date.now();
  const from = new Date(u.sponsored_from).getTime();
  const until = new Date(u.sponsored_until).getTime();
  if (Number.isNaN(from) || Number.isNaN(until)) return false;
  return now >= from && now <= until;
};

const isJobSponsoredNow = (job: any) => {
  const until = job?.sponsored_until;
  if (!until) return false;
  const t = new Date(until).getTime();
  if (Number.isNaN(t)) return false;
  return t > Date.now();
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

function formatYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function DateRow({
  label,
  value,
  placeholder,
  onPick,
}: {
  label: string;
  value: Date | null;
  placeholder: string;
  onPick: (d: Date) => void;
}) {
  const [show, setShow] = useState(false);
  const displayText = value ? formatYMD(value) : placeholder;

  if (Platform.OS === "ios") {
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "600", color: "#333" }}>{label}</Text>
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          onChange={(_, d) => {
            if (d) onPick(d);
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontWeight: "600", color: "#333" }}>{label}</Text>

      <TouchableOpacity
        style={{
          borderWidth: 1,
          borderColor: "#e0e0e0",
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: "#fafafa",
        }}
        onPress={() => setShow(true)}
        activeOpacity={0.8}
      >
        <Text style={{ color: value ? "#111" : "#777", fontWeight: "600" }}>{displayText}</Text>
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          onChange={(_, d) => {
            setShow(false);
            if (d) onPick(d);
          }}
        />
      )}
    </View>
  );
}

export default function AdminPanel() {
  const router = useRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { isSuperAdmin, isAdminUnlocked } = useAuth() as any;
  const { updateJobCategory, deleteJob, sponsorJob } = useJobs();
  const [activeTab, setActiveTab] = useState<"users" | "jobs" | "banners" | "disputes" | "feedback">("users");
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  const [masterSearch, setMasterSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  
  const [sponsorUserModalVisible, setSponsorUserModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [userFrom, setUserFrom] = useState<Date | null>(null);
  const [userUntil, setUserUntil] = useState<Date | null>(null);
  
  const [sponsorJobModalVisible, setSponsorJobModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const [jobUntil, setJobUntil] = useState<Date | null>(null);

  const [feedbackDetailVisible, setFeedbackDetailVisible] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const hasAdminAccess = Boolean(isSuperAdmin && isAdminUnlocked);

  // ✅ Зөвхөн хэрэглэгч бүрмөсөн устгах үйлдэл л Edge Function шаардана (RLS-ээс гадуур устгах учраас)
  const DELETE_USER_URL = "https://wrekrjaitokrqydkwgtg.functions.supabase.co/delete-user";

  // ✅ USERS query (ШУУД БААЗААС ТАТАХ - Edge Function хэрэггүй)
  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .limit(1000);

      if (error) {
        console.log("admin-users error:", error);
        throw error;
      }

      // JavaScript дотор сүүлд бүртгүүлснээр нь эрэмбэлэх
      const sorted = (data || []).sort((a, b) => {
        if (!a.created_at || !b.created_at) return 0;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return sorted as AdminUser[];
    },
    enabled: hasAdminAccess,
  });

  // ✅ JOBS query
  const jobsQuery = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
      if (error) {
        console.log("admin-jobs query error:", error);
        throw error;
      }
      return (data || []) as any as Job[];
    },
    enabled: hasAdminAccess,
  });

  const bannersQuery = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banners").select("*").order("created_at", { ascending: false });
      if (error) {
        console.log("admin-banners query error:", error);
        throw error;
      }
      return data || [];
    },
    enabled: hasAdminAccess,
  });
  // ✅ FEEDBACK query (ШУУД БААЗААС ТАТАХ - Edge Function хэрэггүй)
  const feedbackQuery = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.log("admin-feedback error:", error);
        throw error;
      }
      return (data || []) as FeedbackItem[];
    },
    enabled: hasAdminAccess,
  });

  const disputesQuery = useQuery({
    queryKey: ["admin-rental-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_disputes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data || []) as RentalDispute[];
    },
    enabled: hasAdminAccess,
  });
  // ✅ Mutations (Users)
  const clearSponsorMutation = useMutation({
    mutationFn: async (user: AdminUser) => {
      const { error } = await supabase.from("users").update({ sponsored_from: null, sponsored_until: null }).eq("id", user.id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (error) => Alert.alert("Алдаа", error instanceof Error ? error.message : "Алдаа гарлаа"),
  });

  const saveUserSponsorMutation = useMutation({
    mutationFn: async ({ userId, from, until }: { userId: string; from: Date | null; until: Date | null }) => {
      const fixedFrom = from ? startOfDay(from) : null;
      const fixedUntil = until ? endOfDay(until) : null;

      const { error } = await supabase
        .from("users")
        .update({
          sponsored_from: fixedFrom ? fixedFrom.toISOString() : null,
          sponsored_until: fixedUntil ? fixedUntil.toISOString() : null,
        })
        .eq("id", userId);

      if (error) throw error;
      return true;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (error) => Alert.alert("Алдаа", error instanceof Error ? error.message : "Алдаа гарлаа"),
  });

  const setAccountSuspensionMutation = useMutation({
    mutationFn: async ({ userId, days, clear }: { userId: string; days?: number; clear?: boolean }) => {
      const now = new Date();
      const updates = clear
        ? { suspended_until: null, suspension_reason: null, suspended_at: null, suspended_by: null }
        : {
            suspended_until: new Date(now.getTime() + Math.max(1, Number(days ?? 7)) * 24 * 60 * 60 * 1000).toISOString(),
            suspension_reason: "Маргаан шалгаж байна",
            suspended_at: now.toISOString(),
          };
      const { error } = await supabase.from("users").update(updates).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (error) => Alert.alert("Алдаа", error instanceof Error ? error.message : "Account-ын түгжээг өөрчилж чадсангүй"),
  });

  const updateDisputeMutation = useMutation({
    mutationFn: async ({ disputeId, status }: { disputeId: string; status: RentalDispute["status"] }) => {
      const { error } = await supabase.from("rental_disputes").update({ status }).eq("id", disputeId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-rental-disputes"] }),
    onError: (error) => Alert.alert("Алдаа", error instanceof Error ? error.message : "Маргааны төлөвийг шинэчилж чадсангүй"),
  });

  const handleAccountSuspension = (target: AdminUser) => {
    if (target.is_super_admin) return;
    if (isUserSuspended(target)) {
      Alert.alert("Түгжээ тайлах уу?", `${target.name || "Энэ хэрэглэгч"}-ийн түр түгжээг шууд цуцлах уу?`, [
        { text: "Болих", style: "cancel" },
        { text: "Тайлах", onPress: () => setAccountSuspensionMutation.mutate({ userId: target.id, clear: true }) },
      ]);
      return;
    }
    Alert.alert("7 хоног түр түгжих үү?", `${target.name || "Энэ хэрэглэгч"} зар оруулах болон түрээсийн шинэ үйлдэл хийх боломжгүй болно. Бараагаа буцааж өгсөн үйлдэл нээлттэй үлдэнэ.`, [
      { text: "Болих", style: "cancel" },
      { text: "7 хоног түгжих", style: "destructive", onPress: () => setAccountSuspensionMutation.mutate({ userId: target.id, days: 7 }) },
    ]);
  };
  // ✅ DELETE USER (EDGE FUNCTION) -> public.users + auth.users хоёуланг устгана
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token;
      if (!token) throw new Error("Session token олдсонгүй");

      const res = await fetch(DELETE_USER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error ?? "User устгах үед алдаа гарлаа");

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDetailModalVisible(false);
      setSelectedUser(null);
    },
    onError: (error) => Alert.alert("Алдаа", error instanceof Error ? error.message : "Хэрэглэгч устгах үед алдаа гарлаа"),
  });

  // ✅ Jobs mutations
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ jobId, category }: { jobId: string; category: string }) => {
      return await updateJobCategory(jobId, category);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      setCategoryModalVisible(false);
      setEditingJobId(null);
    },
    onError: () => Alert.alert("Алдаа", "Категори солих үед алдаа гарлаа"),
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await deleteJob(jobId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      Alert.alert("Амжилттай", "Зар устгалаа ✅");
    },
    onError: (e) => {
      console.log("deleteJobMutation error =>", e);
      Alert.alert("Алдаа", e instanceof Error ? e.message : "Network алдаа / устгаж чадсангүй");
    },
  });

  const sponsorJobMutation = useMutation({
    mutationFn: async ({ jobId, until }: { jobId: string; until: Date | null }) => {
      const fixedUntil = until ? endOfDay(until) : null;
      return await sponsorJob(jobId, fixedUntil);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      Alert.alert("Амжилттай", "Sponsored хугацаа хадгаллаа ✅");
    },
    onError: (e) => {
      console.log("sponsorJobMutation error =>", e);
      Alert.alert("Алдаа", e instanceof Error ? e.message : "Network алдаа / хадгалж чадсангүй");
    },
  });

  const handleDeleteJob = (jobId: string) => {
    Alert.alert("Баталгаажуулах", "Та энэ зарыг устгахдаа итгэлтэй байна уу?", [
      { text: "Цуцлах", style: "cancel" },
      { text: "Устгах", style: "destructive", onPress: () => deleteJobMutation.mutate(jobId) },
    ]);
  };

  const handleEditCategory = (job: any) => {
    setEditingJobId(job.id);
    setSelectedCategory(job.category);
    setCategoryModalVisible(true);
  };

  const handleSaveCategory = () => {
    if (editingJobId && selectedCategory) {
      updateCategoryMutation.mutate({ jobId: editingJobId, category: selectedCategory });
    }
  };

  const handleDeleteUser = (user: AdminUser) => {
    Alert.alert("Баталгаажуулах", "Та энэ хэрэглэгчийг устгахдаа итгэлтэй байна уу?", [
      { text: "Цуцлах", style: "cancel" },
      { text: "Устгах", style: "destructive", onPress: () => deleteUserMutation.mutate(user.id) },
    ]);
  };

  const openUserSponsorModal = (u: AdminUser) => {
    setEditingUser(u);
    setUserFrom(u.sponsored_from ? new Date(u.sponsored_from) : new Date());
    setUserUntil(u.sponsored_until ? new Date(u.sponsored_until) : null);
    setSponsorUserModalVisible(true);
  };

  const openJobSponsorModal = (job: any) => {
    setEditingJob(job);
    setJobUntil(job.sponsored_until ? new Date(job.sponsored_until) : null);
    setSponsorJobModalVisible(true);
  };

  const searchResults = useMemo(() => {
    if (!masterSearch.trim()) return { users: [], jobs: [] };

    const query = masterSearch.toLowerCase().trim();

    const filteredUsers = (usersQuery.data || []).filter(
      (user) => (user.name || "").toLowerCase().includes(query) || (user.phone || "").toLowerCase().includes(query)
    );

    const filteredJobs = (jobsQuery.data || []).filter((job: any) => {
      const t = String(job?.title ?? "").toLowerCase();
      const d = String(job?.description ?? "").toLowerCase();
      const c = String(job?.category ?? "").toLowerCase();
      return t.includes(query) || d.includes(query) || c.includes(query);
    });

    return { users: filteredUsers, jobs: filteredJobs as any as Job[] };
  }, [masterSearch, usersQuery.data, jobsQuery.data]);

  const handleUserClick = (user: AdminUser) => {
    setSelectedUser(user);
    setDetailModalVisible(true);
    setMasterSearch("");
    setSearchFocused(false);
    Keyboard.dismiss();
  };

  const openFeedbackDetail = (f: FeedbackItem) => {
    setSelectedFeedback(f);
    setFeedbackDetailVisible(true);
  };
  if (!hasAdminAccess) {
    return (
      <View style={styles.container}>
        <AppHeader title="Админ самбар" />
        <View style={styles.loginContainer}>
          <Text style={styles.loginTitle}>Хандах эрхгүй</Text>
          <Text style={styles.loginSubtitle}>
            Админ самбар руу Profile дээрээс өөрийн нууц үгээ баталгаажуулж орно уу.
          </Text>

          <TouchableOpacity style={styles.loginButton} onPress={() => router.back()}>
            <Text style={styles.loginButtonText}>Буцах</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Админ самбар"
        rightAccessory={
          <TouchableOpacity
            onPress={() => {
              usersQuery.refetch();
              jobsQuery.refetch();
              bannersQuery.refetch();
              feedbackQuery.refetch();
              disputesQuery.refetch();
            }}
            style={styles.refreshButton}
            accessibilityLabel="Шинэчлэх"
          >
            <RefreshCw size={20} color={colors.headerText} />
          </TouchableOpacity>
        }
      />
      <View style={styles.masterSearchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.masterSearchInput}
            placeholder="Хэрэглэгч / зар хайх..."
            value={masterSearch}
            onChangeText={setMasterSearch}
            onFocus={() => setSearchFocused(true)}
            autoCapitalize="none"
          />
          {masterSearch.length > 0 && (
            <TouchableOpacity onPress={() => setMasterSearch("")} style={styles.clearButton}>
              <X size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <TouchableOpacity style={[styles.seasonalShortcut, { backgroundColor: colors.accent, borderColor: colors.border }]} onPress={() => router.push("/admin-seasonal" as any)} activeOpacity={0.8}>
        <CalendarDays size={20} color={colors.headerText} />
        <View style={styles.seasonalShortcutTextWrap}>
          <Text style={[styles.seasonalShortcutTitle, { color: colors.text }]}>Seasonal удирдах</Text>
          <Text style={[styles.seasonalShortcutDescription, { color: colors.textSecondary }]}>Хугацаа болон category / subcategory сонгох</Text>
        </View>
      </TouchableOpacity>

      {searchFocused && masterSearch.trim() && (
        <View style={styles.searchOverlay}>
          <TouchableOpacity
            style={styles.searchBackdrop}
            activeOpacity={1}
            onPress={() => {
              setSearchFocused(false);
              Keyboard.dismiss();
            }}
          />
          <View style={styles.searchResultsContainer}>
            <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
              {searchResults.users.length === 0 ? (
                <Text style={styles.noResultsText}>Илэрц олдсонгүй</Text>
              ) : (
                <>
                  <Text style={styles.searchSectionTitle}>Хэрэглэгчид ({searchResults.users.length})</Text>
                  {searchResults.users.map((u) => (
                    <TouchableOpacity key={u.id} style={styles.searchResultItem} onPress={() => handleUserClick(u)}>
                      <View style={styles.searchResultContent}>
                        <Text style={styles.searchResultTitle}>{u.name || "Нэргүй"}</Text>
                        <Text style={styles.searchResultSubtitle}>📱 {u.phone || "-"}</Text>
                      </View>
                      <View style={styles.searchResultBadges}>
                        {u.is_super_admin && <Text style={styles.searchBadge}>👑</Text>}
                        {isNowSponsored(u) && <Text style={styles.searchBadge}>⭐</Text>}
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === "users" && styles.activeTab]} onPress={() => setActiveTab("users")}>
          <Text style={[styles.tabText, activeTab === "users" && styles.activeTabText]}>
            Хэрэглэгчид ({usersQuery.data?.length || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tab, activeTab === "jobs" && styles.activeTab]} onPress={() => setActiveTab("jobs")}>
          <Text style={[styles.tabText, activeTab === "jobs" && styles.activeTabText]}>
            Зарууд ({jobsQuery.data?.length || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "banners" && styles.activeTab]}
          onPress={() => setActiveTab("banners")}
        >
          <Text style={[styles.tabText, activeTab === "banners" && styles.activeTabText]}>
            Баннер ({bannersQuery.data?.length || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "disputes" && styles.activeTab]}
          onPress={() => setActiveTab("disputes")}
        >
          <Text style={[styles.tabText, activeTab === "disputes" && styles.activeTabText]}>
            Маргаан ({disputesQuery.data?.filter((item) => item.status === "open" || item.status === "under_review").length || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "feedback" && styles.activeTab]}
          onPress={() => setActiveTab("feedback")}
        >
          <Text style={[styles.tabText, activeTab === "feedback" && styles.activeTabText]}>
            Feedback ({feedbackQuery.data?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === "users" ? (
          <View>
            {usersQuery.isLoading ? (
              <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            ) : usersQuery.error ? (
              <Text style={styles.errorText}>Алдаа гарлаа: {String((usersQuery.error as any)?.message ?? usersQuery.error)}</Text>
            ) : (
              <>
                {usersQuery.data?.map((u) => {
                  const sponsoredNow = isNowSponsored(u);
                  const suspendedNow = isUserSuspended(u);

                  return (
                    <View key={u.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>{u.name || "Нэргүй"}</Text>
                        <View style={styles.badgeContainer}>
                          {u.is_super_admin && (
                            <View style={styles.adminBadge}>
                              <Text style={styles.adminBadgeText}>👑 Админ</Text>
                            </View>
                          )}
                          {sponsoredNow && (
                            <View style={styles.sponsoredBadge}>
                              <Text style={styles.sponsoredText}>⭐</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <Text style={styles.cardInfo}>📱 {u.phone || "-"}</Text>
                      {suspendedNow && <Text style={styles.suspendedText}>Түр түгжээтэй · {new Date(u.suspended_until as string).toLocaleString()}</Text>}

                      {!u.is_super_admin && (
                        <>
                          <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => openUserSponsorModal(u)}>
                            <Edit2 size={16} color="#fff" />
                            <Text style={styles.actionButtonText}>Sponsored хугацаа тохируулах</Text>
                          </TouchableOpacity>

                          {sponsoredNow && (
                            <TouchableOpacity
                              style={[styles.actionButton, styles.unsponsorButton]}
                              onPress={() => clearSponsorMutation.mutate(u)}
                              disabled={clearSponsorMutation.isPending}
                            >
                              <Text style={styles.actionButtonText}>Sponsored цуцлах</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}

                      {!u.is_super_admin && (
                        <TouchableOpacity style={[styles.actionButton, suspendedNow ? styles.unlockButton : styles.suspendButton]} onPress={() => handleAccountSuspension(u)} disabled={setAccountSuspensionMutation.isPending}>
                          {suspendedNow ? <UnlockKeyhole size={16} color="#fff" /> : <LockKeyhole size={16} color="#fff" />}
                          <Text style={styles.actionButtonText}>{suspendedNow ? "Түгжээ тайлах" : "7 хоног түгжих"}</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteUser(u)}
                        disabled={deleteUserMutation.isPending}
                      >
                        <Trash2 size={16} color="#fff" />
                        <Text style={styles.actionButtonText}>Устгах</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.editButton]}
                        onPress={() => {
                          setSelectedUser(u);
                          setDetailModalVisible(true);
                        }}
                      >
                        <Edit2 size={16} color="#fff" />
                        <Text style={styles.actionButtonText}>Дэлгэрэнгүй</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {usersQuery.data?.length === 0 && <Text style={styles.emptyText}>Хэрэглэгч байхгүй байна</Text>}
              </>
            )}
          </View>
        ) : activeTab === "jobs" ? (
          <View>
            {jobsQuery.isLoading ? (
              <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            ) : jobsQuery.error ? (
              <Text style={styles.errorText}>Алдаа гарлаа: {String((jobsQuery.error as any)?.message ?? jobsQuery.error)}</Text>
            ) : (
              <>
                {(jobsQuery.data || []).map((job: any) => {
                  const sponsoredNow = isJobSponsoredNow(job);

                  return (
                    <View key={job.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>{job.title || "Гарчиггүй"}</Text>
                        <View style={styles.badgeContainer}>
                          {sponsoredNow && (
                            <View style={styles.sponsoredBadge}>
                              <Text style={styles.sponsoredText}>⭐</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {(Number(job.sponsored_view_count ?? 0) > 0 || Number(job.sponsored_click_count ?? 0) > 0) && (
                        <Text style={styles.cardInfo}>📈 Үзэлт: {Number(job.sponsored_view_count ?? 0).toLocaleString()} · Даралт: {Number(job.sponsored_click_count ?? 0).toLocaleString()}</Text>
                      )}
                      {job.category && job.category !== job.title && <Text style={styles.cardInfo}>🏷️ {job.category}</Text>}

                      {!!job.description && (
                        <Text style={[styles.cardInfo, { marginTop: 8, color: "#333" }]} numberOfLines={3}>
                          {job.description}
                        </Text>
                      )}

                      <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => handleEditCategory(job)}>
                        <Edit2 size={16} color="#fff" />
                        <Text style={styles.actionButtonText}>Категори солих</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={[styles.actionButton, styles.sponsorButton]} onPress={() => openJobSponsorModal(job)}>
                        <Award size={16} color="#fff" />
                        <Text style={styles.actionButtonText}>Sponsored хугацаа тохируулах</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDeleteJob(job.id)}>
                        <Trash2 size={16} color="#fff" />
                        <Text style={styles.actionButtonText}>Устгах</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {(jobsQuery.data || []).length === 0 && <Text style={styles.emptyText}>Зар байхгүй байна</Text>}
              </>
            )}
          </View>
        ) : activeTab === "banners" ? (
          <View>
            {bannersQuery.isLoading ? (
              <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            ) : bannersQuery.error ? (
              <Text style={styles.errorText}>Алдаа гарлаа: {String((bannersQuery.error as any)?.message ?? bannersQuery.error)}</Text>
            ) : (
              <>
                {(bannersQuery.data || []).map((banner: any) => {
                  const placementLabel = banner.placement === "home_feed" ? "Нүүр" : "Зар нэмэх";
                  const isActive = banner.is_active === true;
                  return (
                    <View key={banner.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>{banner.title || "Гарчиггүй баннер"}</Text>
                        <Text style={[styles.cardInfo, { color: isActive ? "#059669" : "#999", marginTop: 0 }]}>{isActive ? "Идэвхтэй" : "Идэвхгүй"}</Text>
                      </View>
                      <Text style={styles.cardInfo}>Байршил: {placementLabel}</Text>
                      <Text style={[styles.cardInfo, { marginTop: 8, color: "#111", fontWeight: "600" }]}>📈 Үзэлт: {Number(banner.view_count ?? 0).toLocaleString()} · Даралт: {Number(banner.click_count ?? 0).toLocaleString()}</Text>
                    </View>
                  );
                })}
                {(bannersQuery.data || []).length === 0 && <Text style={styles.emptyText}>Баннер байхгүй байна</Text>}
              </>
            )}
          </View>
        ) : activeTab === "disputes" ? (
          <View>
            {disputesQuery.isLoading ? (
              <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            ) : disputesQuery.error ? (
              <Text style={styles.errorText}>Алдаа гарлаа: {String((disputesQuery.error as any)?.message ?? disputesQuery.error)}</Text>
            ) : (
              <>
                {(disputesQuery.data || []).map((dispute) => {
                  const reporter = (usersQuery.data || []).find((item) => item.id === dispute.reporter_id);
                  const reported = (usersQuery.data || []).find((item) => item.id === dispute.reported_user_id);
                  const statusText = dispute.status === "open" ? "Шинэ" : dispute.status === "under_review" ? "Шалгаж байна" : dispute.status === "resolved" ? "Шийдсэн" : "Хаасан";
                  const statusColor = dispute.status === "open" ? "#D64545" : dispute.status === "under_review" ? "#007AFF" : dispute.status === "resolved" ? "#0A9B61" : "#777";
                  return (
                    <View key={dispute.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>{disputeReasonLabel[dispute.reason]}</Text>
                        <Text style={[styles.cardInfo, { color: statusColor, fontWeight: "800", marginTop: 0 }]}>{statusText}</Text>
                      </View>
                      <Text style={styles.cardInfo}>Мэдээлсэн: {reporter?.name || "Хэрэглэгч"} · Шалгагдаж буй: {reported?.name || "Хэрэглэгч"}</Text>
                      <Text style={styles.cardInfo}>Хүсэлт: {dispute.rental_request_id}</Text>
                      <Text style={[styles.cardInfo, { marginTop: 10, color: "#111", lineHeight: 20 }]}>{dispute.description}</Text>
                      <Text style={[styles.cardInfo, { fontSize: 12 }]}>{new Date(dispute.created_at).toLocaleString()}</Text>
                      {(dispute.status === "open" || dispute.status === "under_review") && (
                        <>
                          {dispute.status === "open" && (
                            <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => updateDisputeMutation.mutate({ disputeId: dispute.id, status: "under_review" })}>
                              <ShieldAlert size={16} color="#fff" />
                              <Text style={styles.actionButtonText}>Шалгаж эхлэх</Text>
                            </TouchableOpacity>
                          )}
                          {reported && !reported.is_super_admin && (
                            <TouchableOpacity style={[styles.actionButton, isUserSuspended(reported) ? styles.unlockButton : styles.suspendButton]} onPress={() => handleAccountSuspension(reported)}>
                              {isUserSuspended(reported) ? <UnlockKeyhole size={16} color="#fff" /> : <LockKeyhole size={16} color="#fff" />}
                              <Text style={styles.actionButtonText}>{isUserSuspended(reported) ? "Түгжээ тайлах" : "Шалгагдах хэрэглэгчийг 7 хоног түгжих"}</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={[styles.actionButton, styles.unlockButton]} onPress={() => updateDisputeMutation.mutate({ disputeId: dispute.id, status: "resolved" })}>
                            <Text style={styles.actionButtonText}>Шийдсэн гэж хаах</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionButton, styles.unsponsorButton]} onPress={() => updateDisputeMutation.mutate({ disputeId: dispute.id, status: "dismissed" })}>
                            <Text style={styles.actionButtonText}>Үндэслэлгүй гэж хаах</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  );
                })}
                {(disputesQuery.data || []).length === 0 && <Text style={styles.emptyText}>Маргаан бүртгэгдээгүй байна</Text>}
              </>
            )}
          </View>
        ) : (          <View>
            {feedbackQuery.isLoading ? (
              <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            ) : feedbackQuery.error ? (
              <Text style={styles.errorText}>Алдаа гарлаа: {String((feedbackQuery.error as any)?.message ?? feedbackQuery.error)}</Text>
            ) : (
              <>
                {(feedbackQuery.data || []).map((f) => (
                  <TouchableOpacity key={f.id} style={styles.card} activeOpacity={0.85} onPress={() => openFeedbackDetail(f)}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{f.name || "Нэргүй"}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <MessageSquare size={16} color="#666" />
                        <Text style={{ color: "#999", fontSize: 12 }}>{new Date(f.created_at).toLocaleString()}</Text>
                      </View>
                    </View>
  
                    <Text style={styles.cardInfo}>📱 {f.phone || "-"}</Text>
                    {!!f.platform && (
                      <Text style={styles.cardInfo}>
                        🧾 {f.platform}
                        {f.app_version ? ` • v${f.app_version}` : ""}
                      </Text>
                    )}
                    <Text style={[styles.cardInfo, { marginTop: 10, color: "#111" }]} numberOfLines={4}>
                      {f.message}
                    </Text>
                  </TouchableOpacity>
                ))}
                {(feedbackQuery.data || []).length === 0 && <Text style={styles.emptyText}>Feedback байхгүй байна</Text>}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* ===== Detail modal (User) ===== */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setDetailModalVisible(false);
          setSelectedUser(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Хэрэглэгчийн мэдээлэл</Text>
              <TouchableOpacity
                onPress={() => {
                  setDetailModalVisible(false);
                  setSelectedUser(null);
                }}
              >
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailContent}>
              {selectedUser && (
                <View>
                  <Text style={styles.detailLabel}>Нэр:</Text>
                  <Text style={styles.detailValue}>{selectedUser.name || "Нэргүй"}</Text>

                  <Text style={styles.detailLabel}>Утас:</Text>
                  <Text style={styles.detailValue}>{selectedUser.phone || "-"}</Text>

                  <Text style={styles.detailLabel}>Admin:</Text>
                  <Text style={styles.detailValue}>{selectedUser.is_super_admin ? "Тийм" : "Үгүй"}</Text>

                  <Text style={styles.detailLabel}>Sponsored (NOW):</Text>
                  <Text style={styles.detailValue}>{isNowSponsored(selectedUser) ? "Тийм" : "Үгүй"}</Text>

                   <Text style={styles.detailLabel}>Түр түгжээ:</Text>
                   <Text style={styles.detailValue}>{isUserSuspended(selectedUser) ? `Тийм · ${new Date(selectedUser.suspended_until as string).toLocaleString()}` : "Үгүй"}</Text>

                  {!selectedUser.is_super_admin && (
                    <View style={styles.detailActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.editButton]}
                        onPress={() => {
                          setDetailModalVisible(false);
                          openUserSponsorModal(selectedUser);
                          setSelectedUser(null);
                        }}
                      >
                        <Edit2 size={16} color="#fff" />
                        <Text style={styles.actionButtonText}>Sponsored хугацаа тохируулах</Text>
                      </TouchableOpacity>

                      {isNowSponsored(selectedUser) && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.unsponsorButton]}
                          onPress={() => {
                            clearSponsorMutation.mutate(selectedUser);
                            setDetailModalVisible(false);
                            setSelectedUser(null);
                          }}
                        >
                          <Text style={styles.actionButtonText}>Sponsored цуцлах</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity style={[styles.actionButton, isUserSuspended(selectedUser) ? styles.unlockButton : styles.suspendButton]} onPress={() => handleAccountSuspension(selectedUser)}>
                        {isUserSuspended(selectedUser) ? <UnlockKeyhole size={16} color="#fff" /> : <LockKeyhole size={16} color="#fff" />}
                        <Text style={styles.actionButtonText}>{isUserSuspended(selectedUser) ? "Түгжээ тайлах" : "7 хоног түгжих"}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDeleteUser(selectedUser)}>
                        <Trash2 size={16} color="#fff" />
                        <Text style={styles.actionButtonText}>Устгах</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== Category modal ===== */}
      <Modal visible={categoryModalVisible} transparent animationType="slide" onRequestClose={() => setCategoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Категори солих</Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.categoryList}>
              {(JOB_CATEGORIES ?? []).map((category: string) => (
                <TouchableOpacity
                  key={category}
                  style={[styles.categoryItem, selectedCategory === category && styles.selectedCategoryItem]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[styles.categoryItemText, selectedCategory === category && styles.selectedCategoryItemText]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveCategory} disabled={updateCategoryMutation.isPending}>
              {updateCategoryMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Хадгалах</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== User Sponsored Modal ===== */}
      <Modal
        visible={sponsorUserModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSponsorUserModalVisible(false);
          setEditingUser(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>User Sponsored тохиргоо</Text>
              <TouchableOpacity
                onPress={() => {
                  setSponsorUserModalVisible(false);
                  setEditingUser(null);
                }}
              >
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20, gap: 16 }}>
              <DateRow label="Эхлэх огноо" value={userFrom} placeholder="Огноо сонгох" onPick={(d) => setUserFrom(d)} />
              <DateRow label="Дуусах огноо" value={userUntil} placeholder="Огноо сонгох" onPick={(d) => setUserUntil(d)} />

              <TouchableOpacity
                style={[styles.saveButton, { margin: 0 }]}
                onPress={() => {
                  if (!editingUser) return;
                  const fixedFrom = userFrom ? startOfDay(userFrom) : null;
                  const fixedUntil = userUntil ? endOfDay(userUntil) : null;
                  if (fixedFrom && fixedUntil && fixedUntil.getTime() < fixedFrom.getTime()) {
                    Alert.alert("Алдаа", "Дуусах огноо нь эхлэх огнооноос хойш байх ёстой.");
                    return;
                  }

                  saveUserSponsorMutation.mutate({ userId: editingUser.id, from: fixedFrom, until: fixedUntil });
                  setSponsorUserModalVisible(false);
                  setEditingUser(null);
                }}
                disabled={saveUserSponsorMutation.isPending}
              >
                {saveUserSponsorMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Хадгалах</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.unsponsorButton, { marginTop: 0 }]}
                onPress={() => {
                  if (!editingUser) return;
                  clearSponsorMutation.mutate(editingUser);
                  setSponsorUserModalVisible(false);
                  setEditingUser(null);
                }}
                disabled={clearSponsorMutation.isPending}
              >
                <Text style={styles.actionButtonText}>Цэвэрлэх (null болгох)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== Job Sponsored Until Modal ===== */}
      <Modal
        visible={sponsorJobModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSponsorJobModalVisible(false);
          setEditingJob(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Job Sponsored until</Text>
              <TouchableOpacity
                onPress={() => {
                  setSponsorJobModalVisible(false);
                  setEditingJob(null);
                }}
              >
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20, gap: 16 }}>
              <DateRow label="Дуусах огноо" value={jobUntil} placeholder="Огноо сонгох" onPick={(d) => setJobUntil(d)} />

              <TouchableOpacity
                style={[styles.saveButton, { margin: 0 }]}
                onPress={() => {
                  if (!editingJob) return;
                  const untilVal = jobUntil ? endOfDay(jobUntil) : null;
                  sponsorJobMutation.mutate({ jobId: editingJob.id, until: untilVal });

                  setSponsorJobModalVisible(false);
                  setEditingJob(null);
                }}
                disabled={sponsorJobMutation.isPending}
              >
                {sponsorJobMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Хадгалах</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.unsponsorButton, { marginTop: 0 }]}
                onPress={() => {
                  if (!editingJob) return;
                  sponsorJobMutation.mutate({ jobId: editingJob.id, until: null });
                  setSponsorJobModalVisible(false);
                  setEditingJob(null);
                }}
                disabled={sponsorJobMutation.isPending}
              >
                <Text style={styles.actionButtonText}>Sponsored цуцлах</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== Feedback detail modal ===== */}
      <Modal
        visible={feedbackDetailVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setFeedbackDetailVisible(false);
          setSelectedFeedback(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Feedback</Text>
              <TouchableOpacity
                onPress={() => {
                  setFeedbackDetailVisible(false);
                  setSelectedFeedback(null);
                }}
              >
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailContent}>
              {selectedFeedback && (
                <View>
                  <Text style={styles.detailLabel}>Нэр:</Text>
                  <Text style={styles.detailValue}>{selectedFeedback.name || "Нэргүй"}</Text>

                  <Text style={styles.detailLabel}>Утас:</Text>
                  <Text style={styles.detailValue}>{selectedFeedback.phone || "-"}</Text>

                  <Text style={styles.detailLabel}>Огноо:</Text>
                  <Text style={styles.detailValue}>{new Date(selectedFeedback.created_at).toLocaleString()}</Text>

                  <Text style={styles.detailLabel}>Төхөөрөмж:</Text>
                  <Text style={styles.detailValue}>
                    {(selectedFeedback.platform || "-")}{selectedFeedback.app_version ? ` • v${selectedFeedback.app_version}` : ""}
                  </Text>

                  <Text style={styles.detailLabel}>Мессеж:</Text>
                  <Text style={[styles.detailValue, { lineHeight: 24 }]}>{selectedFeedback.message}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  loginContainer: { flex: 1, justifyContent: "center", padding: 20 },
  loginTitle: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    color: "#1a1a1a",
  },
  loginSubtitle: { fontSize: 16, textAlign: "center", marginBottom: 32, color: "#666" },
  loginButton: { backgroundColor: "#007AFF", padding: 16, borderRadius: 12, alignItems: "center" },
  loginButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: { borderBottomColor: "#007AFF" },
  tabText: { fontSize: 12, color: "#666", textAlign: "center" },
  activeTabText: { color: "#007AFF", fontWeight: "600" },

  content: { flex: 1, padding: 16 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", flex: 1 },
  cardInfo: { fontSize: 14, color: "#666", marginTop: 4 },

  sponsoredBadge: { backgroundColor: "#FFF3CD", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  sponsoredText: { fontSize: 12 },
  adminBadge: { backgroundColor: "#E3F2FD", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  adminBadgeText: { fontSize: 12, color: "#1976D2", fontWeight: "600" },

  loader: { marginTop: 32 },
  errorText: { fontSize: 14, color: "#FF3B30", textAlign: "center", marginTop: 32 },
  emptyText: { fontSize: 14, color: "#999", textAlign: "center", marginTop: 32 },

  refreshButton: { padding: 8, marginRight: 8 },
  badgeContainer: { flexDirection: "row", gap: 8 },

  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  sponsorButton: { backgroundColor: "#FFB800" },
  unsponsorButton: { backgroundColor: "#999" },
  suspendButton: { backgroundColor: "#D64545" },
  unlockButton: { backgroundColor: "#0A9B61" },
  suspendedText: { color: "#D64545", fontSize: 12, fontWeight: "700", marginTop: 6 },
  editButton: { backgroundColor: "#007AFF" },
  deleteButton: { backgroundColor: "#FF3B30" },
  actionButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: { fontSize: 18, fontWeight: "600", color: "#1a1a1a" },

  categoryList: { maxHeight: 400 },
  categoryItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  selectedCategoryItem: { backgroundColor: "#E3F2FD" },
  categoryItemText: { fontSize: 15, color: "#333" },
  selectedCategoryItemText: { color: "#007AFF", fontWeight: "600" },

  saveButton: {
    backgroundColor: "#007AFF",
    margin: 20,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  masterSearchContainer: { backgroundColor: "#fff", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  searchInputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#f5f5f5", borderRadius: 10, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  masterSearchInput: { flex: 1, paddingVertical: 10, fontSize: 16, color: "#1a1a1a" },
  clearButton: { padding: 4 },

  searchOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  searchBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.5)" },
  searchResultsContainer: {
    position: "absolute",
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchResults: { maxHeight: 500 },
  searchSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#f9f9f9",
  },
  searchResultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  searchResultContent: { flex: 1 },
  searchResultTitle: { fontSize: 16, fontWeight: "600", color: "#1a1a1a", marginBottom: 4 },
  searchResultSubtitle: { fontSize: 14, color: "#666" },
  searchResultBadges: { flexDirection: "row", gap: 4 },
  searchBadge: { fontSize: 18 },
  noResultsText: { fontSize: 14, color: "#999", textAlign: "center", padding: 32 },

  detailContent: { padding: 20 },
  detailLabel: { fontSize: 12, fontWeight: "600", color: "#999", marginTop: 16, marginBottom: 4, textTransform: "uppercase" },
  detailValue: { fontSize: 16, color: "#1a1a1a" },
  detailActions: { marginTop: 24, gap: 12 },
  seasonalShortcut: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 12, minHeight: 64, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  seasonalShortcutTextWrap: { flex: 1, gap: 2 },
  seasonalShortcutTitle: { fontSize: 16, fontWeight: "800" },
  seasonalShortcutDescription: { fontSize: 13 },
});