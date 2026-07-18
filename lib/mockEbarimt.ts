import { supabase } from "@/lib/supabase";

export type PaidServiceType = "post_credit" | "bump" | "sponsored";

export type MockEbarimtReceipt = {
  payment_id: string;
  receipt_id: string;
  receipt_no: string;
  service_name: string;
  amount: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  issued_at: string;
};

export const EBARIMT_MODE = "mock" as const;

export async function recordMockServicePaymentAndReceipt(params: {
  serviceType: PaidServiceType;
  serviceName: string;
  amount: number;
  referenceId?: string | null;
}) {
  const { data, error } = await supabase.rpc("record_mock_service_payment_and_receipt", {
    p_service_type: params.serviceType,
    p_service_name: params.serviceName,
    p_amount: params.amount,
    p_reference_id: params.referenceId ?? null,
  });
  if (error) throw error;

  const receipt = Array.isArray(data) ? data[0] : data;
  if (!receipt?.receipt_no) throw new Error("Mock Ebarimt баримт үүссэнгүй.");
  return receipt as MockEbarimtReceipt;
}
