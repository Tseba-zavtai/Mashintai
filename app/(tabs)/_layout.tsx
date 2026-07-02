// app/(tabs)/_layout.tsx
import { Tabs, useRouter } from "expo-router";
import { Home, PlusCircle, MapPin, User, Shield, Bell } from "lucide-react-native";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useJobs } from "@/contexts/JobsContext";

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, isLoading, user, isAdminUnlocked } = useAuth();
  const { rentalRequests } = useJobs();

  // 🎯 ЗАСВАР: Зөвхөн тухайн хэрэглэгч өөрөө барааны эзэн (owner_id) бөгөөд 
  // хүлээгдэж байгаа (pending) хүсэлтүүдийг л улаан тоонд тоолно. 
  // Илгээгч хэрэглэгчид улаан тоо асаж гацахгүй.
  const pendingCount = rentalRequests?.filter((req: any) => 
    req.status === "pending" && req.owner_id === user?.id
  ).length || 0;

  const goToAuth = () => router.replace("/auth");

  return (
    <Tabs
      screenOptions={{
        headerShown: false, 
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background, 
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Нүүр",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="post"
        options={{
          title: "Нэмэх",
          tabBarIcon: ({ color, size }) => <PlusCircle color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="location"
        options={{
          title: "Байршил",
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="rental-requests"
        options={{
          title: "Мэдэгдэл",
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#FF3B30", color: "#FFFFFF", fontSize: 10 },
        }}
        listeners={{
          tabPress: (e) => {
            if (isLoading) return;
            if (!isAuthenticated) {
              e.preventDefault();
              goToAuth();
            }
          },
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Профайл",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
        listeners={{
          tabPress: (e) => {
            if (isLoading) return;
            if (!isAuthenticated) {
              e.preventDefault();
              goToAuth();
            }
          },
        }}
      />

      {isAuthenticated && user?.isSuperAdmin && isAdminUnlocked && (
        <Tabs.Screen
          name="admin"
          options={{
            title: "Admin",
            tabBarIcon: ({ color, size }) => <Shield color={color} size={size} />,
          }}
        />
      )}
    </Tabs>
  );
}