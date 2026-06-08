import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

const USER_STORAGE_KEY = "@user_data";
const ADMIN_UNLOCKED_KEY = "@admin_unlocked";

const ADMIN_PANEL_PASSWORD = "Tseba0114*";

const normalizePhone = (phone: string) => {
  const digits = String(phone ?? "").replace(/[^\d]/g, "");

  if (!digits) return "";

  if (digits.startsWith("976")) {
    return `+${digits}`;
  }

  if (digits.length === 8) {
    return `+976${digits}`;
  }

  return String(phone ?? "").trim();
};

const phoneToEmail = (phone: string) => {
  const normalizedPhone = normalizePhone(phone);
  const digits = normalizedPhone.replace(/[^\d]/g, "").trim();

  if (!digits) {
    throw new Error("Утасны дугаар буруу байна.");
  }

  return `u${digits}@example.com`.toLowerCase();
};

export interface User {
  id?: string;
  phone: string;
  name?: string;
  photoUri?: string;
  isSuperAdmin?: boolean;
  sponsoredFrom?: string | null;
  sponsoredUntil?: string | null;
  lastActiveAt?: string | null;
}

type DbUserRow = {
  id: string;
  phone: string | null;
  name: string | null;
  photo_uri: string | null;
  is_super_admin: boolean | null;
  sponsored_from: string | null;
  sponsored_until: string | null;
  last_active_at: string | null;
};

function mapProfileRowToUser(data: DbUserRow, fallbackPhone?: string): User {
  return {
    id: data.id,
    phone: data.phone ?? fallbackPhone ?? "",
    name: data.name ?? undefined,
    photoUri: data.photo_uri ?? undefined,
    isSuperAdmin: data.is_super_admin === true,
    sponsoredFrom: data.sponsored_from ?? null,
    sponsoredUntil: data.sponsored_until ?? null,
    lastActiveAt: data.last_active_at ?? null,
  };
}

export const [AuthContext, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);

  const mountedRef = useRef(true);

  const persistUser = useCallback(async (profile: User | null) => {
    if (profile) {
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
    } else {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
    }
  }, []);

  const resetAdminUnlock = useCallback(async () => {
    await AsyncStorage.setItem(ADMIN_UNLOCKED_KEY, "false");
    if (mountedRef.current) {
      setIsAdminUnlocked(false);
    }
  }, []);

  const clearLocalAuthState = useCallback(async () => {
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    await AsyncStorage.setItem(ADMIN_UNLOCKED_KEY, "false");

    if (mountedRef.current) {
      setUser(null);
      setIsAdminUnlocked(false);
    }
  }, []);

  const fetchProfile = useCallback(
    async (uid: string, fallbackPhone?: string) => {
      const normalizedFallbackPhone = fallbackPhone
        ? normalizePhone(fallbackPhone)
        : undefined;

      const { data, error } = await supabase
        .from("users")
        .select(
          "id, phone, name, photo_uri, is_super_admin, sponsored_from, sponsored_until, last_active_at"
        )
        .eq("id", uid)
        .single<DbUserRow>();

      if (error || !data) {
        if (normalizedFallbackPhone) {
          const upsertRes = await supabase.from("users").upsert(
            {
              id: uid,
              phone: normalizedFallbackPhone,
            },
            { onConflict: "id" }
          );

          if (upsertRes.error) {
            throw upsertRes.error;
          }
        }

        const retry = await supabase
          .from("users")
          .select(
            "id, phone, name, photo_uri, is_super_admin, sponsored_from, sponsored_until, last_active_at"
          )
          .eq("id", uid)
          .single<DbUserRow>();

        if (retry.error || !retry.data) {
          throw retry.error ?? new Error("Хэрэглэгчийн мэдээлэл олдсонгүй.");
        }

        const profile = mapProfileRowToUser(retry.data, normalizedFallbackPhone);
        await persistUser(profile);

        if (mountedRef.current) {
          setUser(profile);
        }

        return profile;
      }

      const profile = mapProfileRowToUser(data, normalizedFallbackPhone);
      await persistUser(profile);

      if (mountedRef.current) {
        setUser(profile);
      }

      return profile;
    },
    [persistUser]
  );

  const touchLastActive = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const uid = session?.user?.id;
    if (!uid) return;

    await supabase
      .from("users")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", uid);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      try {
        const [storedUser, storedAdminUnlocked] = await Promise.all([
          AsyncStorage.getItem(USER_STORAGE_KEY),
          AsyncStorage.getItem(ADMIN_UNLOCKED_KEY),
        ]);

        if (mountedRef.current) {
          setIsAdminUnlocked(storedAdminUnlocked === "true");

          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser));
            } catch {
              setUser(null);
            }
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user?.id) {
          await clearLocalAuthState();
          return;
        }

        const uid = session.user.id;
        const phoneFromMeta =
          (session.user.user_metadata as any)?.phone ||
          (session.user.user_metadata as any)?.phone_number;

        await fetchProfile(uid, phoneFromMeta);
        await touchLastActive();
      } catch {
        await clearLocalAuthState();
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;

      if (event === "SIGNED_OUT" || !session?.user?.id) {
        await clearLocalAuthState();
        return;
      }

      const uid = session.user.id;
      const phoneFromMeta =
        (session.user.user_metadata as any)?.phone ||
        (session.user.user_metadata as any)?.phone_number;

      try {
        await fetchProfile(uid, phoneFromMeta);
        await touchLastActive();
      } catch {
        // keep current state
      }
    });

    return () => {
      mountedRef.current = false;
      sub.subscription.unsubscribe();
    };
  }, [clearLocalAuthState, fetchProfile, touchLastActive]);

  const register = useCallback(
    async (phone: string, password: string) => {
      const normalizedPhone = normalizePhone(phone);
      const email = phoneToEmail(normalizedPhone);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            phone: normalizedPhone,
            phone_number: normalizedPhone,
          },
        },
      });

      if (error) {
        if (
          String(error.message || "").toLowerCase().includes("email logins are disabled")
        ) {
          throw new Error(
            "Supabase дээр Email provider унтраалттай байна. Энэ auth бүтэц нь дотроо email/password ашигладаг тул Email provider-аа асаана уу."
          );
        }
        throw error;
      }

      const uid = data.user?.id;
      if (!uid) {
        throw new Error("Хэрэглэгч үүсгэсэнгүй. Дахин оролдоно уу.");
      }

      await fetchProfile(uid, normalizedPhone);
      await resetAdminUnlock();
      await touchLastActive();
    },
    [fetchProfile, resetAdminUnlock, touchLastActive]
  );

  const login = useCallback(
    async (phone: string, password: string) => {
      const normalizedPhone = normalizePhone(phone);
      const email = phoneToEmail(normalizedPhone);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const message = String(error.message || "").toLowerCase();

        if (message.includes("email logins are disabled")) {
          throw new Error(
            "Supabase дээр Email provider унтраалттай байна. Энэ auth бүтэц нь утасны дугаарыг hidden email болгож нэвтэрдэг тул Email provider-аа асаана уу."
          );
        }

        if (message.includes("invalid login credentials")) {
          throw new Error("Утасны дугаар эсвэл нууц үг буруу байна.");
        }

        throw error;
      }

      const uid = data.user?.id;
      if (!uid) {
        throw new Error("Хэрэглэгчийн ID олдсонгүй. Дахин оролдоно уу.");
      }

      if (!data.session) {
        throw new Error("Session үүссэнгүй. Дахин нэвтэрнэ үү.");
      }

      await fetchProfile(uid, normalizedPhone);
      await touchLastActive();
    },
    [fetchProfile, touchLastActive]
  );

  const resetPassword = useCallback(
    async (_phone: string, _newPassword: string) => {
      throw new Error(
        "Одоогийн AuthContext бүтэц нь phone→hidden email/password auth ашиглаж байна. Logged-out хэрэглэгчийн нууц үгийг зөвхөн OTP-оор шууд солихын тулд тусдаа recovery flow эсвэл server function хэрэгтэй."
      );
    },
    []
  );

  const updateProfile = useCallback(
    async (d: { name?: string; photoUri?: string }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const uid = session?.user?.id;
      if (!uid) {
        throw new Error("Нэвтрээгүй байна.");
      }

      const updates: Record<string, any> = {};
      if (d.name !== undefined) updates.name = d.name;
      if (d.photoUri !== undefined) updates.photo_uri = d.photoUri;

      const { error } = await supabase.from("users").update(updates).eq("id", uid);
      if (error) throw error;

      await fetchProfile(uid, user?.phone);
      await touchLastActive();
    },
    [fetchProfile, touchLastActive, user?.phone]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const phone = user?.phone;
      if (!session?.user?.id || !phone) {
        throw new Error("Нэвтрээгүй байна.");
      }

      const email = phoneToEmail(phone);

      const reauth = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (reauth.error) {
        throw new Error("Одоогийн нууц үг буруу байна.");
      }

      const updateRes = await supabase.auth.updateUser({ password: newPassword });
      if (updateRes.error) throw updateRes.error;

      await touchLastActive();
    },
    [touchLastActive, user?.phone]
  );

  const unlockAdmin = useCallback(
    async (password: string) => {
      if (!user?.isSuperAdmin) {
        throw new Error("Та админ эрхгүй байна.");
      }

      if (password !== ADMIN_PANEL_PASSWORD) {
        throw new Error("Admin panel password буруу байна.");
      }

      await AsyncStorage.setItem(ADMIN_UNLOCKED_KEY, "true");
      if (mountedRef.current) {
        setIsAdminUnlocked(true);
      }
    },
    [user?.isSuperAdmin]
  );

  const lockAdmin = useCallback(async () => {
    await AsyncStorage.setItem(ADMIN_UNLOCKED_KEY, "false");
    if (mountedRef.current) {
      setIsAdminUnlocked(false);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const uid = session?.user?.id;
    if (!uid) {
      throw new Error("Нэвтрээгүй байна.");
    }

    const del = await supabase.from("users").delete().eq("id", uid);
    if (del.error) throw del.error;

    await supabase.auth.signOut();
    await clearLocalAuthState();
  }, [clearLocalAuthState]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    await clearLocalAuthState();
  }, [clearLocalAuthState]);

  const refetchProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const uid = session?.user?.id;
    if (!uid) return null;

    const profile = await fetchProfile(uid, user?.phone);
    await touchLastActive();
    return profile;
  }, [fetchProfile, touchLastActive, user?.phone]);

  const now = Date.now();

  const sponsoredActive = useMemo(() => {
    if (!user?.sponsoredFrom || !user?.sponsoredUntil) return false;

    const from = new Date(user.sponsoredFrom).getTime();
    const until = new Date(user.sponsoredUntil).getTime();

    if (Number.isNaN(from) || Number.isNaN(until)) return false;
    return now >= from && now < until;
  }, [now, user?.sponsoredFrom, user?.sponsoredUntil]);

  const sponsoredStartsIn = useMemo(() => {
    if (!user?.sponsoredFrom) return false;

    const from = new Date(user.sponsoredFrom).getTime();
    if (Number.isNaN(from)) return false;

    return now < from;
  }, [now, user?.sponsoredFrom]);

  return {
    user,
    isLoading,

    register,
    login,
    logout,
    resetPassword,
    updateProfile,

    changePassword,
    deleteAccount,

    isAuthenticated: user !== null,
    isSuperAdmin: user?.isSuperAdmin === true,

    isAdminUnlocked,
    unlockAdmin,
    lockAdmin,

    isSponsoredActive: sponsoredActive,
    isSponsoredScheduled: sponsoredStartsIn,

    refetchProfile,
  };
});