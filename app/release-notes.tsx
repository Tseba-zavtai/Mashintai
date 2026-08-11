import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, Clock3, PackageOpen, RefreshCw, Wrench } from "lucide-react-native";
import Constants from "expo-constants";
import AppHeader from "@/components/AppHeader";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";

type ReleaseStatus = "released" | "in_progress" | "planned";
type ReleaseNote = {
  id: string;
  version: string | null;
  title: string;
  description: string;
  status: ReleaseStatus;
  released_at: string | null;
  sort_order: number;
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("mn-MN", { year: "numeric", month: "long", day: "numeric" });
}

export default function ReleaseNotesScreen() {
  const { colors } = useTheme();
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("app_release_notes")
      .select("id,version,title,description,status,released_at,sort_order")
      .eq("is_visible", true)
      .order("sort_order", { ascending: false })
      .order("released_at", { ascending: false, nullsFirst: false });

    if (queryError) throw queryError;
    setNotes((data ?? []) as ReleaseNote[]);
    setError(null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadNotes();
      } catch (loadError) {
        console.log("RELEASE NOTES LOAD ERROR:", loadError);
        setError("Шинэчлэлийн мэдээллийг одоогоор татаж чадсангүй.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadNotes]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadNotes();
    } catch (loadError) {
      console.log("RELEASE NOTES REFRESH ERROR:", loadError);
      setError("Шинэчлэлийн мэдээллийг одоогоор татаж чадсангүй.");
    } finally {
      setRefreshing(false);
    }
  }, [loadNotes]);

  const groups = useMemo(() => ({
    released: notes.filter((note) => note.status === "released"),
    inProgress: notes.filter((note) => note.status === "in_progress"),
    planned: notes.filter((note) => note.status === "planned"),
  }), [notes]);

  const renderNote = (note: ReleaseNote, status: ReleaseStatus) => {
    const icon = status === "released"
      ? <CheckCircle2 size={19} color="#16A34A" />
      : status === "in_progress"
        ? <Wrench size={19} color="#D97706" />
        : <Clock3 size={19} color={colors.primary} />;
    const date = formatDate(note.released_at);

    return (
      <View key={note.id} style={[styles.noteCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.noteHeader}>
          <View style={[styles.noteIcon, { backgroundColor: colors.backgroundSecondary }]}>{icon}</View>
          <View style={styles.noteMeta}>
            <Text style={[styles.noteTitle, { color: colors.text }]}>{note.title}</Text>
            {(note.version || date) ? (
              <Text style={[styles.noteCaption, { color: colors.textSecondary }]}>
                {[note.version ? `v${note.version}` : null, date].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
          </View>
        </View>
        <Text style={[styles.noteDescription, { color: colors.textSecondary }]}>{note.description}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["bottom"]}>
      <AppHeader title="Шинэчлэл" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={[styles.versionCard, { backgroundColor: colors.primary }]}>
          <PackageOpen size={26} color={colors.buttonText} />
          <View style={styles.versionTextWrap}>
            <Text style={[styles.versionLabel, { color: colors.buttonText }]}>Таны ашиглаж буй хувилбар</Text>
            <Text style={[styles.versionText, { color: colors.buttonText }]}>v{appVersion}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.muted, { color: colors.textSecondary }]}>Шинэчлэлийн мэдээлэл уншиж байна...</Text>
          </View>
        ) : error && notes.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Мэдээлэл татагдсангүй</Text>
            <Text style={[styles.muted, { color: colors.textSecondary }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={onRefresh}>
              <RefreshCw size={16} color={colors.buttonText} />
              <Text style={[styles.retryText, { color: colors.buttonText }]}>Дахин оролдох</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Шинэчлэлийн түүх</Text>
            {groups.released.length ? groups.released.map((note) => renderNote(note, "released")) : (
              <View style={[styles.emptyCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.muted, { color: colors.textSecondary }]}>Шинэчлэлийн мэдээлэл удахгүй нэмэгдэнэ.</Text>
              </View>
            )}

            {groups.inProgress.length > 0 ? <Text style={[styles.sectionTitle, { color: colors.text }]}>Хийгдэж байна</Text> : null}
            {groups.inProgress.map((note) => renderNote(note, "in_progress"))}

            {groups.planned.length > 0 ? <Text style={[styles.sectionTitle, { color: colors.text }]}>Удахгүй</Text> : null}
            {groups.planned.map((note) => renderNote(note, "planned"))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 42 },
  versionCard: { borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 28 },
  versionTextWrap: { flex: 1 },
  versionLabel: { fontSize: 13, fontWeight: "600", opacity: 0.9 },
  versionText: { marginTop: 3, fontSize: 24, fontWeight: "900" },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12, marginTop: 4 },
  noteCard: { borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 12 },
  noteHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  noteIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  noteMeta: { flex: 1 },
  noteTitle: { fontSize: 15, fontWeight: "800" },
  noteCaption: { marginTop: 3, fontSize: 12, fontWeight: "600" },
  noteDescription: { marginTop: 13, fontSize: 14, lineHeight: 21 },
  centerBox: { paddingVertical: 70, alignItems: "center", gap: 11 },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: 18, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  muted: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  retryButton: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 10 },
  retryText: { fontSize: 14, fontWeight: "800" },
});
