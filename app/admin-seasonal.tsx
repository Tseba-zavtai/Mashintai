import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays, Check, ChevronLeft, Clock3, Edit3, Eye, EyeOff, Plus, Trash2 } from "lucide-react-native";

import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getCategoryCatalogImmediately,
  isBundledCategoryId,
  refreshCategoryCatalog,
  type CatalogCategory,
} from "@/lib/categoryCatalog";
import { supabase } from "@/lib/supabase";
import { normalizeSeasonalIconKey, SeasonalIcon, SEASONAL_ICON_OPTIONS, type SeasonalIconKey } from "@/lib/seasonalIcons";

type RuleRow = {
  id: string;
  category_id: string | null;
  subcategory_id: string | null;
};

type SeasonalRow = {
  id: string;
  title: string;
  subtitle: string | null;
  starts_at: string;
  ends_at: string;
  sort_order: number;
  icon_key: SeasonalIconKey;
  is_visible: boolean;
  seasonal_collection_rules?: RuleRow[] | null;
};

type PickerMode = "date" | "time" | null;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(value);
}

function formatRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Огноо тодорхойгүй";
  return `${formatDate(start)} ${formatTime(start)} – ${formatDate(end)} ${formatTime(end)}`;
}

function DateTimeField({ label, value, onChange, colors }: { label: string; value: Date; onChange: (next: Date) => void; colors: any }) {
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);

  const onPickerChange = (_event: unknown, date?: Date) => {
    if (Platform.OS === "android") setPickerMode(null);
    if (date) onChange(date);
  };

  return (
    <View style={styles.dateField}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.dateButtons}>
        <TouchableOpacity
          style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setPickerMode("date")}
          activeOpacity={0.8}
        >
          <CalendarDays size={17} color={colors.buttonText} />
          <Text style={[styles.dateButtonText, { color: colors.text }]}>{formatDate(value)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setPickerMode("time")}
          activeOpacity={0.8}
        >
          <Clock3 size={17} color={colors.buttonText} />
          <Text style={[styles.dateButtonText, { color: colors.text }]}>{formatTime(value)}</Text>
        </TouchableOpacity>
      </View>
      {pickerMode && (
        <DateTimePicker
          value={value}
          mode={pickerMode}
          display={Platform.OS === "ios" ? "compact" : "default"}
          onChange={onPickerChange}
        />
      )}
    </View>
  );
}

export default function AdminSeasonalScreen() {
  const { colors } = useTheme();
  const { isSuperAdmin, isAdminUnlocked } = useAuth() as any;
  const hasAdminAccess = Boolean(isSuperAdmin && isAdminUnlocked);

  const [categories, setCategories] = useState<CatalogCategory[]>(() => getCategoryCatalogImmediately().categories);
  const [collections, setCollections] = useState<SeasonalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState("");
  const [editorVisible, setEditorVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [iconKey, setIconKey] = useState<SeasonalIconKey>("sparkles");
  const [startsAt, setStartsAt] = useState(() => new Date());
  const [endsAt, setEndsAt] = useState(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [isVisible, setIsVisible] = useState(true);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setScreenError("");

    try {
      const catalog = await refreshCategoryCatalog();
      setCategories(catalog.categories);

      const { data, error } = await supabase
        .from("seasonal_collections")
        .select("id,title,subtitle,starts_at,ends_at,sort_order,icon_key,is_visible,seasonal_collection_rules(id,category_id,subcategory_id)")
        .order("starts_at", { ascending: false });

      if (error) throw error;
      setCollections((data ?? []) as SeasonalRow[]);
    } catch (error: any) {
      console.log("seasonal admin load failed", error);
      setScreenError(error?.message || "Seasonal тохиргоог татаж чадсангүй.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAdminAccess) void loadData();
  }, [hasAdminAccess, loadData]);

  const databaseCategories = useMemo(
    () => categories.filter((category) => !isBundledCategoryId(category.id)),
    [categories],
  );

  const selectedRuleCount = selectedCategoryIds.length + selectedSubcategoryIds.length;

  const resetEditor = useCallback(() => {
    setEditingId(null);
    setTitle("");
    setSubtitle("");
    setIconKey("sparkles");
    setStartsAt(new Date());
    setEndsAt(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setIsVisible(true);
    setSelectedCategoryIds([]);
    setSelectedSubcategoryIds([]);
  }, []);

  const openNewEditor = () => {
    resetEditor();
    setEditorVisible(true);
  };

  const openEditEditor = (collection: SeasonalRow) => {
    const rules = Array.isArray(collection.seasonal_collection_rules) ? collection.seasonal_collection_rules : [];
    setEditingId(collection.id);
    setTitle(collection.title ?? "");
    setSubtitle(collection.subtitle ?? "");
    setIconKey(normalizeSeasonalIconKey(collection.icon_key));
    setStartsAt(new Date(collection.starts_at));
    setEndsAt(new Date(collection.ends_at));
    setIsVisible(collection.is_visible !== false);
    setSelectedCategoryIds(
      rules
        .filter((rule) => !!rule.category_id && !rule.subcategory_id)
        .map((rule) => rule.category_id as string),
    );
    setSelectedSubcategoryIds(
      rules
        .filter((rule) => !!rule.subcategory_id)
        .map((rule) => rule.subcategory_id as string),
    );
    setEditorVisible(true);
  };

  const toggleCategory = (category: CatalogCategory) => {
    const selected = selectedCategoryIds.includes(category.id);
    if (selected) {
      setSelectedCategoryIds((previous) => previous.filter((id) => id !== category.id));
      return;
    }

    setSelectedCategoryIds((previous) => [...previous, category.id]);
    setSelectedSubcategoryIds((previous) => previous.filter((id) => !category.subcategories.some((subcategory) => subcategory.id === id)));
  };

  const toggleSubcategory = (category: CatalogCategory, subcategoryId: string) => {
    if (selectedCategoryIds.includes(category.id)) return;
    setSelectedSubcategoryIds((previous) => (
      previous.includes(subcategoryId)
        ? previous.filter((id) => id !== subcategoryId)
        : [...previous, subcategoryId]
    ));
  };

  const saveCollection = async () => {
    const normalizedTitle = title.trim();
    if (normalizedTitle.length < 2) {
      Alert.alert("Гарчиг дутуу", "Seasonal-ийн гарчгийг оруулна уу.");
      return;
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      Alert.alert("Хугацаа буруу", "Дуусах огноо, цаг нь эхлэх хугацаанаас хойш байх ёстой.");
      return;
    }
    if (!selectedRuleCount) {
      Alert.alert("Ангилал сонгоно уу", "Дор хаяж нэг үндсэн category эсвэл subcategory сонгоно уу.");
      return;
    }
    if (!databaseCategories.length) {
      Alert.alert("Категори уншигдаагүй", "Server-ээс category татагдсаны дараа дахин хадгална уу.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: normalizedTitle,
        subtitle: subtitle.trim() || null,
        icon_key: iconKey,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        is_visible: isVisible,
      };

      let collectionId = editingId;
      if (collectionId) {
        const { error } = await supabase.from("seasonal_collections").update(payload).eq("id", collectionId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("seasonal_collections")
          .insert({ ...payload, sort_order: 0 })
          .select("id")
          .single();
        if (error || !data?.id) throw error || new Error("Seasonal үүсгэж чадсангүй.");
        collectionId = data.id;
      }

      const { error: deleteRulesError } = await supabase
        .from("seasonal_collection_rules")
        .delete()
        .eq("collection_id", collectionId);
      if (deleteRulesError) throw deleteRulesError;

      const categoryBySubcategory = new Map<string, string>();
      databaseCategories.forEach((category) => {
        category.subcategories.forEach((subcategory) => categoryBySubcategory.set(subcategory.id, category.id));
      });

      const rules = [
        ...selectedCategoryIds.map((categoryId) => ({ collection_id: collectionId, category_id: categoryId, subcategory_id: null })),
        ...selectedSubcategoryIds
          .map((subcategoryId) => ({
            collection_id: collectionId,
            category_id: categoryBySubcategory.get(subcategoryId) ?? null,
            subcategory_id: subcategoryId,
          }))
          .filter((rule) => !!rule.category_id),
      ];

      if (!rules.length) throw new Error("Сонгосон category server-ийн жагсаалттай таарсангүй.");
      const { error: insertRulesError } = await supabase.from("seasonal_collection_rules").insert(rules);
      if (insertRulesError) throw insertRulesError;

      setEditorVisible(false);
      resetEditor();
      await loadData();
      Alert.alert("Хадгалагдлаа", "Seasonal тохиргоо амжилттай шинэчлэгдлээ.");
    } catch (error: any) {
      console.log("seasonal admin save failed", error);
      Alert.alert("Хадгалах үед алдаа", error?.message || "Seasonal тохиргоог хадгалж чадсангүй.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCollection = (collection: SeasonalRow) => {
    Alert.alert(
      "Seasonal устгах уу?",
      `“${collection.title}” болон түүнд оруулсан бүх category сонголт устна.`,
      [
        { text: "Болих", style: "cancel" },
        {
          text: "Устгах",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.from("seasonal_collections").delete().eq("id", collection.id);
              if (error) throw error;
              await loadData();
            } catch (error: any) {
              Alert.alert("Устгах үед алдаа", error?.message || "Seasonal устгаж чадсангүй.");
            }
          },
        },
      ],
    );
  };

  if (!hasAdminAccess) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Seasonal удирдах" />
        <View style={styles.accessDenied}>
          <Text style={[styles.accessTitle, { color: colors.text }]}>Хандах эрхгүй</Text>
          <Text style={[styles.accessDescription, { color: colors.textSecondary }]}>Зөвхөн нууц үгээр нээсэн super admin seasonal тохиргоог өөрчилнө.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Seasonal удирдах"
        rightAccessory={
          <TouchableOpacity onPress={() => void loadData()} style={styles.headerAction} accessibilityLabel="Шинэчлэх">
            <CalendarDays size={20} color={colors.headerText} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.introCard, { backgroundColor: colors.accent, borderColor: colors.border }]}> 
          <Text style={[styles.introTitle, { color: colors.text }]}>Хугацаатай онцлох цуглуулга</Text>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>Энд сонгосон зарыг seasonal дотор давхар харуулна. Зарын өөрийн үндсэн ангилал өөрчлөгдөхгүй.</Text>
        </View>

        <TouchableOpacity style={[styles.newButton, { backgroundColor: colors.primary }]} onPress={openNewEditor} activeOpacity={0.82}>
          <Plus size={20} color={colors.buttonText} />
          <Text style={[styles.newButtonText, { color: colors.buttonText }]}>Шинэ seasonal тохируулах</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={colors.buttonText} style={styles.loader} />
        ) : screenError ? (
          <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.error }]}>
            <Text style={[styles.errorTitle, { color: colors.error }]}>Тохиргоо уншигдсангүй</Text>
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>{screenError}</Text>
          </View>
        ) : collections.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Seasonal одоогоор байхгүй</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Шинэ seasonal үүсгэхэд л Home дээр заасан хугацаанд гарч ирнэ.</Text>
          </View>
        ) : (
          collections.map((collection) => {
            const ruleCount = collection.seasonal_collection_rules?.length ?? 0;
            return (
              <View key={collection.id} style={[styles.collectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.collectionHeader}>
                  <View style={styles.collectionTitleWrap}>
                    <Text style={[styles.collectionTitle, { color: colors.text }]}>{collection.title}</Text>
                    {!!collection.subtitle && <Text style={[styles.collectionSubtitle, { color: colors.textSecondary }]}>{collection.subtitle}</Text>}
                  </View>
                  <View style={[styles.visibilityPill, { backgroundColor: collection.is_visible ? "#DCFCE7" : colors.backgroundSecondary }]}>
                    {collection.is_visible ? <Eye size={14} color="#15803D" /> : <EyeOff size={14} color={colors.textSecondary} />}
                    <Text style={[styles.visibilityText, { color: collection.is_visible ? "#15803D" : colors.textSecondary }]}>{collection.is_visible ? "Идэвхтэй" : "Нуусан"}</Text>
                  </View>
                </View>
                <Text style={[styles.collectionMeta, { color: colors.textSecondary }]}>{formatRange(collection.starts_at, collection.ends_at)}</Text>
                <Text style={[styles.collectionMeta, { color: colors.textSecondary }]}>{ruleCount} category / subcategory сонгосон</Text>
                <View style={styles.collectionActions}>
                  <TouchableOpacity style={[styles.editButton, { backgroundColor: colors.accent }]} onPress={() => openEditEditor(collection)}>
                    <Edit3 size={17} color={colors.buttonText} />
                    <Text style={[styles.editButtonText, { color: colors.buttonText }]}>Засах</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton} onPress={() => deleteCollection(collection)}>
                    <Trash2 size={17} color={colors.error} />
                    <Text style={[styles.deleteButtonText, { color: colors.error }]}>Устгах</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={editorVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditorVisible(false)}>
        <SafeAreaView style={[styles.editorScreen, { backgroundColor: colors.background }]}>
          <View style={[styles.editorHeader, { borderBottomColor: colors.border }]}> 
            <TouchableOpacity style={styles.backButton} onPress={() => setEditorVisible(false)}>
              <ChevronLeft size={24} color={colors.text} />
              <Text style={[styles.backButtonText, { color: colors.text }]}>Буцах</Text>
            </TouchableOpacity>
            <Text style={[styles.editorTitle, { color: colors.text }]}>{editingId ? "Seasonal засах" : "Шинэ seasonal"}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Үндсэн мэдээлэл</Text>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Гарчиг</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Жишээ: 10-р сарын хурим, найр"
              placeholderTextColor={colors.textSecondary}
              style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              maxLength={120}
            />
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Тайлбар (заавал биш)</Text>
            <TextInput
              value={subtitle}
              onChangeText={setSubtitle}
              placeholder="Жишээ: Хуримын бэлтгэлд хэрэгтэй бүх зүйл"
              placeholderTextColor={colors.textSecondary}
              style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              maxLength={200}
            />

            <Text style={[styles.fieldLabel, { color: colors.text }]}>Seasonal icon</Text>
            <View style={styles.iconPicker}>
              {SEASONAL_ICON_OPTIONS.map((option) => {
                const selected = iconKey === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.iconOption,
                      {
                        backgroundColor: selected ? colors.primary : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setIconKey(option.key)}
                    activeOpacity={0.8}
                  >
                    <SeasonalIcon iconKey={option.key} size={22} color={selected ? colors.buttonText : colors.primary} />
                    <Text style={[styles.iconOptionText, { color: selected ? colors.buttonText : colors.text }]} numberOfLines={1}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.dateGrid}>
              <DateTimeField label="Эхлэх огноо, цаг" value={startsAt} onChange={setStartsAt} colors={colors} />
              <DateTimeField label="Дуусах огноо, цаг" value={endsAt} onChange={setEndsAt} colors={colors} />
            </View>

            <View style={[styles.visibleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.visibleTextWrap}>
                <Text style={[styles.visibleTitle, { color: colors.text }]}>Home дээр харуулах</Text>
                <Text style={[styles.visibleDescription, { color: colors.textSecondary }]}>Унтраавал тохиргоо хадгалагдана, гэхдээ хэрэглэгчдэд харагдахгүй.</Text>
              </View>
              <Switch value={isVisible} onValueChange={setIsVisible} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.card} />
            </View>

            <View style={styles.categorySectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Category сонгох</Text>
                <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Үндсэн category-г сонговол доторх бүх subcategory автоматаар орно. Зөвхөн subcategory сонговол зөвхөн тэр төрлийн зар гарна.</Text>
              </View>
              <View style={[styles.countPill, { backgroundColor: colors.accent }]}>
                <Text style={[styles.countPillText, { color: colors.buttonText }]}>{selectedRuleCount}</Text>
              </View>
            </View>

            {databaseCategories.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Category server-ээс татагдаж байна. Хэсэг хүлээгээд шинэчлэнэ үү.</Text>
              </View>
            ) : (
              databaseCategories.map((category) => {
                const parentSelected = selectedCategoryIds.includes(category.id);
                const selectedChildren = category.subcategories.filter((subcategory) => selectedSubcategoryIds.includes(subcategory.id)).length;
                return (
                  <View key={category.id} style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: parentSelected ? colors.primary : colors.border }]}>
                    <TouchableOpacity style={[styles.categoryRow, parentSelected && { backgroundColor: colors.accent }]} onPress={() => toggleCategory(category)} activeOpacity={0.8}>
                      <View style={[styles.checkBox, { borderColor: parentSelected ? colors.primary : colors.border, backgroundColor: parentSelected ? colors.primary : colors.card }]}>
                        {parentSelected && <Check size={16} color={colors.buttonText} strokeWidth={3} />}
                      </View>
                      <View style={styles.categoryNameWrap}>
                        <Text style={[styles.categoryName, { color: colors.text }]}>{category.name}</Text>
                        <Text style={[styles.categoryDescription, { color: colors.textSecondary }]}>{parentSelected ? "Бүх дэд category сонгогдсон" : selectedChildren ? `${selectedChildren} дэд category сонгогдсон` : "Бүгдийг нь seasonal-д оруулах"}</Text>
                      </View>
                    </TouchableOpacity>

                    {category.subcategories.map((subcategory) => {
                      const selected = parentSelected || selectedSubcategoryIds.includes(subcategory.id);
                      return (
                        <TouchableOpacity
                          key={subcategory.id}
                          style={[styles.subcategoryRow, parentSelected && styles.disabledSubcategory]}
                          onPress={() => toggleSubcategory(category, subcategory.id)}
                          activeOpacity={parentSelected ? 1 : 0.75}
                        >
                          <View style={[styles.smallCheckBox, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card }]}>
                            {selected && <Check size={13} color={colors.buttonText} strokeWidth={3} />}
                          </View>
                          <Text style={[styles.subcategoryName, { color: parentSelected ? colors.textSecondary : colors.text }]}>{subcategory.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })
            )}

            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.65 : 1 }]} onPress={() => void saveCollection()} disabled={saving} activeOpacity={0.84}>
              {saving ? <ActivityIndicator color={colors.buttonText} /> : <Text style={[styles.saveButtonText, { color: colors.buttonText }]}>Хадгалах</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  headerAction: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  introCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 6 },
  introTitle: { fontSize: 17, fontWeight: "800" },
  introText: { fontSize: 14, lineHeight: 20 },
  newButton: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  newButtonText: { fontSize: 16, fontWeight: "800" },
  loader: { marginTop: 36 },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  emptyText: { fontSize: 14, lineHeight: 20 },
  errorCard: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 6 },
  errorTitle: { fontSize: 16, fontWeight: "800" },
  errorText: { fontSize: 14, lineHeight: 20 },
  collectionCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  collectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  collectionTitleWrap: { flex: 1, gap: 4 },
  collectionTitle: { fontSize: 17, fontWeight: "800" },
  collectionSubtitle: { fontSize: 13, lineHeight: 18 },
  visibilityPill: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", gap: 4, alignItems: "center" },
  visibilityText: { fontSize: 12, fontWeight: "800" },
  collectionMeta: { fontSize: 13, lineHeight: 18 },
  collectionActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  editButton: { borderRadius: 10, minHeight: 40, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 },
  editButtonText: { fontSize: 14, fontWeight: "800" },
  deleteButton: { borderRadius: 10, minHeight: 40, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  deleteButtonText: { fontSize: 14, fontWeight: "800" },
  accessDenied: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 8 },
  accessTitle: { fontSize: 20, fontWeight: "800" },
  accessDescription: { textAlign: "center", lineHeight: 21 },
  editorScreen: { flex: 1 },
  editorHeader: { minHeight: 56, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { minWidth: 76, flexDirection: "row", alignItems: "center", gap: 1, paddingVertical: 8 },
  backButtonText: { fontSize: 15, fontWeight: "700" },
  editorTitle: { fontSize: 17, fontWeight: "800" },
  headerSpacer: { minWidth: 76 },
  editorContent: { padding: 16, gap: 12, paddingBottom: 42 },
  sectionTitle: { fontSize: 19, fontWeight: "800", marginTop: 4 },
  sectionHint: { fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: "88%" },
  fieldLabel: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  textInput: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  dateGrid: { gap: 8, marginTop: 4 },
  dateField: { gap: 8 },
  dateButtons: { flexDirection: "row", gap: 8 },
  dateButton: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  dateButtonText: { fontSize: 14, fontWeight: "700" },
  iconPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconOption: { width: "23.4%", minHeight: 68, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 3, paddingVertical: 8 },
  iconOptionText: { fontSize: 11, fontWeight: "700" },
  visibleRow: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  visibleTextWrap: { flex: 1, gap: 3 },
  visibleTitle: { fontSize: 15, fontWeight: "800" },
  visibleDescription: { fontSize: 12, lineHeight: 17 },
  categorySectionHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 8 },
  countPill: { minWidth: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, marginTop: 6 },
  countPillText: { fontSize: 14, fontWeight: "900" },
  categoryCard: { borderWidth: 1, borderRadius: 14, overflow: "hidden", marginTop: 2 },
  categoryRow: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  checkBox: { width: 25, height: 25, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  smallCheckBox: { width: 21, height: 21, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  categoryNameWrap: { flex: 1, gap: 2 },
  categoryName: { fontSize: 16, fontWeight: "800" },
  categoryDescription: { fontSize: 12, lineHeight: 17 },
  subcategoryRow: { minHeight: 44, paddingLeft: 52, paddingRight: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  disabledSubcategory: { opacity: 0.58 },
  subcategoryName: { fontSize: 14, flex: 1 },
  saveButton: { minHeight: 54, marginTop: 12, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  saveButtonText: { fontSize: 16, fontWeight: "900" },
});
