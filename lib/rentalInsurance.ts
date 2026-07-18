export const RENTAL_INSURANCE_RATE_PERCENT = 1;
export const RENTAL_INSURANCE_MINIMUM = 1_000;
export const RENTAL_INSURANCE_MAXIMUM = 15_000;

export type RentalInsuranceStatus =
  | "not_requested"
  | "requester_declined"
  | "owner_declined"
  | "payment_pending_requester"
  | "payment_pending_owner"
  | "insured_requester"
  | "insured_owner";

export function calculateRentalInsurancePremium(totalRentalPrice: unknown) {
  const total = Number(totalRentalPrice);
  if (!Number.isFinite(total) || total <= 0) return 0;

  const percentageAmount = Math.round((total * RENTAL_INSURANCE_RATE_PERCENT) / 100);
  return Math.max(RENTAL_INSURANCE_MINIMUM, Math.min(RENTAL_INSURANCE_MAXIMUM, percentageAmount));
}

export function isRentalInsurancePaid(status: unknown) {
  return status === "insured_requester" || status === "insured_owner";
}

export function isRentalInsurancePaymentPending(status: unknown) {
  return status === "payment_pending_requester" || status === "payment_pending_owner";
}

export function rentalInsurancePayerLabel(status: unknown) {
  if (status === "insured_requester") return "Түрээслэгч төлсөн";
  if (status === "insured_owner") return "Эзэмшигч төлсөн";
  return null;
}
