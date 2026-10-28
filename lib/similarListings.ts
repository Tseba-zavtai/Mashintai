type Listing = Record<string, any>;
const text = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase();
const sameField = (a: Listing, b: Listing, id: string, name: string) => {
  if (a[id] && b[id]) return a[id] === b[id];
  return !!text(a[name]) && text(a[name]) === text(b[name]);
};
function distance(a: Listing, b: Listing): number {
  const x = a.location, y = b.location;
  if (![x?.latitude, x?.longitude, y?.latitude, y?.longitude].every(v => typeof v === 'number' && Number.isFinite(v))) return Infinity;
  const rad = Math.PI / 180;
  const h = Math.sin((y.latitude-x.latitude)*rad/2)**2 + Math.cos(x.latitude*rad)*Math.cos(y.latitude*rad)*Math.sin((y.longitude-x.longitude)*rad/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

/** Contextual alternatives only: no account, search history or popularity needed. */
export function getSimilarListings<T extends Listing>(current: T | undefined, listings: T[], limit = 8, now = Date.now()): T[] {
  if (!current) return [];
  const seen = new Set([String(current.id)]);
  return listings.filter(item => {
    const id = String(item.id ?? '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    if (item.isActive === false || item.is_active === false || item.is_deleted || item.isDeleted || item.is_hidden || item.isHidden || item.is_expired || item.isExpired) return false;
    if (item.listing_expires_at && Date.parse(item.listing_expires_at) <= now) return false;
    const available = item.available_quantity ?? item.availableQuantity;
    if (available != null && Number(available) <= 0) return false;
    if ((current.postType ?? current.post_type ?? 'job') !== (item.postType ?? item.post_type ?? 'job')) return false;
    return sameField(current, item, 'category_id', 'category');
  }).map(item => {
    const sameSubcategory = sameField(current, item, 'subcategory_id', 'subcategory');
    const km = distance(current, item);
    const p = Number(current.price), q = Number(item.price);
    const sameUnit = (current.price_type ?? current.priceType ?? 'daily') === (item.price_type ?? item.priceType ?? 'daily');
    const priceScore = sameUnit && p > 0 && q > 0 ? 20 * Math.min(p,q)/Math.max(p,q) : 0;
    return { item, score: (sameSubcategory ? 100 : 0) + (Number.isFinite(km) ? 20/(1+km/5) : 0) + priceScore };
  }).sort((a,b) => b.score-a.score || String(a.item.id).localeCompare(String(b.item.id)))
    .slice(0, Math.max(0, limit)).map(row => row.item);
}
