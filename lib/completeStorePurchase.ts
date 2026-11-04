/** Keep verification-before-consumption explicit and independently testable. */
export async function completeStorePurchase<T>(purchase: T, verify: (purchase: T) => Promise<{ granted: boolean }>,
  finish: (purchase: T) => Promise<void>): Promise<void> {
  const result = await verify(purchase);
  if (result.granted !== true) throw new Error('Төлбөр хараахан баталгаажаагүй байна.');
  await finish(purchase);
}
