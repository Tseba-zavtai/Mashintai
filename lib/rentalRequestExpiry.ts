export const PENDING_RENTAL_REQUEST_EXPIRY_HOURS = 48;
export const PENDING_RENTAL_REQUEST_EXPIRY_MS =
  PENDING_RENTAL_REQUEST_EXPIRY_HOURS * 60 * 60 * 1000;

type RentalRequestExpirySource = {
  status?: unknown;
  created_at?: unknown;
  expires_at?: unknown;
  expired_at?: unknown;
  jobs?: { is_active?: unknown } | null;
};

function asValidTime(value: unknown): number | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function getRentalRequestExpiryTime(request: RentalRequestExpirySource): number | null {
  const explicitExpiry = asValidTime(request.expires_at);
  if (explicitExpiry !== null) return explicitExpiry;

  const createdAt = asValidTime(request.created_at);
  return createdAt === null ? null : createdAt + PENDING_RENTAL_REQUEST_EXPIRY_MS;
}

export function isRentalRequestExpired(
  request: RentalRequestExpirySource,
  now = Date.now(),
): boolean {
  if (request.status !== "pending") return Boolean(request.expired_at);
  const expiresAt = getRentalRequestExpiryTime(request);
  return expiresAt !== null && expiresAt <= now;
}

export function isRentalRequestActionable(
  request: RentalRequestExpirySource,
  now = Date.now(),
): boolean {
  return request.status === "pending"
    && !isRentalRequestExpired(request, now)
    && request.jobs?.is_active !== false;
}
