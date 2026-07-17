import { supabase } from "@/lib/supabase";

export type PromotionMetricTarget = "sponsored_job" | "banner";
export type PromotionMetricEvent = "impression" | "click";

export function isSponsoredPromotionActive(job: any): boolean {
  const until = job?.sponsoredUntil ?? job?.sponsored_until ?? null;
  const untilMs = until instanceof Date ? until.getTime() : new Date(until ?? "").getTime();
  const isSponsored = Boolean(job?.isSponsored ?? job?.is_sponsored);
  return isSponsored && Number.isFinite(untilMs) && untilMs > Date.now();
}

export async function recordPromotionMetric(
  targetType: PromotionMetricTarget,
  targetId: string,
  eventType: PromotionMetricEvent,
): Promise<boolean> {
  const id = String(targetId ?? "").trim();
  if (!id) return false;

  try {
    const { data, error } = await supabase.rpc("record_promotion_metric", {
      p_target_type: targetType,
      p_target_id: id,
      p_event_type: eventType,
    });

    if (error) {
      console.log("Promotion metric error:", error.message);
      return false;
    }

    return data === true;
  } catch (error) {
    console.log("Promotion metric exception:", error);
    return false;
  }
}