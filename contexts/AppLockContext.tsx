import createContextHook from "@nkzw/create-context-hook";
import { AppState } from "react-native";
import { useCallback, useEffect, useState } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/contexts/AuthContext";

// SecureStore keys on iOS may only use letters, numbers, '.', '-', and '_'.
const APP_LOCK_KEY = "tureesly_app_lock_enabled";

export const [AppLockContext, useAppLock] = createContextHook(() => {
  const { isAuthenticated, isLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const requestDeviceUnlock = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      throw new Error("Энэ төхөөрөмж Face ID, хурууны хээ эсвэл төхөөрөмжийн түгжээ дэмжихгүй байна.");
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Tureesly нээх",
      cancelLabel: "Болих",
      fallbackLabel: "Утасны PIN ашиглах",
      disableDeviceFallback: false,
    });

    if (!result.success) {
      throw new Error("Төхөөрөмжийн баталгаажуулалт амжилтгүй боллоо.");
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      if (isLoading) return;

      if (!isAuthenticated) {
        if (active) {
          setIsEnabled(false);
          setIsLocked(false);
          setIsReady(true);
        }
        return;
      }

      const stored = await SecureStore.getItemAsync(APP_LOCK_KEY);
      const enabled = stored === "1";
      if (active) {
        setIsEnabled(enabled);
        setIsLocked(enabled);
        setIsReady(true);
      }
    })().catch(() => {
      if (active) setIsReady(true);
    });

    return () => {
      active = false;
    };
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      // iOS shows its permission sheets while the app is "inactive". That is
      // still an in-app interaction, so only lock after the app truly enters
      // the background (for example when the user switches apps).
      const enteredBackground = nextState === "background";
      if (enteredBackground && isAuthenticated && isEnabled) {
        setIsLocked(true);
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated, isEnabled]);

  const unlock = useCallback(async () => {
    await requestDeviceUnlock();
    setIsLocked(false);
  }, [requestDeviceUnlock]);

  const setAppLockEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      await requestDeviceUnlock();
      await SecureStore.setItemAsync(APP_LOCK_KEY, "1");
      setIsEnabled(true);
      setIsLocked(false);
      return;
    }

    await SecureStore.deleteItemAsync(APP_LOCK_KEY);
    setIsEnabled(false);
    setIsLocked(false);
  }, [requestDeviceUnlock]);

  return {
    isAppLockReady: isReady,
    isAppLockEnabled: isEnabled,
    isLocked: isAuthenticated && isEnabled && isLocked,
    unlock,
    setAppLockEnabled,
  };
});