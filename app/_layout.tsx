// app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { JobsContext } from "@/contexts/JobsContext";
import { AuthContext } from "@/contexts/AuthContext";
import { ThemeContext } from "@/contexts/ThemeContext";

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      <Stack.Screen
        name="browse"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />

      <Stack.Screen
        name="my-jobs"
        options={{
          presentation: "card",
        }}
      />

      <Stack.Screen
        name="location-picker"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_bottom",
        }}
      />
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
