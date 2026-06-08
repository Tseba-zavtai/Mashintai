import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "@/contexts/AuthContext";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDiff(ms: number) {
  const secTotal = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(secTotal / (3600 * 24));
  const hours = Math.floor((secTotal % (3600 * 24)) / 3600);
  const mins = Math.floor((secTotal % 3600) / 60);
  const secs = secTotal % 60;
  return `${days} өдөр ${pad2(hours)} цаг ${pad2(mins)} минут ${pad2(secs)} секунд`;
}

export default function SponsorCountdown() {
  const { user, isSponsoredActive, isSponsoredScheduled, refetchProfile } = useAuth() as any;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const status = useMemo(() => {
    const fromIso = user?.sponsoredFrom ?? user?.sponsored_from ?? null;
    const untilIso = user?.sponsoredUntil ?? user?.sponsored_until ?? null;

    if (!fromIso || !untilIso) {
      return { kind: "none" as const };
    }

    const now = Date.now();
    const from = new Date(fromIso).getTime();
    const until = new Date(untilIso).getTime();

    if (Number.isNaN(from) || Number.isNaN(until)) {
      return { kind: "none" as const };
    }

    if (now < from) {
      return { kind: "scheduled" as const, ms: from - now, fromIso, untilIso };
    }

    if (now >= from && now < until) {
      return { kind: "active" as const, ms: until - now, fromIso, untilIso };
    }

    return { kind: "expired" as const, fromIso, untilIso };
  }, [user, tick, isSponsoredActive, isSponsoredScheduled]);

  // optional: хугацаа дууссан үед profile нэг удаа refresh
  useEffect(() => {
    if (status.kind === "expired") {
      refetchProfile?.().catch(() => {});
    }
  }, [status.kind]);

  if (status.kind === "none") return null;

  return (
    <View style={styles.card}>
      {status.kind === "active" && (
        <>
          <Text style={styles.title}>⭐ Sponsored идэвхтэй</Text>
          <Text style={styles.label}>Дуусах хүртэл:</Text>
          <Text style={styles.value}>{formatDiff(status.ms)}</Text>
        </>
      )}

      {status.kind === "scheduled" && (
        <>
          <Text style={styles.title}>⭐ Sponsored төлөвлөгдсөн</Text>
          <Text style={styles.label}>Эхлэх хүртэл:</Text>
          <Text style={styles.value}>{formatDiff(status.ms)}</Text>
        </>
      )}

      {status.kind === "expired" && (
        <>
          <Text style={styles.title}>⭐ Sponsored дууссан</Text>
          <Text style={styles.label}>Одоогоор идэвхгүй байна</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", marginBottom: 6 },
  label: { fontSize: 12, fontWeight: "600", color: "#666" },
  value: { fontSize: 14, fontWeight: "700", color: "#1a1a1a", marginTop: 6 },
});
