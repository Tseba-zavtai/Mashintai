import { supabase } from "@/lib/supabase";

export type ContactPhone = {
  id: string;
  user_id: string;
  phone: string;
  label: string | null;
  is_default: boolean;
  created_at: string;
};

export function normalizeContactPhone(value: string): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  const local = digits.startsWith("976") ? digits.slice(3) : digits;
  return /^\d{8}$/.test(local) ? `+976${local}` : null;
}

export async function loadContactPhones(userId: string): Promise<ContactPhone[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("user_contact_phones")
    .select("id,user_id,phone,label,is_default,created_at")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ContactPhone[];
}

export async function loadDefaultContactPhone(userId: string): Promise<string | null> {
  const phones = await loadContactPhones(userId);
  return phones.find((phone) => phone.is_default)?.phone ?? phones[0]?.phone ?? null;
}

export async function addContactPhone(userId: string, rawPhone: string, rawLabel?: string): Promise<ContactPhone> {
  const phone = normalizeContactPhone(rawPhone);
  if (!phone) throw new Error("Холбоо барих утас 8 оронтой байна.");

  const existing = await loadContactPhones(userId);
  const alreadySaved = existing.find((item) => item.phone === phone);
  if (alreadySaved) return alreadySaved;

  const label = rawLabel?.trim() || "Холбоо барих";
  const { data, error } = await supabase
    .from("user_contact_phones")
    .insert({ user_id: userId, phone, label, is_default: existing.length === 0 })
    .select("id,user_id,phone,label,is_default,created_at")
    .single();

  if (error) throw error;
  return data as ContactPhone;
}

export async function makeDefaultContactPhone(userId: string, phoneId: string): Promise<void> {
  const { error: clearError } = await supabase
    .from("user_contact_phones")
    .update({ is_default: false })
    .eq("user_id", userId)
    .eq("is_default", true);
  if (clearError) throw clearError;

  const { error } = await supabase
    .from("user_contact_phones")
    .update({ is_default: true })
    .eq("id", phoneId)
    .eq("user_id", userId);
  if (error) throw error;
}
