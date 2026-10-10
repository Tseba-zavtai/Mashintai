import { supabase } from '@/lib/supabase';

export function isListingExpired(job: any, now = Date.now()) {
  const expiry = Date.parse(job.listing_expires_at ?? '');
  return Number.isFinite(expiry) && expiry <= now;
}

export async function manageListings(ids: string[], action: 'activate' | 'deactivate' | 'delete') {
  const { error } = await supabase.rpc('manage_own_listings', { p_ids: ids, p_action: action });
  if (!error) return;
  const messages: Record<string, string> = {
    POST_CREDIT_UNAVAILABLE: 'Хугацаа дууссан зар бүрийг дахин нийтлэхэд 1 эрх хэрэгтэй. Бүх сонгосон зарт хүрэлцэх эрхгүй байна.',
    NO_AVAILABLE_QUANTITY: 'Сонгосон зар дотор сул үлдэгдэлгүй зар байна.',
    ACTIVE_RENTAL: 'Түрээсийн хүсэлттэй зар устгах боломжгүй. Идэвхгүй болгож болно.',
    PENDING_PAYMENT: 'Төлбөрийн нэхэмжлэл хүлээгдэж байгаа зар устгах боломжгүй.',
    NOT_YOUR_JOB: 'Зөвхөн өөрийн зарын төлөвийг өөрчилж болно.',
  };
  throw new Error(Object.entries(messages).find(([code]) => error.message.includes(code))?.[1] ?? 'Үйлдэл амжилтгүй. Сонгосон заруудыг өөрчлөөгүй.');
}
