/** Login/contact numbers can change; ownership must follow the stable account ID. */
export function isJobOwnedBy(job: any, user: { id?: string; phone?: string } | null | undefined): boolean {
  if (!user) return false;
  const owner = job?.postedBy ?? {};
  const ownerId = owner.id ?? job?.posted_by_id ?? job?.owner_id;
  if (ownerId && user.id) return String(ownerId) === String(user.id);
  // Only legacy rows without an owner ID may fall back to their saved number.
  return Boolean(owner.phone && user.phone && String(owner.phone) === String(user.phone));
}
