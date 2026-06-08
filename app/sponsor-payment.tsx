// app/sponsor-payment.tsx
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Linking,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ChevronLeft,
  Check,
  BadgeDollarSign,
  RefreshCw,
  AlertTriangle,
  Star,
} from "lucide-react-native";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";

type SponsorPlan = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  description: string;
};

type InvoiceUiData = {
  senderInvoiceNo: string;
  callbackUrl: string | null;
  qrText: string | null;
  qrImage: string | null;
  deeplink: string | null;
  raw: any;
};

type InvokeReadableError = {
  title: string;
  message: string;
  debugMessage?: string;
  raw?: any;
};

const SPONSOR_PLANS: SponsorPlan[] = [
  {
    id: "daily",
    name: "1 хоног",
    price: 4500,
    durationDays: 1,
    description:
      "Та өөрийн нийтлэсэн зараа Sponsored зар болгон 1 хоногийн турш заруудын эхэнд болон хайлтын эхэнд санал болгон харагдуулах боломжтой",
  },
  {
    id: "weekly",
    name: "7 хоног",
    price: 21000,
    durationDays: 7,
    description:
      "Та өөрийн нийтлэсэн зараа Sponsored зар болгон 7 хоногийн турш заруудын эхэнд болон хайлтын эхэнд санал болгон харагдуулах боломжтой",
  },
  {
    id: "monthly",
    name: "30 хоног",
    price: 45000,
    durationDays: 30,
    description:
      "Та өөрийн нийтлэсэн зараа Sponsored зар болгон 30 хоногийн турш заруудын эхэнд болон хайлтын эхэнд санал болгон харагдуулах боломжтой",
  },
];

function toSafeDate(value: any): Date {
  if (!value) return new Date();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function getJobOwnerId(job: any): string | null {
  return job?.postedBy?.id ?? job?.posted_by_id ?? null;
}

function getJobOwnerPhone(job: any): string | null {
  return job?.postedBy?.phone ?? job?.posted_by_phone ?? null;
}

function isOwnedByCurrentUser(job: any, user: any): boolean {
  if (!job || !user) return false;

  const jobOwnerId = getJobOwnerId(job);
  const jobOwnerPhone = getJobOwnerPhone(job);

  return jobOwnerId === user?.id || jobOwnerPhone === user?.phone;
}

function getSponsoredUntilDate(job: any): Date | null {
  const sponsoredUntilRaw = job?.sponsoredUntil ?? job?.sponsored_until ?? null;
  if (!sponsoredUntilRaw) return null;

  const d = toSafeDate(sponsoredUntilRaw);
  if (Number.isNaN(d.getTime())) return null;

  return d;
}

function isJobSponsoredNow(job: any): boolean {
  const sponsoredUntil = getSponsoredUntilDate(job);
  if (sponsoredUntil) return sponsoredUntil.getTime() > Date.now();

  return Boolean(job?.isSponsored || job?.is_sponsored);
}

function getSponsoredUntilText(job: any): string | null {
  const d = getSponsoredUntilDate(job);
  if (!d) return null;
  if (d.getTime() <= Date.now()) return null;
  return d.toLocaleString();
}

function toNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getItemRatingAvg(job: any): number {
  return toNumber(
    job?.itemRatingAvg ??
      job?.item_rating_avg ??
      job?.item_rating ??
      job?.rating_avg ??
      0,
    0
  );
}

function getItemReviewCount(job: any): number {
  return Math.max(
    0,
    Math.floor(
      toNumber(
        job?.itemReviewCount ??
          job?.item_review_count ??
          job?.review_count ??
          0,
        0
      )
    )
  );
}

function getRentalCount(job: any): number {
  return Math.max(
    0,
    Math.floor(
      toNumber(
        job?.rentalCount ??
          job?.rental_count ??
          job?.rent_count ??
          0,
        0
      )
    )
  );
}

function formatRating(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "Шинэ";
  return value.toFixed(1);
}

function isLowRatedItem(job: any): boolean {
  const count = getItemReviewCount(job);
  const avg = getItemRatingAvg(job);

  // Үнэлгээтэй болсон item 3.0-аас доош бол sponsored хийхээс өмнө warning өгнө.
  return count > 0 && avg > 0 && avg < 3;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "0 хоног 00:00:00";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return `${days} хоног ${hh}:${mm}:${ss}`;
}

function looksLikeBase64Image(value: string) {
  if (!value) return false;
  if (value.length < 100) return false;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(value);
}

function normalizeImageUri(uri: any): string | null {
  if (typeof uri !== "string") return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed;
  }

  if (looksLikeBase64Image(trimmed)) {
    const cleaned = trimmed.replace(/\s+/g, "");
    return `data:image/png;base64,${cleaned}`;
  }

  return null;
}

function firstString(...values: any[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function safeJsonStringify(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function stringifyUnknown(value: any): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (typeof value === "object") {
    if (typeof value?.message === "string") return value.message;
    if (typeof value?.error === "string") return value.error;
    return safeJsonStringify(value);
  }

  return String(value);
}

function extractInvoiceUiData(responseData: any): InvoiceUiData | null {
  if (!responseData?.success) return null;

  const qpay = responseData?.qpay ?? {};
  const qrImage = normalizeImageUri(
    firstString(
      qpay?.qr_image,
      qpay?.qrImage,
      qpay?.qr_image_url,
      qpay?.qrImageUrl,
      qpay?.logo
    )
  );

  const qrText = firstString(
    qpay?.qr_text,
    qpay?.qrText,
    qpay?.qr_code,
    qpay?.qrCode,
    qpay?.qrcode_text,
    qpay?.qr_string,
    qpay?.qPay_QRcode
  );

  const deeplink = firstString(
    qpay?.qPay_shortUrl,
    qpay?.qpay_short_url,
    qpay?.short_url,
    qpay?.deeplink,
    qpay?.deep_link,
    qpay?.link,
    qpay?.url
  );

  return {
    senderInvoiceNo:
      firstString(
        responseData?.sender_invoice_no,
        qpay?.sender_invoice_no,
        qpay?.senderInvoiceNo
      ) ?? "",
    callbackUrl: firstString(responseData?.callback_url) ?? null,
    qrText,
    qrImage,
    deeplink,
    raw: qpay,
  };
}

function getStageBasedMessage(stage?: string) {
  switch (stage) {
    case "method_check":
      return "Хүсэлтийн төрөл буруу байна.";
    case "body_parse":
      return "Илгээсэн мэдээлэл буруу байна.";
    case "validation":
      return "Илгээсэн утгууд буруу байна.";
    case "env_check":
      return "Серверийн QPay тохиргоо дутуу байна.";
    case "qpay_auth_failed":
      return "QPay нэвтрэх хэсэг амжилтгүй боллоо.";
    case "qpay_auth_token_missing":
      return "QPay access token авч чадсангүй.";
    case "qpay_invoice_failed":
      return "QPay invoice үүсгэхэд алдаа гарлаа.";
    case "invoice_id_missing":
      return "QPay invoice мэдээлэл дутуу ирлээ.";
    case "sponsor_payment_insert_failed":
      return "Төлбөрийн мэдээллийг хадгалахад алдаа гарлаа.";
    case "server_exception":
      return "Сервер дотор алдаа гарлаа.";
    default:
      return null;
  }
}

function buildReadableError(
  data: any,
  fallback = "Төлбөр эхлүүлэхэд алдаа гарлаа."
): InvokeReadableError {
  const stage = typeof data?.stage === "string" ? data.stage : "";
  const details = data?.details;
  const status = data?.status;

  const detailMessage =
    firstString(
      stringifyUnknown(details?.message),
      stringifyUnknown(details?.error),
      stringifyUnknown(data?.error),
      stringifyUnknown(data?.message)
    ) ?? null;

  const stageMessage = getStageBasedMessage(stage);

  let message = detailMessage || stageMessage || fallback;

  if (stage === "qpay_auth_failed" && typeof status === "number") {
    message = `QPay auth алдаа гарлаа (${status}).`;
  }

  if (stage === "qpay_invoice_failed" && typeof status === "number") {
    message = `QPay invoice үүсгэхэд алдаа гарлаа (${status}).`;
  }

  const debugParts: string[] = [];

  if (stage) debugParts.push(`stage: ${stage}`);
  if (typeof status === "number") debugParts.push(`status: ${status}`);
  if (details?.raw_text) debugParts.push(`raw_text: ${String(details.raw_text)}`);
  if (details?.message) {
    debugParts.push(`details.message: ${stringifyUnknown(details.message)}`);
  }
  if (details?.error) {
    debugParts.push(`details.error: ${stringifyUnknown(details.error)}`);
  }

  return {
    title: "Алдаа",
    message,
    debugMessage: debugParts.length > 0 ? debugParts.join("\n") : undefined,
    raw: data,
  };
}

async function readInvokeError(error: any) {
  try {
    const context = error?.context;
    if (!context) return null;

    if (typeof context?.json === "function") {
      return await context.json();
    }

    if (typeof context?.text === "function") {
      const text = await context.text();
      try {
        return JSON.parse(text);
      } catch {
        return { raw_text: text };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(String(url ?? "").trim());
}

async function safelyOpenLink(url: string) {
  const normalized = String(url ?? "").trim();

  if (!normalized) {
    throw new Error("QPay холбоос олдсонгүй.");
  }

  if (isHttpUrl(normalized)) {
    await Linking.openURL(normalized);
    return;
  }

  const supported = await Linking.canOpenURL(normalized);
  if (!supported) {
    throw new Error("QPay холбоосыг нээж чадсангүй.");
  }

  await Linking.openURL(normalized);
}

export default function SponsorPaymentScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { jobs, loadJobs } = useJobs() as any;
  const { user } = useAuth();
  const { colors, currentTheme } = useTheme();

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isOpeningQpay, setIsOpeningQpay] = useState(false);
  const [showManualOpenButton, setShowManualOpenButton] = useState(false);
  const [invoiceUi, setInvoiceUi] = useState<InvoiceUiData | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [lowRatingWarningAccepted, setLowRatingWarningAccepted] = useState(false);

  const buttonTextColor = currentTheme === "navy" ? "#F8E75D" : "#1A1A1A";
  const buttonBackgroundColor = currentTheme === "navy" ? "#2A2A2A" : colors.primary;

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const selectedPlanData = useMemo(
    () => SPONSOR_PLANS.find((plan) => plan.id === selectedPlan) ?? null,
    [selectedPlan]
  );

  const selectedJob = useMemo(() => {
    return (jobs as any[]).find((job: any) => String(job?.id) === String(jobId)) ?? null;
  }, [jobs, jobId]);

  const itemRatingAvg = useMemo(() => getItemRatingAvg(selectedJob), [selectedJob]);
  const itemReviewCount = useMemo(() => getItemReviewCount(selectedJob), [selectedJob]);
  const rentalCount = useMemo(() => getRentalCount(selectedJob), [selectedJob]);
  const shouldShowLowRatingWarning = useMemo(
    () => isLowRatedItem(selectedJob),
    [selectedJob]
  );

  const isOwner = useMemo(() => {
    return isOwnedByCurrentUser(selectedJob, user);
  }, [selectedJob, user]);

  const alreadySponsored = useMemo(() => {
    return isJobSponsoredNow(selectedJob);
  }, [selectedJob, nowTs]);

  const sponsoredUntilText = useMemo(() => {
    return getSponsoredUntilText(selectedJob);
  }, [selectedJob, nowTs]);

  const remainingCountdown = useMemo(() => {
    const d = getSponsoredUntilDate(selectedJob);
    if (!d) return null;

    const diff = d.getTime() - nowTs;
    if (diff <= 0) return null;

    return formatCountdown(diff);
  }, [selectedJob, nowTs]);

  useEffect(() => {
    setLowRatingWarningAccepted(false);
  }, [jobId, selectedPlan]);

  const canSubmit =
    !!selectedPlanData &&
    !!selectedJob &&
    !!jobId &&
    isOwner &&
    !alreadySponsored &&
    !isSubmitting;

  const refreshJobStatus = useCallback(
    async (showResultAlert = false) => {
      if (!loadJobs) return false;

      try {
        setIsRefreshingStatus(true);
        await loadJobs();
      } catch (error: any) {
        if (showResultAlert) {
          Alert.alert("Алдаа", error?.message ?? "Төлөв шинэчлэхэд алдаа гарлаа.");
        }
        return false;
      } finally {
        setIsRefreshingStatus(false);
      }

      if (showResultAlert) {
        setTimeout(() => {
          const refreshedJob =
            ((jobs as any[]) ?? []).find((job: any) => String(job?.id) === String(jobId)) ?? null;

          if (isJobSponsoredNow(refreshedJob)) {
            setInvoiceUi(null);
            setShowManualOpenButton(false);
            Alert.alert("Амжилттай", "Төлбөр баталгаажиж, зар Sponsored боллоо.");
          } else {
            Alert.alert(
              "Мэдэгдэл",
              "Одоогоор төлбөр баталгаажаагүй байна. Хэрэв та төлсөн бол хэсэг хүлээгээд дахин шалгана уу."
            );
          }
        }, 350);
      }

      return true;
    },
    [jobId, jobs, loadJobs]
  );

  useEffect(() => {
    if (!invoiceUi || alreadySponsored) return;

    const timer = setInterval(async () => {
      if (!loadJobs) return;
      try {
        await loadJobs();
      } catch {
        // silent
      }
    }, 8000);

    return () => clearInterval(timer);
  }, [invoiceUi, alreadySponsored, loadJobs]);

  useEffect(() => {
    if (alreadySponsored && invoiceUi) {
      setInvoiceUi(null);
      setShowManualOpenButton(false);
    }
  }, [alreadySponsored, invoiceUi]);

  useEffect(() => {
    if (!invoiceUi) return;

    let delayedTimer: ReturnType<typeof setTimeout> | null = null;

    const subscription = AppState.addEventListener("change", async (nextState) => {
      if (nextState !== "active") return;

      try {
        console.log("App returned to foreground, refreshing payment status...");
        await loadJobs?.();

        delayedTimer = setTimeout(async () => {
          try {
            console.log("Running delayed foreground refresh...");
            await loadJobs?.();
          } catch (error) {
            console.log("Delayed foreground refresh failed:", error);
          }
        }, 1500);
      } catch (error) {
        console.log("Foreground refresh failed:", error);
      }
    });

    return () => {
      subscription.remove();
      if (delayedTimer) clearTimeout(delayedTimer);
    };
  }, [invoiceUi, loadJobs]);

  const openQpay = useCallback(async () => {
    if (!invoiceUi?.deeplink) {
      Alert.alert("Алдаа", "QPay холбоос олдсонгүй.");
      return;
    }

    try {
      setIsOpeningQpay(true);
      await safelyOpenLink(invoiceUi.deeplink);
    } catch (error: any) {
      setShowManualOpenButton(true);
      Alert.alert("Алдаа", error?.message ?? "QPay нээхэд алдаа гарлаа.");
    } finally {
      setIsOpeningQpay(false);
    }
  }, [invoiceUi]);

  const handlePayment = async () => {
    if (isSubmitting) return;

    if (!user) {
      Alert.alert("Алдаа", "Эхлээд нэвтэрнэ үү.");
      return;
    }

    if (!jobId || !selectedJob) {
      Alert.alert("Алдаа", "Зарын мэдээлэл олдсонгүй.");
      return;
    }

    if (!isOwner) {
      Alert.alert("Алдаа", "Та зөвхөн өөрийн зараа Sponsored болгож болно.");
      return;
    }

    if (alreadySponsored) {
      Alert.alert(
        "Мэдэгдэл",
        sponsoredUntilText
          ? `Энэ зар аль хэдийн Sponsored байна.\nДуусах: ${sponsoredUntilText}`
          : "Энэ зар аль хэдийн Sponsored байна."
      );
      return;
    }

    if (!selectedPlanData) {
      Alert.alert("Алдаа", "Хугацааны багцаа сонгоно уу.");
      return;
    }

    if (shouldShowLowRatingWarning && !lowRatingWarningAccepted) {
      Alert.alert(
        "Анхааруулга",
        `Энэ эд зүйлийн үнэлгээ ${formatRating(itemRatingAvg)}★ байна. Sponsored болгосноор илүү олон хүнд харагдах боловч хэрэглэгчид энэ үнэлгээг мөн харна.\n\nИлүү сайн үр дүн авахын тулд зураг, тайлбар, бүрэн бүтэн байдлаа сайжруулахыг зөвлөж байна.`,
        [
          { text: "Болих", style: "cancel" },
          {
            text: "Үргэлжлүүлэх",
            onPress: () => {
              setLowRatingWarningAccepted(true);
              setTimeout(() => {
                handlePayment();
              }, 80);
            },
          },
        ]
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setShowManualOpenButton(false);

      const ownerId = user?.id ?? getJobOwnerId(selectedJob) ?? "";

      const payload = {
        jobId: String(jobId),
        userId: String(ownerId),
        amount: Number(selectedPlanData.price),
        durationDays: Number(selectedPlanData.durationDays),
      };

      const { data, error } = await supabase.functions.invoke("create-qpay-invoice", {
        body: payload,
      });

      console.log("create-qpay-invoice invoke payload:", payload);
      console.log("create-qpay-invoice invoke result data:", safeJsonStringify(data));
      console.log("create-qpay-invoice invoke result error:", safeJsonStringify(error));

      if (error) {
        const errorBody = await readInvokeError(error);

        console.log(
          "create-qpay-invoice parsed error body:",
          safeJsonStringify(errorBody)
        );

        const readable = buildReadableError(
          errorBody,
          error?.message ?? "Төлбөр эхлүүлэхэд алдаа гарлаа."
        );

        const fullMessage = readable.debugMessage
          ? `${readable.message}\n\n${readable.debugMessage}`
          : readable.message;

        throw new Error(fullMessage);
      }

      if (!data?.success) {
        const readable = buildReadableError(data);
        const fullMessage = readable.debugMessage
          ? `${readable.message}\n\n${readable.debugMessage}`
          : readable.message;

        throw new Error(fullMessage);
      }

      const parsed = extractInvoiceUiData(data);

      if (!parsed) {
        throw new Error("QPay invoice мэдээлэл буруу ирлээ.");
      }

      setInvoiceUi(parsed);

      if (parsed.deeplink) {
        try {
          setIsOpeningQpay(true);
          await safelyOpenLink(parsed.deeplink);
        } catch (openError) {
          console.log("Auto-open QPay failed:", openError);
          setShowManualOpenButton(true);
          Alert.alert(
            "QPay invoice үүслээ",
            "QPay автоматаар нээгдсэнгүй. Доорх QR эсвэл QPay товчийг ашиглана уу."
          );
        } finally {
          setIsOpeningQpay(false);
        }
      } else {
        Alert.alert(
          "QPay invoice үүслээ",
          "QR мэдээлэл бэлэн боллоо. Доор харагдаж байна."
        );
      }
    } catch (error: any) {
      Alert.alert("Алдаа", error?.message ?? "Төлбөр эхлүүлэхэд алдаа гарлаа.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
      edges={["top"]}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Төлбөр төлөлт",
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: "700" as const,
            color: colors.text,
          },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
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
          ),
        }}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={[styles.jobSummaryCard, { backgroundColor: colors.background }]}>
          <Text style={[styles.jobSummaryLabel, { color: colors.textSecondary }]}>
            Сонгосон зар
          </Text>

          <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={2}>
            {selectedJob?.title || selectedJob?.category || "Зар олдсонгүй"}
          </Text>

          {!!selectedJob?.category && (
            <Text style={[styles.jobMeta, { color: colors.textSecondary }]} numberOfLines={1}>
              {selectedJob.category}
            </Text>
          )}

          {selectedJob ? (
            <View style={styles.ratingInfoRow}>
              <View style={[styles.ratingPill, { backgroundColor: colors.backgroundSecondary }]}>
                <Star size={14} color={colors.text} />
                <Text style={[styles.ratingPillText, { color: colors.text }]}>
                  Эд зүйл: {formatRating(itemRatingAvg)}
                  {itemRatingAvg > 0 ? "★" : ""}
                </Text>
              </View>

              <View style={[styles.ratingPill, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.ratingPillText, { color: colors.text }]}>
                  {itemReviewCount} үнэлгээ
                </Text>
              </View>

              <View style={[styles.ratingPill, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.ratingPillText, { color: colors.text }]}>
                  {rentalCount} түрээс
                </Text>
              </View>
            </View>
          ) : null}

          {shouldShowLowRatingWarning ? (
            <View
              style={[
                styles.lowRatingBox,
                {
                  backgroundColor:
                    currentTheme === "navy"
                      ? "rgba(255,184,0,0.12)"
                      : "rgba(255,184,0,0.14)",
                  borderColor:
                    currentTheme === "navy"
                      ? "rgba(255,184,0,0.35)"
                      : "rgba(180,115,0,0.22)",
                },
              ]}
            >
              <AlertTriangle size={18} color="#B47300" />
              <Text style={[styles.lowRatingText, { color: colors.text }]}>
                Энэ эд зүйлийн үнэлгээ 3.0-аас доош байна. Sponsored болгож болох ч хэрэглэгчид үнэлгээг нь харна.
              </Text>
            </View>
          ) : null}

          {alreadySponsored ? (
            <View
              style={[
                styles.alreadySponsoredBox,
                {
                  backgroundColor:
                    currentTheme === "navy"
                      ? "rgba(248,231,93,0.10)"
                      : "rgba(0,0,0,0.04)",
                  borderColor:
                    currentTheme === "navy"
                      ? "rgba(248,231,93,0.22)"
                      : "rgba(0,0,0,0.08)",
                },
              ]}
            >
              <View
                style={[
                  styles.alreadySponsoredBadge,
                  { backgroundColor: buttonBackgroundColor },
                ]}
              >
                <BadgeDollarSign size={18} color={buttonTextColor} strokeWidth={2} />
                <Text style={[styles.alreadySponsoredBadgeText, { color: buttonTextColor }]}>
                  Sponsored зар
                </Text>
              </View>

              {remainingCountdown ? (
                <Text style={[styles.alreadySponsoredCountdown, { color: colors.text }]}>
                  Үлдсэн: {remainingCountdown}
                </Text>
              ) : null}

              {sponsoredUntilText ? (
                <Text style={[styles.alreadySponsoredUntil, { color: colors.textSecondary }]}>
                  Дуусах: {sponsoredUntilText}
                </Text>
              ) : null}
            </View>
          ) : null}

          {!selectedJob ? (
            <Text style={[styles.warningText, { color: "#C83232" }]}>
              Зарын мэдээлэл олдсонгүй.
            </Text>
          ) : !isOwner ? (
            <Text style={[styles.warningText, { color: "#C83232" }]}>
              Та зөвхөн өөрийн зараа Sponsored болгож болно.
            </Text>
          ) : null}
        </View>

        <View style={styles.plansContainer}>
          {SPONSOR_PLANS.map((plan) => {
            const selected = selectedPlan === plan.id;

            return (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: selected ? colors.primary : "transparent",
                  },
                  selected && {
                    backgroundColor: `${colors.primary}10`,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => setSelectedPlan(plan.id)}
                disabled={alreadySponsored || !isOwner || !selectedJob}
              >
                <View style={styles.planHeader}>
                  <View style={styles.planInfo}>
                    <Text style={[styles.planName, { color: colors.text }]}>
                      {plan.name}
                    </Text>
                    <Text style={[styles.planPrice, { color: colors.primary }]}>
                      {plan.price.toLocaleString()}₮
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: colors.textSecondary },
                      selected && {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    {selected && (
                      <Check size={16} color={colors.background} strokeWidth={3} />
                    )}
                  </View>
                </View>

                <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
                  {plan.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedPlanData && (
          <>
            <View style={[styles.summaryContainer, { backgroundColor: colors.background }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                Төлбөр
              </Text>
              <Text style={[styles.summaryAmount, { color: colors.text }]}>
                {selectedPlanData.price.toLocaleString()}₮
              </Text>
              <Text style={[styles.summarySubtext, { color: colors.textSecondary }]}>
                Хугацаа: {selectedPlanData.name}
              </Text>
            </View>

            <View style={styles.paymentMethods}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Төлбөрийн аргаа сонгоно уу
              </Text>

              <TouchableOpacity
                style={[
                  styles.qpayButton,
                  { backgroundColor: colors.background },
                  (!canSubmit || isSubmitting) && styles.qpayButtonDisabled,
                ]}
                activeOpacity={canSubmit ? 0.8 : 1}
                onPress={handlePayment}
                disabled={!canSubmit}
              >
                <Image
                  source={require("../assets/images/qpay.png")}
                  style={styles.qpayLogo}
                  resizeMode="contain"
                />

                <Text style={[styles.qpayText, { color: colors.text }]}>
                  QPay Mongolia
                </Text>

                <Text style={[styles.qpaySubText, { color: colors.textSecondary }]}>
                  {alreadySponsored
                    ? "Энэ зар аль хэдийн Sponsored байна"
                    : !isOwner
                    ? "Зөвхөн өөрийн зар дээр ашиглана"
                    : "QPay-ээр төлбөрөө эхлүүлэх"}
                </Text>

                {isSubmitting ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.text} />
                    <Text style={[styles.loadingText, { color: colors.text }]}>
                      Түр хүлээнэ үү...
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>
          </>
        )}

        {invoiceUi ? (
          <View style={[styles.invoiceCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.invoiceTitle, { color: colors.text }]}>
              QPay invoice бэлэн боллоо
            </Text>

            <Text style={[styles.invoiceSubtext, { color: colors.textSecondary }]}>
              QPay автоматаар нээгдэнэ. Хэрэв нээгдээгүй бол QR ашиглах эсвэл доорх товчоор
              гараар нээнэ үү.
            </Text>

            {invoiceUi.qrImage ? (
              <Image
                source={{ uri: invoiceUi.qrImage }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            ) : null}

            {showManualOpenButton && invoiceUi.deeplink ? (
              <TouchableOpacity
                style={[
                  styles.openQpayButton,
                  { backgroundColor: colors.primary },
                  isOpeningQpay && styles.qpayButtonDisabled,
                ]}
                activeOpacity={0.85}
                onPress={openQpay}
                disabled={isOpeningQpay}
              >
                {isOpeningQpay ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.background} />
                    <Text style={[styles.openQpayButtonText, { color: colors.background }]}>
                      Нээж байна...
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.openQpayButtonText, { color: colors.background }]}>
                    QPay нээх
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}

            {!!invoiceUi.qrText && (
              <View style={[styles.qrTextBox, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.qrTextLabel, { color: colors.textSecondary }]}>
                  QR текст
                </Text>
                <Text style={[styles.qrTextValue, { color: colors.text }]} numberOfLines={6}>
                  {invoiceUi.qrText}
                </Text>
              </View>
            )}

            {!!invoiceUi.senderInvoiceNo && (
              <Text style={[styles.senderInvoiceText, { color: colors.textSecondary }]}>
                Invoice №: {invoiceUi.senderInvoiceNo}
              </Text>
            )}

            <View style={styles.invoiceActions}>
              <TouchableOpacity
                style={[styles.refreshButton, { backgroundColor: colors.backgroundSecondary }]}
                activeOpacity={0.85}
                onPress={() => refreshJobStatus(true)}
                disabled={isRefreshingStatus}
              >
                {isRefreshingStatus ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <RefreshCw size={18} color={colors.text} />
                )}
                <Text style={[styles.refreshButtonText, { color: colors.text }]}>
                  Төлөв шалгах
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryActionButton, { borderColor: `${colors.text}15` }]}
                activeOpacity={0.85}
                onPress={() => {
                  setInvoiceUi(null);
                  setShowManualOpenButton(false);
                }}
              >
                <Text style={[styles.secondaryActionText, { color: colors.text }]}>
                  Хаах
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  logo: { width: 70, height: 32, marginRight: 8 },

  content: { flex: 1 },
  contentContainer: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 40 },

  jobSummaryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  jobSummaryLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    marginBottom: 8,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    marginBottom: 6,
  },
  jobMeta: {
    fontSize: 13,
    fontWeight: "500" as const,
  },
  warningText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "600" as const,
  },

  ratingInfoRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ratingPill: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  ratingPillText: {
    fontSize: 12,
    fontWeight: "700" as const,
  },
  lowRatingBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  lowRatingText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600" as const,
  },

  alreadySponsoredBox: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  alreadySponsoredBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  alreadySponsoredBadgeText: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
  alreadySponsoredCountdown: {
    fontSize: 15,
    fontWeight: "800" as const,
    textAlign: "center",
  },
  alreadySponsoredUntil: {
    fontSize: 12,
    fontWeight: "500" as const,
    textAlign: "center",
  },

  plansContainer: { gap: 12, marginBottom: 24 },

  planCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  planInfo: { flex: 1, gap: 4 },
  planName: { fontSize: 16, fontWeight: "700" as const },
  planPrice: { fontSize: 20, fontWeight: "700" as const },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  planDescription: { fontSize: 13, lineHeight: 20 },

  summaryContainer: {
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryLabel: { fontSize: 14, marginBottom: 8 },
  summaryAmount: { fontSize: 32, fontWeight: "700" as const },
  summarySubtext: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "500" as const,
  },

  paymentMethods: { gap: 16 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    marginBottom: 4,
  },

  qpayButton: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  qpayButtonDisabled: {
    opacity: 0.6,
  },

  qpayLogo: {
    width: 170,
    height: 60,
  },
  qpayText: {
    fontSize: 16,
    fontWeight: "800" as const,
  },
  qpaySubText: {
    fontSize: 13,
    fontWeight: "500" as const,
    textAlign: "center",
  },

  loadingRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },

  invoiceCard: {
    marginTop: 24,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  invoiceTitle: {
    fontSize: 18,
    fontWeight: "800" as const,
    textAlign: "center",
  },
  invoiceSubtext: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  qrImage: {
    width: "100%",
    height: 240,
    alignSelf: "center",
    borderRadius: 12,
  },

  openQpayButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  openQpayButtonText: {
    fontSize: 15,
    fontWeight: "800" as const,
  },

  qrTextBox: {
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  qrTextLabel: {
    fontSize: 12,
    fontWeight: "700" as const,
  },
  qrTextValue: {
    fontSize: 12,
    lineHeight: 18,
  },

  senderInvoiceText: {
    fontSize: 12,
    textAlign: "center",
  },

  invoiceActions: {
    flexDirection: "row",
    gap: 10,
  },
  refreshButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
  secondaryActionButton: {
    minWidth: 88,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: "700" as const,
  },

  bottomPadding: { height: 40 },
});