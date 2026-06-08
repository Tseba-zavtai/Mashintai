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
import { PostType } from "@/mocks/jobs";
import { useJobs } from "@/contexts/JobsContext";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { getLogoSource } from "@/constants/logo";

import BannerCarousel from "@/components/BannerCarousel";
import { fetchBanners } from "@/lib/banners";

const MapView =
  Platform.OS !== "web" ? require("react-native-maps").default : null;
const Marker =
  Platform.OS !== "web" ? require("react-native-maps").Marker : null;
const PROVIDER_GOOGLE =
  Platform.OS !== "web"
    ? require("react-native-maps").PROVIDER_GOOGLE
    : null;

type PickedLocation = {
  latitude: number;
  longitude: number;
  address?: string;
};

type LocalSubcategory = {
  id: string;
  name: string;
  sort_order: number | null;
};

type LocalCategory = {
  id: string;
  name: string;
  sort_order: number | null;
  subcategories: LocalSubcategory[];
};

type PickedImage = {
  uri: string;
  name: string;
  mimeType: string;
};

const MAX_IMAGES = 5;
const STORAGE_BUCKET = "post-images";

function normalizeForSearch(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яёөү0-9]+/gi, "");
}

function cyrillicToLatin(input: string): string {
  const text = (input ?? "").toLowerCase();

  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "j",
    з: "z",
    и: "i",
    й: "i",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    ө: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ү: "u",
    ф: "f",
    х: "kh",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sh",
    ъ: "",
    ы: "ii",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  let out = "";
  for (const ch of text) out += map[ch] ?? ch;
  return out;
}

function latinToCyrillic(input: string): string {
  let s = (input ?? "").trim().toLowerCase().replace(/\s+/g, " ");

  const rules: Array<[RegExp, string]> = [
    [/sch/g, "щ"],
    [/sh/g, "ш"],
    [/ch/g, "ч"],
    [/ts/g, "ц"],
    [/ya/g, "я"],
    [/yo/g, "ё"],
    [/yu/g, "ю"],
    [/ye/g, "е"],
    [/kh/g, "х"],
  ];

  for (const [re, rep] of rules) s = s.replace(re, rep);

  const map: Record<string, string> = {
    a: "а",
    b: "б",
    v: "в",
    g: "г",
    d: "д",
    e: "е",
    z: "з",
    i: "и",
    j: "ж",
    k: "к",
    l: "л",
    m: "м",
    n: "н",
    o: "о",
    p: "п",
    r: "р",
    s: "с",
    t: "т",
    u: "у",
    f: "ф",
    h: "х",
    y: "й",
    q: "к",
    w: "в",
    x: "кс",
    c: "к",
  };

  let out = "";
  for (const ch of s) out += map[ch] ?? ch;
  return out;
}

function buildSearchVariants(input: string): string[] {
  const raw = (input ?? "").trim();
  if (!raw) return [];

  const variants = new Set<string>();

  const add = (v: string) => {
    const n = normalizeForSearch(v);
    if (n) variants.add(n);
  };

  add(raw);
  add(latinToCyrillic(raw));
  add(cyrillicToLatin(raw));

  const lowered = raw.toLowerCase();

  add(lowered.replace(/oo/g, "o"));
  add(lowered.replace(/uu/g, "u"));
  add(lowered.replace(/ii/g, "i"));
  add(lowered.replace(/ee/g, "e"));
  add(lowered.replace(/aa/g, "a"));

  add(lowered.replace(/kh/g, "h"));
  add(lowered.replace(/sh/g, "s"));
  add(lowered.replace(/ch/g, "c"));

  add(latinToCyrillic(lowered.replace(/oo/g, "o")));
  add(latinToCyrillic(lowered.replace(/uu/g, "u")));
  add(latinToCyrillic(lowered.replace(/ii/g, "i")));
  add(latinToCyrillic(lowered.replace(/kh/g, "h")));
  add(latinToCyrillic(lowered.replace(/sh/g, "s")));
  add(latinToCyrillic(lowered.replace(/ch/g, "c")));

  return Array.from(variants);
}

function searchMatch(text: string, query: string): boolean {
  const variants = buildSearchVariants(query);
  if (variants.length === 0) return true;

  const original = normalizeForSearch(text);
  const translit = normalizeForSearch(cyrillicToLatin(text));

  return variants.some((q) => original.includes(q) || translit.includes(q));
}

function getFileExtension(uri: string, mimeType?: string) {
  const uriMatch = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (uriMatch?.[1]) return uriMatch[1].toLowerCase();

  if (mimeType?.includes("png")) return "png";
  if (mimeType?.includes("webp")) return "webp";
  if (mimeType?.includes("heic")) return "heic";
  return "jpg";
}

function getMimeTypeFromUri(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
}

function sanitizeFileNamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "");
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
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

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64" as any,
  });

  if (!base64) {
    throw new Error("Зураг уншихад алдаа гарлаа");
  }

  return base64ToArrayBuffer(base64);
}

function slugify(value: string) {
  return (
    normalizeForSearch(cyrillicToLatin(value)) ||
    normalizeForSearch(value) ||
    "item"
  );
}

const CATEGORY_SOURCE: Array<{
  name: string;
  subcategories: string[];
}> = [
  {
    name: "Тээврийн хэрэгсэл",
    subcategories: [
      "Суудлын машин",
      "SUV",
      "Pickup",
      "Ачааны машин",
      "Микро",
      "Мотоцикл",
      "Скүүтер",
      "Унадаг дугуй",
      "Цахилгаан дугуй",
      "Caravan / trailer",
    ],
  },
  {
    name: "Барилга, засварын тоног төхөөрөмж",
    subcategories: [
      "Өрөм",
      "Дрилл",
      "Бетон зүсэгч",
      "Цахилгаан хөрөө",
      "Гагнуурын аппарат",
      "Шат",
      "Лазер тэгш ус",
      "Компрессор",
      "Генератор",
      "Усны насос",
    ],
  },
  {
    name: "Арга хэмжээ, event-ийн хэрэгсэл",
    subcategories: [
      "Майхан",
      "Ширээ сандал",
      "Тайзны тоноглол",
      "Speaker",
      "Microphone",
      "Karaoke set",
      "Projector",
      "LED screen",
      "Photo booth",
      "Гэрэлтүүлэг",
    ],
  },
  {
    name: "Ахуйн болон өдөр тутмын хэрэглээ",
    subcategories: [
      "Хүүхдийн тэрэг",
      "Хүүхдийн машины суудал",
      "Нялх хүүхдийн ор",
      "Wheelchair",
      "Өвчтөний ор",
      "Зөөврийн халаагуур",
      "Air purifier",
      "Vacuum cleaner",
      "Carpet cleaner",
    ],
  },
  {
    name: "Аялал, outdoor хэрэгсэл",
    subcategories: [
      "Кемпийн майхан",
      "Унтлагын уут",
      "Кемпийн ширээ сандал",
      "Хийн плитка",
      "Cool box",
      "Загасчлалын хэрэгсэл",
      "Уулын дугуй",
      "GPS төхөөрөмж",
      "Walkie talkie/станц",
      "Portable battery/power bank",
    ],
  },
  {
    name: "Фото, видео, контентын тоног төхөөрөмж",
    subcategories: [
      "Camera",
      "Lens",
      "Gimbal",
      "Tripod",
      "Drone",
      "Action camera",
      "Lighting kit",
      "Microphone",
      "Teleprompter",
      "Backdrop stand",
    ],
  },
  {
    name: "Тоглоом, entertainment",
    subcategories: [
      "Projector + screen set",
      "Karaoke set",
      "VR headset",
      "Board games багц",
      "Air hockey / party game set",
      "Sim racing setup",
      "PS, Nintendo, Sega, etc",
    ],
  },
  {
    name: "Оффис, бизнесийн хэрэглээ",
    subcategories: [
      "Зөөврийн компьютер",
      "Printer",
      "Scanner",
      "POS төхөөрөмж",
      "Barcode scanner",
      "Label printer",
      "Meeting speakerphone",
      "Tablet",
      "Wi-Fi router",
      "Зөөврийн дэлгэц",
    ],
  },
  {
    name: "Хүнд машин механизм, тусгай хэрэгсэл",
    subcategories: [
      "Сэрээт ачигч",
      "Кран",
      "Ковш",
      "Индүү",
      "Excavator төрлийн техник",
      "Pallet jack",
      "Hand stacker",
    ],
  },
  {
    name: "Хувцас, тусгай хэрэглээ",
    subcategories: [
      "Гоёлын даашинз",
      "Үндэсний хувцас",
      "Костюм",
      "Тайзны хувцас",
      "Mascot хувцас",
      "Хамгаалалтын хувцас",
    ],
  },
  {
    name: "Спорт, хобби",
    subcategories: [
      "Цанын хэрэгсэл",
      "Snowboard",
      "Тэшүүр",
      "Фитнес тоног төхөөрөмж",
      "Paddle board",
      "Kayak",
      "Tennis racket",
      "Boxing gear",
    ],
  },
  {
    name: "Мал аж ахуй, хөдөө аж ахуйн хэрэгсэл",
    subcategories: [
      "Өвс хадах машин",
      "Газар сэндийлэгч",
      "Мотоблок",
      "Шүршигч аппарат",
      "Усалгааны насос",
      "Цахилгаан хашааны төхөөрөмж",
    ],
  },
];

const RENTAL_CATEGORIES: LocalCategory[] = CATEGORY_SOURCE.map(
  (category, categoryIndex) => {
    const categoryId = `cat-${categoryIndex + 1}-${slugify(category.name)}`;

    return {
      id: categoryId,
      name: category.name,
      sort_order: categoryIndex + 1,
      subcategories: category.subcategories.map((sub, subIndex) => ({
        id: `${categoryId}-sub-${subIndex + 1}-${slugify(sub)}`,
        name: sub,
        sort_order: subIndex + 1,
      })),
    };
  }
);

export default function PostScreen() {
  const { addJob } = useJobs();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { colors, currentTheme } = useTheme();

  const logoSource = useMemo(() => getLogoSource(currentTheme), [currentTheme]);

  const [step, setStep] = useState<"select-type" | "form">("select-type");
  const [postType, setPostType] = useState<PostType | null>(null);

  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);

  const [categorySearch, setCategorySearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [subcategoryModalVisible, setSubcategoryModalVisible] = useState(false);

  const [selectedLocation, setSelectedLocation] =
    useState<PickedLocation | null>(null);
  const [pickedImages, setPickedImages] = useState<PickedImage[]>([]);
  const [pickingImages, setPickingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [initialRegion, setInitialRegion] = useState({
    latitude: 47.9184,
    longitude: 106.9177,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });

  const [addBanners, setAddBanners] = useState<any[]>([]);

  const loadAddBanners = useCallback(async () => {
    try {
      const banners = await fetchBanners("add_tab", 3);
      setAddBanners(banners ?? []);
    } catch (error) {
      console.log("FETCH ADD BANNERS ERROR:", error);
      setAddBanners([]);
    }
  }, []);

  useEffect(() => {
    loadAddBanners();
  }, [loadAddBanners]);

  const resetForm = useCallback(() => {
    setDescription("");
    setCategoryId(null);
    setSubcategoryId(null);
    setCategorySearch("");
    setSubcategorySearch("");
    setCategoryModalVisible(false);
    setSubcategoryModalVisible(false);
    setSelectedLocation(null);
    setPickedImages([]);
    setPostType(null);
    setSubmitting(false);
    setPickingImages(false);
    setStep("select-type");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const location = await Location.getCurrentPositionAsync({});
        setInitialRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch (error) {
        console.log("Location init failed:", error);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isAuthenticated && step === "form") {
      setStep("select-type");
      setPostType(null);
    }
  }, [isAuthenticated, step]);

  const handleSelectType = useCallback(
    (type: PostType) => {
      if (!isAuthenticated) {
        router.push("/auth");
        return;
      }

      setPostType(type);
      setStep("form");
    },
    [isAuthenticated, router]
  );

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      const addressText = address
        ? `${address.district || address.city || ""}${
            address.subregion ? `, ${address.subregion}` : ""
          }`.trim()
        : undefined;

      setSelectedLocation({
        latitude,
        longitude,
        address: addressText || undefined,
      });
    } catch {
      setSelectedLocation({ latitude, longitude });
    }
  };

  const selectedCategoryObj = useMemo(() => {
    if (!categoryId) return null;
    return RENTAL_CATEGORIES.find((item) => item.id === categoryId) ?? null;
  }, [categoryId]);

  const selectedCategoryName = selectedCategoryObj?.name ?? null;

  const selectedSubcategoryObj = useMemo(() => {
    if (!subcategoryId || !selectedCategoryObj?.subcategories?.length) return null;
    return (
      selectedCategoryObj.subcategories.find((item) => item.id === subcategoryId) ??
      null
    );
  }, [selectedCategoryObj, subcategoryId]);

  const selectedSubcategoryName = selectedSubcategoryObj?.name ?? null;

  const visibleCategories = useMemo(() => {
    if (!categorySearch.trim()) return RENTAL_CATEGORIES;
    return RENTAL_CATEGORIES.filter((item) =>
      searchMatch(item.name, categorySearch)
    );
  }, [categorySearch]);

  const visibleSubcategories = useMemo(() => {
    const list = selectedCategoryObj?.subcategories ?? [];
    if (!subcategorySearch.trim()) return list;
    return list.filter((item) => searchMatch(item.name, subcategorySearch));
  }, [selectedCategoryObj, subcategorySearch]);

  const removePickedImage = useCallback((uri: string) => {
    setPickedImages((prev) => prev.filter((img) => img.uri !== uri));
  }, []);

  const handlePickImages = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Мэдээлэл", "Зураг сонгох хэсгийг одоогоор апп дээр ашиглана уу");
      return;
    }

    if (pickedImages.length >= MAX_IMAGES) {
      Alert.alert(
        "Анхаар",
        `Та хамгийн ихдээ ${MAX_IMAGES} зураг сонгох боломжтой`
      );
      return;
    }

    try {
      setPickingImages(true);

      const ImagePicker = await import("expo-image-picker");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Зөвшөөрөл хэрэгтэй",
          "Зураг сонгохын тулд gallery access зөвшөөрнө үү"
        );
        return;
      }

      const remaining = MAX_IMAGES - pickedImages.length;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.85,
      });

      if (result.canceled) return;

      const nextImages: PickedImage[] = (result.assets ?? []).map(
        (asset, index) => ({
          uri: asset.uri,
          name:
            asset.fileName ||
            `listing-image-${Date.now()}-${index}.${getFileExtension(
              asset.uri,
              asset.mimeType || getMimeTypeFromUri(asset.uri)
            )}`,
          mimeType: asset.mimeType || getMimeTypeFromUri(asset.uri),
        })
      );

      setPickedImages((prev) => {
        const merged = [...prev];
        for (const item of nextImages) {
          if (!merged.some((x) => x.uri === item.uri)) {
            merged.push(item);
          }
        }
        return merged.slice(0, MAX_IMAGES);
      });
    } catch (error) {
      console.log("PICK IMAGES ERROR:", error);
      Alert.alert("Алдаа", "Зураг сонгоход алдаа гарлаа");
    } finally {
      setPickingImages(false);
    }
  }, [pickedImages.length]);

  const uploadImagesToSupabase = useCallback(
    async (images: PickedImage[]) => {
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

          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, fileData, {
              contentType: image.mimeType || "image/jpeg",
              upsert: false,
            });

          if (uploadError) throw uploadError;

          uploadedPaths.push(filePath);

          const { data: publicData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

          if (publicData?.publicUrl) {
            publicUrls.push(publicData.publicUrl);
          }
        }

        return publicUrls;
      } catch (error) {
        for (const path of uploadedPaths) {
          try {
            await supabase.storage.from(STORAGE_BUCKET).remove([path]);
          } catch (removeError) {
            console.log("ROLLBACK STORAGE REMOVE ERROR:", removeError);
          }
        }
        throw error;
      }
    },
    [user]
  );


  const handleSelectCategory = useCallback((cat: LocalCategory) => {
    setCategoryId(cat.id);
    setSubcategoryId(null);
    setCategorySearch("");
    setSubcategorySearch("");
    setCategoryModalVisible(false);
  }, []);

  const handleSelectSubcategory = useCallback((sub: LocalSubcategory) => {
    setSubcategoryId((prev) => (prev === sub.id ? null : sub.id));
    setSubcategorySearch("");
    setSubcategoryModalVisible(false);
  }, []);

  const handleSubmit = async () => {
    if (submitting) return;

    if (!postType) {
      Alert.alert("Алдаа", "Зарын төрөл сонгоно уу");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Алдаа", "Зарын мэдээлэл оруулна уу");
      return;
    }

    if (!selectedCategoryObj) {
      Alert.alert("Алдаа", "Категори сонгоно уу");
      return;
    }

    try {
      setSubmitting(true);

      const imageUrls = await uploadImagesToSupabase(pickedImages);

      await addJob(
        {
          title: selectedSubcategoryObj?.name || selectedCategoryObj.name,
          description: description.trim(),

          // Tureestei mock category бүтэц ашиглаж байгаа тул
          // DB рүү uuid биш name-үүдийг хадгална.
          category: selectedCategoryObj.name,
          subcategory: selectedSubcategoryObj?.name ?? null,

          // jobs table дээр эдгээр нь uuid тул mock string id бүү явуул
          category_id: null,
          subcategory_id: null,

          postType,
          location: selectedLocation || undefined,
          image_url: imageUrls[0] ?? null,
          image_urls: imageUrls,
        } as any,
        {
          name: user?.name || user?.phone || "Хэрэглэгч",
          phone: user?.phone || "",
          photoUri: (user as any)?.photoUri,
          sponsoredUntil: (user as any)?.sponsoredUntil ?? null,
        }
      );

      Alert.alert("Амжилттай!", "Таны зар амжилттай нэмэгдлээ", [
        {
          text: "OK",
          onPress: () => {
            resetForm();
            router.replace("/(tabs)");
          },
        },
      ]);
    } catch (error: any) {
      console.log("POST JOB ERROR:", error);
      Alert.alert("Алдаа", error?.message ?? "Зар нэмэхэд алдаа гарлаа");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "select-type") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView
          edges={["top"]}
          style={[styles.safeArea, { backgroundColor: colors.headerBackground }]}
        >
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.headerText }]}>
              Зар нэмэх
            </Text>
            <Image
              source={logoSource}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.subtitleContainer}>
            <Text
              style={[styles.headerSubtitle, { color: colors.headerText }]}
            >
              Та ямар төрлийн зар оруулах вэ?
            </Text>
          </View>
        </SafeAreaView>

        <View style={styles.selectTypeContainer}>
          <TouchableOpacity
            style={[styles.typeCard, { backgroundColor: colors.card }]}
            onPress={() => handleSelectType("job")}
            activeOpacity={0.7}
          >
            <View
              style={[styles.typeCardIcon, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.typeCardEmoji}>📦</Text>
            </View>
            <Text style={[styles.typeCardTitle, { color: colors.text }]}>
              Түрээслүүлэх
            </Text>
            <Text
              style={[
                styles.typeCardDescription,
                { color: colors.textSecondary },
              ]}
            >
              Би түрээслүүлэх зүйл, үйлчилгээ эсвэл санал байршуулна.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeCard, { backgroundColor: colors.card }]}
            onPress={() => handleSelectType("worker")}
            activeOpacity={0.7}
          >
            <View
              style={[styles.typeCardIcon, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.typeCardEmoji}>🔎</Text>
            </View>
            <Text style={[styles.typeCardTitle, { color: colors.text }]}>
              Түрээслэх
            </Text>
            <Text
              style={[
                styles.typeCardDescription,
                { color: colors.textSecondary },
              ]}
            >
              Би түрээслэх зүйл, үйлчилгээ эсвэл хэрэгцээгээ байршуулна.
            </Text>
          </TouchableOpacity>

          {addBanners.length > 0 ? (
            <View style={styles.addBannerOuter}>
              <View style={styles.addBannerWrap}>
                <BannerCarousel banners={addBanners} />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.safeArea, { backgroundColor: colors.headerBackground }]}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>
            {postType === "job" ? "Түрээслүүлэх" : "Түрээслэх"}
          </Text>
          <Image
            source={logoSource}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.subtitleContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep("select-type")}
            activeOpacity={0.7}
          >
            <Text style={[styles.backButtonText, { color: colors.headerText }]}>
              ← Буцах
            </Text>
          </TouchableOpacity>

          <Text style={[styles.headerSubtitle, { color: colors.headerText }]}>
            {postType === "job"
              ? "Түрээслүүлэх зарын дэлгэрэнгүй мэдээллээ оруулна уу"
              : "Түрээслэх хэрэгцээний дэлгэрэнгүй мэдээллээ оруулна уу"}
          </Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: colors.text }]}>
              Зарын мэдээлэл *
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Зарын талаар дэлгэрэнгүй бич..."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              editable={!submitting}
              scrollEnabled={false}
              autoCorrect={false}
              returnKeyType="default"
              blurOnSubmit={false}
            />
          </View>

          <View style={styles.formSection}>
            <View style={styles.imagesHeaderRow}>
              <Text
                style={[styles.label, { color: colors.text, marginBottom: 0 }]}
              >
                Зураг
              </Text>
              <Text
                style={[styles.imageCountText, { color: colors.textSecondary }]}
              >
                {pickedImages.length}/{MAX_IMAGES}
              </Text>
            </View>

            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Нэг зар дээр хамгийн ихдээ {MAX_IMAGES} зураг оруулж болно
            </Text>

            <TouchableOpacity
              style={[
                styles.imagePickerButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pickingImages || submitting ? 0.7 : 1,
                },
              ]}
              onPress={handlePickImages}
              activeOpacity={0.8}
              disabled={pickingImages || submitting}
            >
              <Text style={[styles.imagePickerButtonText, { color: colors.text }]}>
                {pickingImages ? "Зураг нээж байна..." : "📷 Зураг сонгох"}
              </Text>
            </TouchableOpacity>

            {pickedImages.length > 0 ? (
              <View style={styles.imageGrid}>
                {pickedImages.map((img, index) => (
                  <View
                    key={`${img.uri}-${index}`}
                    style={[styles.imageCard, { borderColor: colors.border }]}
                  >
                    <Image source={{ uri: img.uri }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removePickedImage(img.uri)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.removeImageButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View
                style={[
                  styles.emptyImageBox,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.emptyImageText, { color: colors.textSecondary }]}
                >
                  Одоогоор зураг сонгоогүй байна
                </Text>
              </View>
            )}
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.label, { color: colors.text }]}>
              Категори *
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.selectButton,
                {
                  backgroundColor: colors.card,
                  borderColor: selectedCategoryObj ? colors.primary : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => {
                setCategorySearch("");
                setCategoryModalVisible(true);
              }}
              android_ripple={{ color: colors.border }}
              disabled={submitting}
            >
              <View style={styles.selectButtonTextWrap}>
                <Text
                  style={[
                    styles.selectButtonTitle,
                    { color: selectedCategoryName ? colors.text : colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {selectedCategoryName || "Категори сонгох"}
                </Text>
                <Text style={[styles.selectButtonHint, { color: colors.textSecondary }]}>
                  Дарж жагсаалтаас сонгоно
                </Text>
              </View>
              <Text style={[styles.selectButtonArrow, { color: colors.textSecondary }]}>
                ›
              </Text>
            </Pressable>

            {selectedCategoryObj ? (
              <View style={styles.subcategoryWrap}>
                <Text style={[styles.label, { color: colors.text }]}>
                  Дэд категори
                </Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.selectButton,
                    {
                      backgroundColor: colors.card,
                      borderColor: selectedSubcategoryObj ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  onPress={() => {
                    setSubcategorySearch("");
                    setSubcategoryModalVisible(true);
                  }}
                  android_ripple={{ color: colors.border }}
                  disabled={submitting || (selectedCategoryObj.subcategories?.length ?? 0) === 0}
                >
                  <View style={styles.selectButtonTextWrap}>
                    <Text
                      style={[
                        styles.selectButtonTitle,
                        {
                          color: selectedSubcategoryName
                            ? colors.text
                            : colors.textSecondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSubcategoryName || "Дэд категори сонгох / алгасах"}
                    </Text>
                    <Text
                      style={[
                        styles.selectButtonHint,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Сонгохгүй байж болно
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.selectButtonArrow,
                      { color: colors.textSecondary },
                    ]}
                  >
                    ›
                  </Text>
                </Pressable>

                {selectedSubcategoryName ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.clearSelectionButton,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                    onPress={() => setSubcategoryId(null)}
                    disabled={submitting}
                  >
                    <Text
                      style={[
                        styles.clearSelectionText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Дэд категори арилгах
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <Modal
              visible={categoryModalVisible}
              animationType="slide"
              transparent
              onRequestClose={() => setCategoryModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <Pressable
                  style={styles.modalBackdrop}
                  onPress={() => setCategoryModalVisible(false)}
                />
                <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
                  <View style={styles.modalHandle} />
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                      Категори сонгох
                    </Text>
                    <Pressable
                      onPress={() => setCategoryModalVisible(false)}
                      hitSlop={12}
                    >
                      <Text style={[styles.modalCloseText, { color: colors.text }]}>
                        ✕
                      </Text>
                    </Pressable>
                  </View>

                  <TextInput
                    style={[
                      styles.searchInput,
                      {
                        backgroundColor: colors.card,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Категори хайх..."
                    placeholderTextColor={colors.textSecondary}
                    value={categorySearch}
                    onChangeText={setCategorySearch}
                    editable={!submitting}
                    autoCorrect={false}
                    returnKeyType="search"
                  />

                  <FlatList
                    data={visibleCategories}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.modalListContent}
                    ListEmptyComponent={
                      <Text
                        style={[
                          styles.emptyResultText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Тохирох категори олдсонгүй
                      </Text>
                    }
                    renderItem={({ item }) => {
                      const selected = categoryId === item.id;

                      return (
                        <Pressable
                          style={({ pressed }) => [
                            styles.modalOption,
                            {
                              backgroundColor: selected
                                ? colors.primary
                                : colors.card,
                              borderColor: selected
                                ? colors.primary
                                : colors.border,
                              opacity: pressed ? 0.85 : 1,
                            },
                          ]}
                          onPress={() => handleSelectCategory(item)}
                          android_ripple={{ color: colors.border }}
                        >
                          <Text
                            style={[
                              styles.modalOptionText,
                              { color: selected ? "#111" : colors.text },
                            ]}
                          >
                            {item.name}
                          </Text>
                          {selected ? (
                            <Text style={styles.modalSelectedMark}>✓</Text>
                          ) : null}
                        </Pressable>
                      );
                    }}
                  />
                </View>
              </View>
            </Modal>

            <Modal
              visible={subcategoryModalVisible}
              animationType="slide"
              transparent
              onRequestClose={() => setSubcategoryModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <Pressable
                  style={styles.modalBackdrop}
                  onPress={() => setSubcategoryModalVisible(false)}
                />
                <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
                  <View style={styles.modalHandle} />
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                      Дэд категори сонгох
                    </Text>
                    <Pressable
                      onPress={() => setSubcategoryModalVisible(false)}
                      hitSlop={12}
                    >
                      <Text style={[styles.modalCloseText, { color: colors.text }]}>
                        ✕
                      </Text>
                    </Pressable>
                  </View>

                  <TextInput
                    style={[
                      styles.searchInput,
                      {
                        backgroundColor: colors.card,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Дэд категори хайх..."
                    placeholderTextColor={colors.textSecondary}
                    value={subcategorySearch}
                    onChangeText={setSubcategorySearch}
                    editable={!submitting}
                    autoCorrect={false}
                    returnKeyType="search"
                  />

                  <Pressable
                    style={({ pressed }) => [
                      styles.modalOption,
                      {
                        backgroundColor: !subcategoryId
                          ? colors.primary
                          : colors.card,
                        borderColor: !subcategoryId
                          ? colors.primary
                          : colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                    onPress={() => {
                      setSubcategoryId(null);
                      setSubcategorySearch("");
                      setSubcategoryModalVisible(false);
                    }}
                    android_ripple={{ color: colors.border }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        { color: !subcategoryId ? "#111" : colors.text },
                      ]}
                    >
                      Дэд категори сонгохгүй
                    </Text>
                    {!subcategoryId ? (
                      <Text style={styles.modalSelectedMark}>✓</Text>
                    ) : null}
                  </Pressable>

                  <FlatList
                    data={visibleSubcategories}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.modalListContent}
                    ListEmptyComponent={
                      <Text
                        style={[
                          styles.emptyResultText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Тохирох дэд категори олдсонгүй
                      </Text>
                    }
                    renderItem={({ item }) => {
                      const selected = subcategoryId === item.id;

                      return (
                        <Pressable
                          style={({ pressed }) => [
                            styles.modalOption,
                            {
                              backgroundColor: selected
                                ? colors.primary
                                : colors.card,
                              borderColor: selected
                                ? colors.primary
                                : colors.border,
                              opacity: pressed ? 0.85 : 1,
                            },
                          ]}
                          onPress={() => handleSelectSubcategory(item)}
                          android_ripple={{ color: colors.border }}
                        >
                          <Text
                            style={[
                              styles.modalOptionText,
                              { color: selected ? "#111" : colors.text },
                            ]}
                          >
                            {item.name}
                          </Text>
                          {selected ? (
                            <Text style={styles.modalSelectedMark}>✓</Text>
                          ) : null}
                        </Pressable>
                      );
                    }}
                  />
                </View>
              </View>
            </Modal>
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.label, { color: colors.text }]}>
              Байршил (заавал биш)
            </Text>

            {Platform.OS !== "web" && MapView ? (
              <>
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  Газрын зураг дээр дарж байршил сонгоно уу
                </Text>

                <View
                  style={[
                    styles.mapContainer,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                >
                  <MapView
                    style={styles.map}
                    provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                    initialRegion={initialRegion}
                    onPress={handleMapPress}
                  >
                    {selectedLocation && (
                      <Marker
                        coordinate={{
                          latitude: selectedLocation.latitude,
                          longitude: selectedLocation.longitude,
                        }}
                      />
                    )}
                  </MapView>
                </View>

                {selectedLocation?.address ? (
                  <Text
                    style={[
                      styles.selectedLocationText,
                      {
                        color: colors.text,
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    Сонгосон байршил: {selectedLocation.address}
                  </Text>
                ) : null}
              </>
            ) : (
              <View
                style={[
                  styles.webLocationNote,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.webLocationNoteText,
                    { color: colors.textSecondary },
                  ]}
                >
                  📍 Газрын зураг нь зөвхөн утсан дээр ажиллана
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              {
                backgroundColor: colors.primary,
                opacity: submitting ? 0.75 : 1,
              },
            ]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#111" />
            ) : (
              <Text style={styles.submitButtonText}>Зар нэмэх</Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  safeArea: { paddingBottom: 10 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  logo: { width: 130, height: 54 },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  subtitleContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  headerSubtitle: { fontSize: 14 },

  keyboardView: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 24 },

  formSection: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },

  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: { minHeight: 120, paddingTop: 14 },

  imagesHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  imageCountText: {
    fontSize: 13,
    fontWeight: "600",
  },
  imagePickerButton: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePickerButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  emptyImageBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyImageText: {
    fontSize: 14,
  },
  imageGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imageCard: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    position: "relative",
    backgroundColor: "#ddd",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removeImageButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeImageButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  },


  selectButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectButtonTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  selectButtonTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  selectButtonHint: {
    marginTop: 3,
    fontSize: 12,
  },
  selectButtonArrow: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: "500",
  },
  clearSelectionButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearSelectionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalSheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  modalHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(150,150,150,0.55)",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  modalCloseText: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalListContent: {
    paddingBottom: 12,
    gap: 8,
  },
  modalOption: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    paddingRight: 10,
  },
  modalSelectedMark: {
    color: "#111",
    fontSize: 16,
    fontWeight: "900",
  },

  searchInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 12,
  },

  chipsScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  chipsContainer: {
    paddingRight: 20,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
  },

  backButton: { marginBottom: 8, alignSelf: "flex-start" },
  backButtonText: { fontSize: 14, fontWeight: "600" },

  helperText: { fontSize: 12, marginBottom: 12 },

  emptyResultText: {
    marginTop: 8,
    fontSize: 13,
  },
  selectedMetaText: {
    marginTop: 8,
    fontSize: 13,
  },
  subcategoryWrap: {
    marginTop: 12,
  },

  mapContainer: {
    height: 300,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
  map: { width: "100%", height: "100%" },

  selectedLocationText: {
    marginTop: 12,
    fontSize: 14,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },

  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 54,
    justifyContent: "center",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },

  bottomPadding: { height: 40 },

  selectTypeContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 14,
  },

  typeCard: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },

  typeCardIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  typeCardEmoji: { fontSize: 34 },
  typeCardTitle: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  typeCardDescription: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },

  addBannerOuter: {
    marginTop: 10,
    marginBottom: 6,
    marginHorizontal: -20,
  },

  addBannerWrap: {
    width: "100%",
  },

  webLocationNote: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  webLocationNoteText: {
    fontSize: 14,
    textAlign: "center",
  },
});