// Stable store IDs: independent of the public app name. Create these exact IDs in both consoles.
export const STORE_PRODUCTS = {
  credit: { id: 'mn.tureestei.app.credit1', name: 'Зар оруулах 1 эрх', credits: 1, days: 0 },
  credit2: { id: 'mn.tureestei.app.credit2', name: 'Зар оруулах 2 эрх', credits: 2, days: 0 },
  credit3: { id: 'mn.tureestei.app.credit3', name: 'Зар оруулах 3 эрх', credits: 3, days: 0 },
  bump: { id: 'mn.tureestei.app.Pump', name: 'Зараа дээш гаргах', credits: 0, days: 0 },
  daily: { id: 'mn.tureestei.app.sponsor1', name: '1 хоног онцлох', credits: 0, days: 1 },
  weekly: { id: 'mn.tureestei.app.sponsor2', name: '7 хоног онцлох', credits: 0, days: 7 },
  monthly: { id: 'mn.tureestei.app.sponsor3', name: '30 хоног онцлох', credits: 0, days: 30 },
} as const;
export type StorePlan = keyof typeof STORE_PRODUCTS;
export const STORE_PRODUCT_IDS = Object.values(STORE_PRODUCTS).map(p => p.id);
export function storeProductId(plan: StorePlan, platform: string): string {
  return platform === 'android' && plan === 'bump' ? 'mn.tureestei.app.bump' : STORE_PRODUCTS[plan].id;
}
export function storeProductIds(platform: string): string[] {
  return (Object.keys(STORE_PRODUCTS) as StorePlan[]).map(plan => storeProductId(plan, platform));
}
export function storePlanForProduct(productId: string, platform = 'ios'): StorePlan | undefined {
  return (Object.keys(STORE_PRODUCTS) as StorePlan[]).find(key => storeProductId(key, platform) === productId);
}
