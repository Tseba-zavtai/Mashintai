import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type * as Store from 'expo-iap';
import { useAuth } from '@/contexts/AuthContext';
import { useJobs } from '@/contexts/JobsContext';
import { storeProductId, storeProductIds, storePlanForProduct, type StorePlan } from '@/lib/storeProducts';
import { callStorePayments } from '@/lib/storePayments';
import { completeStorePurchase } from '@/lib/completeStorePurchase';

type Completion = { sequence: number; productId: string };
type Value = {
  ready: boolean; busy: boolean; hasPendingPurchase: boolean; error: string | null; prices: Record<string, string>;
  completed: Completion | null; buy: (plan: StorePlan, jobId?: string) => Promise<void>;
  recover: () => Promise<void>;
};
const Context = createContext<Value | null>(null);
export function StorePurchaseProvider({ children }: { children: React.ReactNode }) {
  const { user, refetchProfile } = useAuth();
  const { loadJobs } = useJobs();
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Completion | null>(null);
  const pendingKeys = useRef(new Set<string>());
  const [hasPendingPurchase, setHasPendingPurchase] = useState(false);
  const state = useRef({ userId: user?.id, refetchProfile, loadJobs });
  state.current = { userId: user?.id, refetchProfile, loadJobs };
  const api = useRef<typeof Store | null>(null);
  const products = useRef<Store.Product[]>([]);
  const processing = useRef(new Set<string>()), recovering = useRef(false), buying = useRef(false);
  const processPurchase = useRef<(purchase: Store.Purchase) => Promise<void>>(async () => {});
  processPurchase.current = async purchase => {
    if (!state.current.userId || !api.current || !storePlanForProduct(purchase.productId, Platform.OS)) return;
    const key = `${Platform.OS}:${purchase.id}`;
    pendingKeys.current.add(key); setHasPendingPurchase(true);
    if (purchase.purchaseState !== 'purchased') {
      setError('Төлбөр дэлгүүрийн баталгаажуулалт хүлээж байна. Дахин худалдан авахгүйгээр төлөвөө шалгаарай.');
      buying.current = false; setBusy(false); return;
    }
    if (processing.current.has(key)) return;
    processing.current.add(key);
    try {
      // The signed store receipt carries the durable server-side intent. No local storage mapping needed.
      await completeStorePurchase(purchase, p => callStorePayments<{ granted: boolean }>({ action: 'verify', platform: Platform.OS,
        productId: p.productId,
        transactionId: 'transactionId' in p ? p.transactionId : p.id,
        purchaseToken: p.purchaseToken,
      }), p => api.current!.finishTransaction({ purchase: p, isConsumable: true }));
      // Finish/consume ONLY after the server has committed the entitlement. Retry is idempotent.
      pendingKeys.current.delete(key); setHasPendingPurchase(pendingKeys.current.size > 0);
      await Promise.allSettled([state.current.refetchProfile(), state.current.loadJobs()]);
      setError(null);
      setCompleted(previous => ({ sequence: (previous?.sequence ?? 0) + 1, productId: purchase.productId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Төлбөрийг баталгаажуулж чадсангүй. Төлөв дахин шалгах товчийг ашиглаарай.');
      // Do not acknowledge/consume failed verification. The store will redeliver on recovery.
    } finally { processing.current.delete(key); buying.current = false; setBusy(false); }
  };
  const recover = async () => {
    if (!api.current || !state.current.userId || recovering.current) return;
    recovering.current = true;
    setIsRecovering(true);
    try {
      setError(null);
      // Consumables disappear from current entitlements; explicitly recover unfinished StoreKit transactions.
      const purchases = Platform.OS === 'ios' ? await api.current.getPendingTransactionsIOS()
        : await api.current.getAvailablePurchases();
      for (const purchase of purchases) await processPurchase.current(purchase);
    } catch { setError('Дэлгүүрээс хүлээгдэж буй төлбөрүүдийг авч чадсангүй. Дахин шалгаарай.'); }
    finally { recovering.current = false; setIsRecovering(false); }
  };
  const recoverRef = useRef(recover); recoverRef.current = recover;
  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    let disposed = false;
    let purchaseListener: { remove: () => void } | undefined, errorListener: { remove: () => void } | undefined;
    let foreground: { remove: () => void } | undefined;
    void (async () => {
      try {
        const store = await import('expo-iap');
        if (disposed) return;
        api.current = store;
        purchaseListener = store.purchaseUpdatedListener(p => { void processPurchase.current(p); });
        errorListener = store.purchaseErrorListener(e => {
          buying.current = false; setBusy(false);
          if (e.code === store.ErrorCode.UserCancelled) setError(null);
          else setError('Худалдан авалт дуусаагүй. Төлөвөө шалгаад дахин оролдоорой.');
        });
        const connected = await store.initConnection();
        if (disposed || !connected) return;
        const result = await store.fetchProducts({ skus: storeProductIds(Platform.OS), type: 'in-app' });
        if (disposed) return;
        products.current = (result ?? []).filter(p => p.type === 'in-app') as Store.Product[];
        setPrices(Object.fromEntries(products.current.map(p => [p.id, p.displayPrice])));
        setReady(true);
        await recoverRef.current();
        if (!disposed) foreground = AppState.addEventListener('change', status => { if (status === 'active') void recoverRef.current(); });
      } catch {
        if (!disposed) setError('Дэлгүүрийн төлбөртэй холбогдож чадсангүй. Шинэ native build болон дэлгүүрийн бүтээгдэхүүний тохиргоо шаардлагатай.');
      }
    })();
    return () => {
      disposed = true; purchaseListener?.remove(); errorListener?.remove(); foreground?.remove();
      const store = api.current; api.current = null;
      if (store) void store.endConnection().catch(() => {});
    };
  }, []);
  useEffect(() => { if (user?.id && ready) void recoverRef.current(); }, [user?.id, ready]);
  const buy = async (plan: StorePlan, jobId?: string) => {
    if (buying.current) return;
    if (recovering.current) throw new Error('Өмнөх төлбөрийн төлөвийг шалгаж байна. Түр хүлээнэ үү.');
    if (pendingKeys.current.size > 0) throw new Error('Өмнөх дэлгүүрийн худалдан авалтаа эхлээд дахин шалгана уу.');
    if (!user?.id) throw new Error('Эхлээд нэвтэрнэ үү.');
    const store = api.current, productId = storeProductId(plan, Platform.OS);
    if (!store || !ready || !prices[productId]) throw new Error('Энэ багц дэлгүүрт хараахан бэлэн болоогүй байна.');
    buying.current = true; setBusy(true); setError(null);
    try {
      const { intentId } = await callStorePayments<{ intentId: string }>({ action: 'prepare', platform: Platform.OS, productId, jobId });
      const product = products.current.find(p => p.id === productId);
      const offerToken = product && 'oneTimePurchaseOfferDetailsAndroid' in product
        ? product.oneTimePurchaseOfferDetailsAndroid?.[0]?.offerToken : undefined;
      await store.requestPurchase({ type: 'in-app', request: {
        apple: { sku: productId, quantity: 1, appAccountToken: intentId, andDangerouslyFinishTransactionAutomatically: false },
        google: { skus: [productId], obfuscatedAccountId: user.id, obfuscatedProfileId: intentId, offerToken },
      } });
      // Result arrives through the purchase listener, including approvals after app restart.
    } catch (e) {
      buying.current = false; setBusy(false);
      if (typeof e === 'object' && e !== null && 'code' in e && e.code === store.ErrorCode.UserCancelled) return;
      throw e;
    }
  };
  return <Context.Provider value={{ ready, busy: busy || isRecovering, hasPendingPurchase, error, prices, completed, buy, recover }}>{children}</Context.Provider>;
}
export function useStorePurchases() {
  const value = useContext(Context);
  if (!value) throw new Error('StorePurchaseProvider is missing');
  return value;
}
