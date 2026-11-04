import { supabase } from '@/lib/supabase';

const messages: Record<string, string> = {
  STORE_NOT_CONFIGURED: 'Дэлгүүрийн төлбөрийн тохиргоо хараахан бэлэн болоогүй байна. Төлбөр аваагүй.',
  STORE_VERIFICATION_FAILED: 'Дэлгүүртэй холбогдож төлбөрийг шалгаж чадсангүй. Худалдан авалтаа дахин хийхгүйгээр төлөвийг дахин шалгаарай.',
  INVALID_PURCHASE: 'Энэ худалдан авалтыг баталгаажуулж чадсангүй.',
  TEST_PURCHASE_NOT_ALLOWED: 'Туршилтын худалдан авалтыг энэ сервер хүлээн авахгүй байна.',
  TEST_ACCOUNT_REQUIRED: 'Төлбөр одоогоор зөвхөн зөвшөөрсөн туршилтын хэрэглэгчид нээлттэй байна.',
  REAL_PURCHASES_DISABLED: 'Бодит төлбөрийн баталгаажуулалт хаалттай байна. Тест төлбөрийн account-аар шалгана уу; мөнгө суутгагдсан бол дахин төлөхгүйгээр тусламжтай холбогдоорой.',
  NOT_YOUR_JOB: 'Сонгосон зар олдсонгүй эсвэл таны зар биш байна. Төлбөр хийсэн бол тусламжтай холбогдоорой.',
  LISTING_EXPIRED: 'Зарын хугацаа дууссан байна. Эхлээд дахин нийтэлнэ үү.',
  LISTING_INACTIVE: 'Эхлээд зараа идэвхтэй болгоно уу.',
  NO_AVAILABLE_QUANTITY: 'Түрээслүүлэх сул үлдэгдэлгүй зар байна.',
  ALREADY_SPONSORED: 'Энэ зарын онцлох хугацаа дуусаагүй байна.',
  RATE_LIMITED: 'Түр хүлээгээд дахин оролдоно уу.',
  PURCHASE_MISMATCH: 'Худалдан авалт энэ хэрэглэгчийн захиалгатай таарахгүй байна.',
  PURCHASE_ALREADY_USED: 'Энэ худалдан авалт өмнө нь бүртгэгдсэн байна.',
  PURCHASE_REFUNDED: 'Энэ төлбөр буцаагдсан байна. Худалдан авалтаа дахин сэргээхгүй; зөрүүтэй бол тусламжтай холбогдоорой.',
  UNAUTHORIZED: 'Худалдан авалт хийсэн хэрэглэгчээрээ дахин нэвтэрнэ үү.',
};
export async function callStorePayments<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('store-purchases', { body });
  let result = data;
  if (error?.context instanceof Response) {
    try { result = await error.context.json(); } catch { /* Show a safe error, never assume paid. */ }
  }
  if (error || result?.error) throw new Error(messages[result?.error] ?? 'Төлбөрийг серверээр баталгаажуулж чадсангүй. Дахин худалдан авахын өмнө төлөвөө шалгаарай.');
  return result as T;
}
