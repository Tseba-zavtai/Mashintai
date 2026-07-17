// app/_layout.tsx
import React, { useEffect } from "react";
import { router, Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Platform } from "react-native";
import { JobsContext } from "@/contexts/JobsContext";
import { AuthContext, useAuth } from "@/contexts/AuthContext";
import { ThemeContext } from "@/contexts/ThemeContext";
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from "@/lib/supabase";

const queryClient = new QueryClient();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, 
    shouldShowList: true,   
  }),
});

async function registerForPushNotificationsAsync() {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F71',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push notification-ийн эрх олгогдсонгүй!');
      return;
    }
    
    try {
      token = (await Notifications.getExpoPushTokenAsync({ 
        projectId: "40307900-5fec-4877-a667-4813c7e8c7bb" 
      })).data;
    } catch (error) {
      console.log("Push token авахад алдаа гарлаа:", error);
    }
  } else {
    console.log('Эмуляторт push token үүсэх боломжгүй');
  }

  return token;
}

function useNotificationObserver() {
  useEffect(() => {
    const openNotificationTarget = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        router.push(url as any);
      }
    };

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification) {
      openNotificationTarget(lastResponse.notification);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotificationTarget(response.notification);
    });

    return () => subscription.remove();
  }, []);
}
function RootLayoutNav() {
  const { isAuthenticated, isLoading, user } = useAuth();
  useNotificationObserver();

  useEffect(() => {
    async function setupNotifications() {
      if (isAuthenticated && user?.id) {
        const token = await registerForPushNotificationsAsync();
        
        if (token) {
          // 🎯 ЗАСВАР: Хэрэглэгчийн токен хадгалах хүснэгтийг 'users' болгож засав (Баазын бүтэцтэй уялдуулав)
          const { error } = await supabase
            .from('users') 
            .update({ expo_push_token: token })
            .eq('id', user.id);
            
          if (error) {
            console.log("Token бааз руу хадгалахад алдаа:", error.message);
          } else {
            console.log("Глобал систем дээр Push Token бүртгэгдлээ:", token);
          }
        }
      }
    }

    if (!isLoading) {
      setupNotifications();
    }
  }, [isAuthenticated, isLoading, user?.id]);

  return (
    <Stack 
      screenOptions={{ 
        headerShown: false, 
        animation: "slide_from_right" 
      }}
    >
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="payment" options={{ headerShown: false }} />
      <Stack.Screen name="review" options={{ headerShown: false }} />
      <Stack.Screen name="browse" options={{ headerShown: false }} />
      <Stack.Screen name="my-jobs" options={{ headerShown: false }} />
      <Stack.Screen name="help" options={{ headerShown: false }} />
      <Stack.Screen name="location-picker" options={{ headerShown: false, animation: "slide_from_bottom" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeContext>
          <AuthContext>
            <JobsContext>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <RootLayoutNav />
              </GestureHandlerRootView>
            </JobsContext>
          </AuthContext>
        </ThemeContext>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}