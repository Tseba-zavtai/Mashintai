import { supabase } from "@/lib/supabase";

export type QPayInvoice = {
  orderId: string;
  amount: number;
  qr_image: string;
  urls: {name: string; logo: string; link: string}[];
};

const messages: Record<string, string> = {
  CANCEL_NOT_READY: 'Нэхэмжлэл хараахан бүрэн үүсээгүй байна. Түр хүлээгээд дахин оролдоно уу.',
  CANCEL_SAVE_FAILED: 'Цуцлалтыг бүртгэж чадсангүй. Нэхэмжлэлээ дахин шалгана уу.',
  PAYMENT_RECONCILIATION_REQUIRED: 'Төлбөрийн дүн зөрүүтэй байна. Цуцлаагүй; тусламжтай холбогдоно уу.',
  LISTING_EXPIRED: "Зарын хугацаа дууссан байна. Эхлээд зарын эрх ашиглан дахин нийтэлнэ үү.",
  LISTING_INACTIVE: "Сонгосон зар дотор идэвхгүй зар байна. Эхлээд идэвхтэй болгоно уу.",
  NO_AVAILABLE_QUANTITY: "Сонгосон зар дотор түрээслүүлэх сул үлдэгдэлгүй зар байна.",
  ALREADY_SPONSORED: "Сонгосон зар дотор Sponsored хугацаа дуусаагүй зар байна.",
  PENDING_PAYMENT: "Сонгосон зарын өмнөх төлбөрийн нэхэмжлэл хүлээгдэж байна.",
  QPAY_NOT_CONFIGURED: "QPay-ийн тохиргоо хараахан бүрдээгүй байна.",
  QPAY_AUTH_FAILED: "QPay-ийн нэвтрэх тохиргоог шалгах шаардлагатай байна.",
  QPAY_REQUEST_FAILED: "QPay-тэй холбогдож чадсангүй. Дахин оролдоно уу.",
  INVOICE_CREATING: "Өмнөх нэхэмжлэл үүсэж байна. Түр хүлээгээд дахин оролдоно уу. Удаан үргэлжилбэл тусламжтай холбогдоорой.",
  RATE_LIMITED: "Түр хүлээгээд дахин оролдоно уу.",
  NOT_YOUR_JOB: "Зөвхөн өөрийн зарын төлбөрийг төлөх боломжтой.",
  UNAUTHORIZED: "Дахин нэвтэрнэ үү.",
  ORDER_NOT_FOUND: "Нэхэмжлэл олдсонгүй.",
};

export async function callQPay<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("qpay-service", { body });
  let result = data;
  if (error?.context instanceof Response) {
    try { result = await error.context.json(); } catch { /* network/invalid response */ }
  }
  if (error || result?.error) {
    throw new Error(messages[result?.error] ?? "Төлбөрийн сервертэй холбогдож чадсангүй. Дахин оролдоно уу.");
  }
  return result as T;
}
