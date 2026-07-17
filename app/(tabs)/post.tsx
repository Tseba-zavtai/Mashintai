import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useJobs } from "@/contexts/JobsContext";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import BannerCarousel from "@/components/BannerCarousel";
import { fetchBanners } from "@/lib/banners";
import AppHeader from "@/components/AppHeader"; 

import { searchMatch } from "@/lib/searchUtils";

const MapView = Platform.OS !== "web" ? require("react-native-maps").default : null;
const Marker = Platform.OS !== "web" ? require("react-native-maps").Marker : null;
const PROVIDER_GOOGLE = Platform.OS !== "web" ? require("react-native-maps").PROVIDER_GOOGLE : null;

type PickedLocation = { latitude: number; longitude: number; address?: string; };
type PickedImage = { uri: string; name: string; mimeType: string; };

type LocalSubcategory = { id: string; name: string; icon?: string | null; };
type LocalCategory = { id: string; name: string; icon?: string | null; form_schema?: any[]; subcategories: LocalSubcategory[]; };
type PriceType = "hourly" | "daily" | "monthly";

const PRICE_TYPES: { value: PriceType; label: string }[] = [
  { value: "hourly", label: "Цагийн" },
  { value: "daily", label: "Өдрийн" },
  { value: "monthly", label: "Сарын" },
];
function isClothingCategory(name?: string | null) {
  const normalized = (name ?? "").toLocaleLowerCase().replace(/[\s,]/g, "");
  return normalized.startsWith("хувцасхэрэг");
}

const MAX_IMAGES = 5;
const STORAGE_BUCKET = "post-images";
const IMAGE_MAX_WIDTH = 1000; 
const IMAGE_COMPRESS_QUALITY = 0.4; 

async function compressPickedImage(asset: any, index: number): Promise<PickedImage> {
  const width = Number(asset?.width ?? 0);
  const actions = width > IMAGE_MAX_WIDTH ? [{ resize: { width: IMAGE_MAX_WIDTH } }] : [];
  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    actions,
    { compress: IMAGE_COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );
  return {
    uri: manipulated.uri,
    name: `listing-image-${Date.now()}-${index}.jpg`,
    mimeType: "image/jpeg",
  };
}

function getFileExtension(uri: string, mimeType?: string) {
  const uriMatch = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (uriMatch?.[1]) return uriMatch[1].toLowerCase();
  if (mimeType?.includes("png")) return "png";
  if (mimeType?.includes("webp")) return "webp";
  if (mimeType?.includes("heic")) return "heic";
  return "jpg";
}

function sanitizeFileNamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "");
}

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
    if (encoded3 !== 64 && encoded3 !== -1) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (encoded4 !== 64 && encoded4 !== -1) bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
  }
  return arrayBuffer;
}

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" as any });
  if (!base64) throw new Error("Зураг уншихад алдаа гарлаа");
  return base64ToArrayBuffer(base64);
}

export default function PostScreen() {
  const { addJob } = useJobs();
  const router = useRouter();
  const { isAuthenticated, user, refetchProfile } = useAuth() as any;
  const { colors } = useTheme();

  const postType = "job"; 
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("daily");

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [subcategoryModalVisible, setSubcategoryModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<PickedLocation | null>(null);
  const [pickedImages, setPickedImages] = useState<PickedImage[]>([]);
  const [pickingImages, setPickingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initialRegion, setInitialRegion] = useState({ latitude: 47.9184, longitude: 106.9177, latitudeDelta: 0.02, longitudeDelta: 0.02 });
  const [addBanners, setAddBanners] = useState<any[]>([]);

  const [dynamicData, setDynamicData] = useState<Record<string, any>>({});
  const [dynamicModalVisible, setDynamicModalVisible] = useState(false);
  const [activeDynamicField, setActiveDynamicField] = useState<any>(null);

  const [dbCategories, setDbCategories] = useState<LocalCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const postCredits = (user as any)?.available_post_credits ?? 0;

  const fetchCategoriesFromDB = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const { data, error } = await supabase
        .from('categories')
        .select(`id, name, icon, form_schema, subcategories ( id, name, icon )`)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      
      if (data) {
        let formattedCats: LocalCategory[] = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          form_schema: c.form_schema || [],
          subcategories: Array.isArray(c.subcategories) ? c.subcategories.map((sub: any) => ({
            id: sub.id,
            name: sub.name,
            icon: sub.icon
          })) : []
        }));

        // ӨӨРЧЛӨЛТ 1 & 2: Эрүүл мэндийг Танин мэдэхүй рүү оруулах
        const knowledgeIdx = formattedCats.findIndex(c => c.name.includes("Танин мэдэхүй"));
        const healthIdx = formattedCats.findIndex(c => c.name.includes("Эрүүл мэнд"));

        if (knowledgeIdx !== -1 && healthIdx !== -1) {
            formattedCats[knowledgeIdx].subcategories = [
                ...formattedCats[knowledgeIdx].subcategories,
                ...formattedCats[healthIdx].subcategories
            ];
            formattedCats.splice(healthIdx, 1);
        }

        setDbCategories(formattedCats);
      }
    } catch (err) {
      console.log("Error fetching categories:", err);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => { fetchCategoriesFromDB(); }, [fetchCategoriesFromDB]);

  const loadAddBanners = useCallback(async () => {
    try {
      const banners = await fetchBanners("add_tab", 3);
      setAddBanners(banners ?? []);
    } catch (error) { setAddBanners([]); }
  }, []);

  useEffect(() => { loadAddBanners(); }, [loadAddBanners]);

  const resetForm = useCallback(() => {
    setDescription(""); setQuantity("1"); setPrice(""); setPriceType("daily");
    setCategoryId(null); setSubcategoryId(null); setDynamicData({});
    setCategorySearch(""); setSubcategorySearch(""); setCategoryModalVisible(false); setSubcategoryModalVisible(false);
    setSelectedLocation(null); setPickedImages([]); setSubmitting(false); setPickingImages(false);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const location = await Location.getCurrentPositionAsync({});
        setInitialRegion({ latitude: location.coords.latitude, longitude: location.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });
      } catch (error) { console.log("Location init failed:", error); }
    })();
  }, []);

  useEffect(() => { if (!isAuthenticated) { router.push("/auth"); } }, [isAuthenticated]);

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    try {
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const addressText = address ? `${address.district || address.city || ""}${address.subregion ? `, ${address.subregion}` : ""}`.trim() : undefined;
      setSelectedLocation({ latitude, longitude, address: addressText || undefined });
    } catch {
      setSelectedLocation({ latitude, longitude });
    }
  };

  const selectedCategoryObj = useMemo(() => {
    if (!categoryId) return null;
    return dbCategories.find((item) => item.id === categoryId) ?? null;
  }, [categoryId, dbCategories]);

  const selectedCategoryName = selectedCategoryObj?.name ?? null;

  const selectedSubcategoryObj = useMemo(() => {
    if (!subcategoryId || !selectedCategoryObj?.subcategories?.length) return null;
    return selectedCategoryObj.subcategories.find((item) => item.id === subcategoryId) ?? null;
  }, [selectedCategoryObj, subcategoryId]);

  const selectedSubcategoryName = selectedSubcategoryObj?.name ?? null;

  const visibleCategories = useMemo(() => {
    if (!categorySearch.trim()) return dbCategories;
    return dbCategories.filter((item) => searchMatch(item.name, categorySearch));
  }, [categorySearch, dbCategories]);

  const visibleSubcategories = useMemo(() => {
    const list = selectedCategoryObj?.subcategories ?? [];
    if (!subcategorySearch.trim()) return list;
    return list.filter((item) => searchMatch(item.name, subcategorySearch));
  }, [selectedCategoryObj, subcategorySearch]);

  const removePickedImage = useCallback((uri: string) => {
    setPickedImages((prev) => prev.filter((img) => img.uri !== uri));
  }, []);

  const handlePickImages = useCallback(async () => {
    if (Platform.OS === "web") { Alert.alert("Мэдээлэл", "Зураг сонгох хэсгийг одоогоор апп дээр ашиглана уу"); return; }
    if (pickedImages.length >= MAX_IMAGES) { Alert.alert("Анхаар", `Та хамгийн ихдээ ${MAX_IMAGES} зураг сонгох боломжтой`); return; }
    try {
      setPickingImages(true);
      const ImagePicker = await import("expo-image-picker");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") { Alert.alert("Зөвшөөрөл хэрэгтэй", "Зураг сонгохын тулд gallery access зөвшөөрнө үү"); return; }
      const remaining = MAX_IMAGES - pickedImages.length;
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.85 });
      if (result.canceled) return;
      const nextImages: PickedImage[] = await Promise.all((result.assets ?? []).map((asset, index) => compressPickedImage(asset, index)));
      setPickedImages((prev) => {
        const merged = [...prev];
        for (const item of nextImages) { if (!merged.some((x) => x.uri === item.uri)) merged.push(item); }
        return merged.slice(0, MAX_IMAGES);
      });
    } catch (error) {
      console.log("PICK IMAGES ERROR:", error);
      Alert.alert("Алдаа", "Зураг сонгоход алдаа гарлаа");
    } finally {
      setPickingImages(false);
    }
  }, [pickedImages.length]);

  const uploadImagesToSupabase = useCallback(async (images: PickedImage[]) => {
      if (!images.length) return [];
      const userIdRaw = (user as any)?.id || "anonymous";
      const userId = sanitizeFileNamePart(String(userIdRaw));
      const uploadedPaths: string[] = [];
      const publicUrls: string[] = [];
      try {
        for (let i = 0; i < images.length; i += 1) {
          const image = images[i];
          const ext = getFileExtension(image.uri, image.mimeType);
          const safeExt = sanitizeFileNamePart(ext || "jpg") || "jpg";
          const fileName = `${Date.now()}-${i}.${safeExt}`;
          const filePath = `${userId}/${fileName}`;
          const fileData = await uriToArrayBuffer(image.uri);
          const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, fileData, { contentType: image.mimeType || "image/jpeg", upsert: false });
          if (uploadError) throw uploadError;
          uploadedPaths.push(filePath);
          const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
          if (publicData?.publicUrl) publicUrls.push(publicData.publicUrl);
        }
        return publicUrls;
      } catch (error) {
        for (const path of uploadedPaths) {
          try { await supabase.storage.from(STORAGE_BUCKET).remove([path]); } catch (removeError) { console.log("ROLLBACK STORAGE REMOVE ERROR:", removeError); }
        }
        throw error;
      }
    }, [user]);

  const handleSelectCategory = useCallback((cat: LocalCategory) => {
    setCategoryId(cat.id); setSubcategoryId(null); setDynamicData({}); 
    setCategorySearch(""); setSubcategorySearch(""); setCategoryModalVisible(false);
  }, []);

  const handleSelectSubcategory = useCallback((sub: LocalSubcategory) => {
    setSubcategoryId((prev) => (prev === sub.id ? null : sub.id)); setSubcategorySearch(""); setSubcategoryModalVisible(false);
  }, []);

  const handleSubmit = async () => {
    if (submitting) return;
    if (postCredits <= 0) { Alert.alert("Эрх дууссан", "Таны үнэгүй зар оруулах эрх дууссан байна. Профайл хэсгээс эрхээ цэнэглэнэ үү.", [{ text: "Хаах", style: "cancel" }, { text: "Профайл руу", onPress: () => router.push("/profile") }]); return; }
    if (!description.trim()) { Alert.alert("Алдаа", "Зарын мэдээлэл оруулна уу"); return; }
    if (!selectedCategoryObj) { Alert.alert("Алдаа", "Категори сонгоно уу"); return; }
    const parsedQuantity = Math.max(1, Math.floor(Number(quantity || 1)));
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) { Alert.alert("Алдаа", "Тоо ширхэгийг зөв оруулна уу"); return; }
    const parsedPrice = Number(price.replace(/[^0-9]/g, "")) || 0;
    if (parsedPrice <= 0) { Alert.alert("Алдаа", "Үнийг зөв оруулна уу"); return; }

    const originalCredits = Math.max(0, Number(postCredits));
    const remainingCredits = Math.max(0, originalCredits - 1);
    let creditConsumed = false;
    let jobCreated = false;

    try {
      setSubmitting(true);
      const imageUrls = await uploadImagesToSupabase(pickedImages);
      const { data: creditRows, error: creditError } = await supabase
        .from("profiles")
        .update({ available_post_credits: remainingCredits })
        .eq("id", (user as any)?.id)
        .eq("available_post_credits", originalCredits)
        .select("id");
      if (creditError) throw creditError;
      if (!creditRows?.length) throw new Error("POST_CREDIT_UNAVAILABLE");
      creditConsumed = true;

      await addJob({
          title: selectedSubcategoryObj?.name || selectedCategoryObj.name, description: description.trim(),
          category: selectedCategoryObj.name, subcategory: selectedSubcategoryObj?.name ?? null, category_id: categoryId, subcategory_id: subcategoryId,
          postType, location: selectedLocation || undefined, image_url: imageUrls[0] ?? null, image_urls: imageUrls,
          quantity: parsedQuantity, available_quantity: parsedQuantity, price: parsedPrice, 
          price_type: priceType, dynamic_data: dynamicData 
        } as any,
        { name: user?.name || user?.phone || "Хэрэглэгч", phone: user?.phone || "", photoUri: (user as any)?.photoUri, sponsoredUntil: (user as any)?.sponsoredUntil ?? null }
      );
      jobCreated = true;

      try {
        await refetchProfile?.();
      } catch (profileError) {
        console.log("PROFILE REFRESH ERROR:", profileError);
      }
      Alert.alert("Амжилттай!", "Таны зар амжилттай нэмэгдлээ", [{ text: "OK", onPress: () => { resetForm(); router.replace("/(tabs)"); } }]);
    } catch (error: any) {
      if (creditConsumed && !jobCreated) {
        try {
          const { error: rollbackError } = await supabase
            .from("profiles")
            .update({ available_post_credits: originalCredits })
            .eq("id", (user as any)?.id)
            .eq("available_post_credits", remainingCredits);
          if (rollbackError) console.log("POST CREDIT ROLLBACK ERROR:", rollbackError);
        } catch (rollbackFailure) {
          console.log("POST CREDIT ROLLBACK ERROR:", rollbackFailure);
        }
      }
      console.log("POST JOB ERROR:", error); Alert.alert("Алдаа", error?.message ?? "Зар нэмэхэд алдаа гарлаа");
    } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.container, { backgroundColor: colors.background }]}>
      
      <AppHeader title="Зар нэмэх" showBack={false} />

      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 20 }}>
            Түрээслүүлэх зарын дэлгэрэнгүй мэдээллээ оруулна уу
          </Text>

          <View style={styles.formSection}>
            <Text style={[styles.label, { color: colors.text }]}>Зарын мэдээлэл *</Text>
            <TextInput style={[styles.input, styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} placeholder="Зарын талаар дэлгэрэнгүй бич..." placeholderTextColor={colors.textSecondary} value={description} onChangeText={setDescription} multiline numberOfLines={6} textAlignVertical="top" editable={!submitting} scrollEnabled={false} autoCorrect={false} returnKeyType="default" blurOnSubmit={false} />
          </View>
          
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: colors.text }]}>Үнэ (₮) *</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} placeholder="Жишээ нь: 50000" placeholderTextColor={colors.textSecondary} value={price} onChangeText={(value) => { setPrice(value.replace(/[^0-9]/g, "")); }} keyboardType="number-pad" editable={!submitting} />
            
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {PRICE_TYPES.map(({ value, label }) => {
                const selected = priceType === value;
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setPriceType(value)}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : "transparent"
                    }}
                  >
                    <Text style={{ color: selected ? '#111' : colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.label, { color: colors.text }]}>Тоо ширхэг *</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} placeholder="1" placeholderTextColor={colors.textSecondary} value={quantity} onChangeText={(value) => { setQuantity(value.replace(/[^0-9]/g, "")); }} keyboardType="number-pad" editable={!submitting} selectTextOnFocus={true} />
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>Нэг л ширхэг бараа бол 1 гэж үлдээнэ. Олон ширхэгтэй бол нийт тоогоо оруулна.</Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.imagesHeaderRow}>
              <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Зураг</Text>
              <Text style={[styles.imageCountText, { color: colors.textSecondary }]}>{pickedImages.length}/{MAX_IMAGES}</Text>
            </View>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>Нэг зар дээр хамгийн ихдээ {MAX_IMAGES} зураг оруулж болно</Text>
            <TouchableOpacity style={[styles.imagePickerButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: pickingImages || submitting ? 0.7 : 1 }]} onPress={handlePickImages} activeOpacity={0.8} disabled={pickingImages || submitting}>
              <Text style={[styles.imagePickerButtonText, { color: colors.text }]}>{pickingImages ? "Зураг нээж байна..." : "📷 Зураг сонгох"}</Text>
            </TouchableOpacity>
            {pickedImages.length > 0 ? (
              <View style={styles.imageGrid}>
                {pickedImages.map((img, index) => (
                  <View key={`${img.uri}-${index}`} style={[styles.imageCard, { borderColor: colors.border }]}>
                    <Image source={{ uri: img.uri }} style={styles.previewImage} />
                    <TouchableOpacity style={styles.removeImageButton} onPress={() => removePickedImage(img.uri)} activeOpacity={0.8}><Text style={styles.removeImageButtonText}>✕</Text></TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.emptyImageBox, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.emptyImageText, { color: colors.textSecondary }]}>Одоогоор зураг сонгоогүй байна</Text></View>
            )}
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.label, { color: colors.text }]}>Категори *</Text>
            <Pressable style={({ pressed }) => [styles.selectButton, { backgroundColor: colors.card, borderColor: selectedCategoryObj ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 }]} onPress={() => { setCategorySearch(""); setCategoryModalVisible(true); }} android_ripple={{ color: colors.border }} disabled={submitting || loadingCategories}>
              <View style={styles.selectButtonTextWrap}>
                <Text style={[styles.selectButtonTitle, { color: selectedCategoryName ? colors.text : colors.textSecondary }]} numberOfLines={1}>
                  {loadingCategories ? "Уншиж байна..." : (selectedCategoryName ? `${selectedCategoryObj?.icon || ''} ${selectedCategoryName}` : "Категори сонгох")}
                </Text>
                <Text style={[styles.selectButtonHint, { color: colors.textSecondary }]}>Дарж жагсаалтаас сонгоно</Text>
              </View>
              <Text style={[styles.selectButtonArrow, { color: colors.textSecondary }]}>›</Text>
            </Pressable>
            {selectedCategoryObj ? (
              <View style={styles.subcategoryWrap}>
                <Text style={[styles.label, { color: colors.text }]}>Дэд категори</Text>
                <Pressable style={({ pressed }) => [styles.selectButton, { backgroundColor: colors.card, borderColor: selectedSubcategoryObj ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 }]} onPress={() => { setSubcategorySearch(""); setSubcategoryModalVisible(true); }} android_ripple={{ color: colors.border }} disabled={submitting || (selectedCategoryObj.subcategories?.length ?? 0) === 0}>
                  <View style={styles.selectButtonTextWrap}>
                    <Text style={[styles.selectButtonTitle, { color: selectedSubcategoryName ? colors.text : colors.textSecondary }]} numberOfLines={1}>
                      {selectedSubcategoryName ? `${selectedSubcategoryObj?.icon || ''} ${selectedSubcategoryName}` : "Дэд категори сонгох / алгасах"}
                    </Text>
                    <Text style={[styles.selectButtonHint, { color: colors.textSecondary }]}>Сонгохгүй байж болно</Text>
                  </View>
                  <Text style={[styles.selectButtonArrow, { color: colors.textSecondary }]}>›</Text>
                </Pressable>
                {selectedSubcategoryName ? (<Pressable style={({ pressed }) => [styles.clearSelectionButton, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 }]} onPress={() => setSubcategoryId(null)} disabled={submitting}><Text style={[styles.clearSelectionText, { color: colors.textSecondary }]}>Дэд категори арилгах</Text></Pressable>) : null}
              </View>
            ) : null}
          </View>

          {/* ӨӨРЧЛӨЛТ 3: ХУВЦАС ХЭРЭГСЭЛ дээр ӨНГӨ ОРУУЛАХ */}
          {isClothingCategory(selectedCategoryName) && (
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: colors.text }]}>Өнгө</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} 
                placeholder="Жишээ нь: Хар, Цагаан..." 
                placeholderTextColor={colors.textSecondary} 
                value={dynamicData['Өнгө'] || ""} 
                onChangeText={(val) => setDynamicData(prev => ({...prev, 'Өнгө': val}))} 
                editable={!submitting} 
              />
            </View>
          )}

          {selectedCategoryObj?.form_schema && selectedCategoryObj.form_schema.length > 0 && (
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: colors.text, marginBottom: 16, fontSize: 16 }]}>
                Нэмэлт мэдээлэл (Заавал биш)
              </Text>
              {selectedCategoryObj.form_schema.map((field: any) => (
                <View key={field.name} style={{ marginBottom: 16 }}>
                  <Text style={[styles.label, { color: colors.text }]}>{field.label}</Text>
                  {field.type === 'dropdown' ? (
                    <Pressable style={({ pressed }) => [styles.selectButton, { backgroundColor: colors.card, borderColor: dynamicData[field.name] ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 }]} 
                      onPress={() => { setActiveDynamicField(field); setDynamicModalVisible(true); }}>
                      <Text style={[styles.selectButtonTitle, { color: dynamicData[field.name] ? colors.text : colors.textSecondary }]}>{dynamicData[field.name] || "Сонгох..."}</Text>
                      <Text style={[styles.selectButtonArrow, { color: colors.textSecondary }]}>›</Text>
                    </Pressable>
                  ) : (
                    <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} placeholder={field.label} placeholderTextColor={colors.textSecondary} value={dynamicData[field.name] || ""} onChangeText={(val) => setDynamicData(prev => ({...prev, [field.name]: val}))} keyboardType={field.type === 'number' ? 'number-pad' : 'default'} editable={!submitting} />
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={styles.formSection}>
            <Text style={[styles.label, { color: colors.text }]}>Байршил (заавал биш)</Text>
            {Platform.OS !== "web" && MapView ? (
              <>
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>Газрын зураг дээр дарж байршил сонгоно уу</Text>
                <View style={[styles.mapContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <MapView style={styles.map} provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined} initialRegion={initialRegion} onPress={handleMapPress}>{selectedLocation && (<Marker coordinate={{ latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }} />)}</MapView>
                </View>
                {selectedLocation?.address ? (<Text style={[styles.selectedLocationText, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}>Сонгосон байршил: {selectedLocation.address}</Text>) : null}
              </>
            ) : (<View style={[styles.webLocationNote, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.webLocationNoteText, { color: colors.textSecondary }]}>📍 Газрын зураг нь зөвхөн утсан дээр ажиллана</Text></View>)}
          </View>

          <TouchableOpacity style={[styles.submitButton, { backgroundColor: postCredits <= 0 ? colors.border : colors.primary, opacity: submitting ? 0.75 : 1 }]} onPress={handleSubmit} activeOpacity={0.85} disabled={submitting}>
            {submitting ? (<ActivityIndicator color={colors.headerText} />) : (<Text style={[styles.submitButtonText, { color: postCredits <= 0 ? colors.textSecondary : colors.headerText }]}>{postCredits <= 0 ? "Эрх дууссан" : "Зар нэмэх (1 эрх хасагдана)"}</Text>)}
          </TouchableOpacity>
          {postCredits <= 0 && (<Text style={{ textAlign: "center", color: colors.error, marginTop: 12, fontSize: 13, fontWeight: "600" }}>Таны зар оруулах эрх дууссан байна. Профайл руу орж цэнэглэнэ үү.</Text>)}
          {addBanners.length > 0 ? (<View style={styles.addBannerOuter}><View style={styles.addBannerWrap}><BannerCarousel banners={addBanners} /></View></View>) : null}
          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={categoryModalVisible} animationType="slide" transparent onRequestClose={() => setCategoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCategoryModalVisible(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.text }]}>Категори сонгох</Text><Pressable onPress={() => setCategoryModalVisible(false)} hitSlop={12}><Text style={[styles.modalCloseText, { color: colors.text }]}>✕</Text></Pressable></View>
            <TextInput style={[styles.searchInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} placeholder="Категори хайх..." placeholderTextColor={colors.textSecondary} value={categorySearch} onChangeText={setCategorySearch} editable={!submitting} autoCorrect={false} returnKeyType="search" />
            <FlatList data={visibleCategories} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalListContent} ListEmptyComponent={<Text style={[styles.emptyResultText, { color: colors.textSecondary }]}>Тохирох категори олдсонгүй</Text>} renderItem={({ item }) => {
                const selected = categoryId === item.id;
                return (
                  <Pressable style={({ pressed }) => [styles.modalOption, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 }]} onPress={() => handleSelectCategory(item)} android_ripple={{ color: colors.border }}>
                    <Text style={[styles.modalOptionText, { color: selected ? "#111" : colors.text }]}>
                      {item.icon ? `${item.icon} ` : ''}{item.name}
                    </Text>
                    {selected ? (<Text style={styles.modalSelectedMark}>✓</Text>) : null}
                  </Pressable>
                );
              }} />
          </View>
        </View>
      </Modal>

      <Modal visible={subcategoryModalVisible} animationType="slide" transparent onRequestClose={() => setSubcategoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSubcategoryModalVisible(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.text }]}>Дэд категори сонгох</Text><Pressable onPress={() => setSubcategoryModalVisible(false)} hitSlop={12}><Text style={[styles.modalCloseText, { color: colors.text }]}>✕</Text></Pressable></View>
            <TextInput style={[styles.searchInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} placeholder="Дэд категори хайх..." placeholderTextColor={colors.textSecondary} value={subcategorySearch} onChangeText={setSubcategorySearch} editable={!submitting} autoCorrect={false} returnKeyType="search" />
            <Pressable style={({ pressed }) => [styles.modalOption, { backgroundColor: !subcategoryId ? colors.primary : colors.card, borderColor: !subcategoryId ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 }]} onPress={() => { setSubcategoryId(null); setSubcategorySearch(""); setSubcategoryModalVisible(false); }} android_ripple={{ color: colors.border }}><Text style={[styles.modalOptionText, { color: !subcategoryId ? "#111" : colors.text }]}>Дэд категори сонгохгүй</Text>{!subcategoryId ? (<Text style={styles.modalSelectedMark}>✓</Text>) : null}</Pressable>
            <FlatList data={visibleSubcategories} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalListContent} ListEmptyComponent={<Text style={[styles.emptyResultText, { color: colors.textSecondary }]}>Тохирох дэд категори олдсонгүй</Text>} renderItem={({ item }) => {
                const selected = subcategoryId === item.id;
                return (
                  <Pressable style={({ pressed }) => [styles.modalOption, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 }]} onPress={() => handleSelectSubcategory(item)} android_ripple={{ color: colors.border }}>
                    <Text style={[styles.modalOptionText, { color: selected ? "#111" : colors.text }]}>
                      {item.icon ? `${item.icon} ` : ''}{item.name}
                    </Text>
                    {selected ? (<Text style={styles.modalSelectedMark}>✓</Text>) : null}
                  </Pressable>
                );
              }} />
          </View>
        </View>
      </Modal>

      <Modal visible={dynamicModalVisible} animationType="slide" transparent onRequestClose={() => setDynamicModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDynamicModalVisible(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{activeDynamicField?.label || "Сонгох"}</Text>
              <Pressable onPress={() => setDynamicModalVisible(false)} hitSlop={12}><Text style={[styles.modalCloseText, { color: colors.text }]}>✕</Text></Pressable>
            </View>
            <FlatList data={activeDynamicField?.options || []} keyExtractor={(item) => item} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalListContent} renderItem={({ item }) => {
                const selected = dynamicData[activeDynamicField?.name] === item;
                return (
                  <Pressable style={({ pressed }) => [styles.modalOption, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 }]} onPress={() => {
                      setDynamicData(prev => ({ ...prev, [activeDynamicField.name]: item }));
                      setDynamicModalVisible(false);
                  }} android_ripple={{ color: colors.border }}>
                    <Text style={[styles.modalOptionText, { color: selected ? "#111" : colors.text }]}>{item}</Text>
                    {selected ? (<Text style={styles.modalSelectedMark}>✓</Text>) : null}
                  </Pressable>
                );
              }} />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 24 },
  formSection: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1 },
  textArea: { minHeight: 120, paddingTop: 14 },
  imagesHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  imageCountText: { fontSize: 13, fontWeight: "600" },
  imagePickerButton: { borderWidth: 1, borderStyle: "dashed", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  imagePickerButtonText: { fontSize: 15, fontWeight: "600" },
  emptyImageBox: { marginTop: 12, borderWidth: 1, borderRadius: 12, paddingVertical: 18, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  emptyImageText: { fontSize: 14 },
  imageGrid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  imageCard: { width: "31%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", borderWidth: 1, position: "relative", backgroundColor: "#ddd" },
  previewImage: { width: "100%", height: "100%" },
  removeImageButton: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  removeImageButtonText: { color: "#fff", fontSize: 12, fontWeight: "700", lineHeight: 14 },
  selectButton: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectButtonTextWrap: { flex: 1, paddingRight: 12 },
  selectButtonTitle: { fontSize: 15, fontWeight: "700" },
  selectButtonHint: { marginTop: 3, fontSize: 12 },
  selectButtonArrow: { fontSize: 26, lineHeight: 28, fontWeight: "500" },
  clearSelectionButton: { marginTop: 10, alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  clearSelectionText: { fontSize: 13, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  modalSheet: { maxHeight: "82%", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10, paddingHorizontal: 20, paddingBottom: 24 },
  modalHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: "rgba(150,150,150,0.55)", alignSelf: "center", marginBottom: 12 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: "800" },
  modalCloseText: { fontSize: 20, fontWeight: "700" },
  modalListContent: { paddingBottom: 12, gap: 8 },
  modalOption: { minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalOptionText: { flex: 1, fontSize: 14, fontWeight: "700", paddingRight: 10 },
  modalSelectedMark: { color: "#111", fontSize: 16, fontWeight: "900" },
  searchInput: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1, marginBottom: 12 },
  helperText: { fontSize: 12, marginBottom: 12 },
  emptyResultText: { marginTop: 8, fontSize: 13 },
  subcategoryWrap: { marginTop: 12 },
  mapContainer: { height: 300, borderRadius: 12, overflow: "hidden", borderWidth: 1 },
  map: { width: "100%", height: "100%" },
  selectedLocationText: { marginTop: 12, fontSize: 14, padding: 12, borderRadius: 8, borderWidth: 1 },
  submitButton: { paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4, minHeight: 54, justifyContent: "center" },
  submitButtonText: { fontSize: 16, fontWeight: "700" },
  bottomPadding: { height: 40 },
  addBannerOuter: { marginTop: 16, marginBottom: 6, marginHorizontal: -20 },
  addBannerWrap: { width: "100%" },
  webLocationNote: { padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  webLocationNoteText: { fontSize: 14, textAlign: "center" },
});