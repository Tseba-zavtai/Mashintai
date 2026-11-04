import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { useStorePurchases } from '@/contexts/StorePurchaseContext';
import { STORE_PRODUCTS, storeProductId, type StorePlan } from '@/lib/storeProducts';

export default function StorePaymentScreen({ onChooseQPay, qpayPrices, initialPlan }: { onChooseQPay?: (plan: StorePlan) => void; qpayPrices?: Partial<Record<StorePlan, number>>; initialPlan?: StorePlan }) {
  const { jobId, jobIds, targetType } = useLocalSearchParams<{ jobId?: string; jobIds?: string; targetType?: string }>();
  const ids = jobIds ? jobIds.split(',').filter(Boolean) : jobId ? [jobId] : [];
  const kind = targetType === 'credit' ? 'credit' : targetType === 'bump' ? 'bump' : 'sponsor';
  const [selected, setSelected] = useState<StorePlan>(initialPlan ?? (kind === 'credit' ? 'credit' : kind === 'bump' ? 'bump' : 'daily'));
  const [success, setSuccess] = useState(false);
  const { colors } = useTheme(), store = useStorePurchases(), router = useRouter();
  const sequence = useRef(store.completed?.sequence ?? 0);
  const requested = useRef<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [showPurchaseHelp, setShowPurchaseHelp] = useState(false);
  useEffect(() => {
    setSelected(initialPlan ?? (kind === 'credit' ? 'credit' : kind === 'bump' ? 'bump' : 'daily'));
    setSuccess(false); requested.current = null;
  }, [kind, jobId, jobIds, initialPlan]);
  useEffect(() => {
    if (store.completed && store.completed.sequence > sequence.current) {
      sequence.current = store.completed.sequence;
      if (store.completed.productId === requested.current) setSuccess(true);
    }
  }, [store.completed]);
  const entries = (Object.keys(STORE_PRODUCTS) as StorePlan[]).filter(key => kind === 'credit' ? key.startsWith('credit') : kind === 'bump' ? key === 'bump' : ['daily', 'weekly', 'monthly'].includes(key));
  const validSelection = kind === 'credit' || ids.length === 1;
  const productId = storeProductId(selected, Platform.OS), price = store.prices[productId];
  const panel = { padding: 18, borderRadius: 14, backgroundColor: colors.background, marginBottom: 14 };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundSecondary }} edges={['bottom']}>
    <Stack.Screen options={{ headerShown: false }} /><AppHeader title="Төлбөр төлөлт" />
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {success ? <View style={panel}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Худалдан авалт баталгаажлаа</Text>
        <Text style={{ color: colors.text, marginVertical: 14 }}>Таны эрх / үйлчилгээ серверт амжилттай бүртгэгдсэн.</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.replace(kind === 'credit' ? '/profile' : '/my-jobs')}><Text style={{ color: colors.primary }}>Дуусгах</Text></TouchableOpacity>
      </View> : <>
        {!validSelection && <Text style={{ color: colors.text, marginBottom: 16 }}>Дэлгүүрээр төлөхдөө нэг удаад нэг зар сонгоно уу. Буцаад хүссэн нэг зараа сонгоорой. Одоогоор төлбөр аваагүй.</Text>}
        {entries.map(key => <TouchableOpacity key={key} accessibilityRole="radio" accessibilityState={{ checked: selected === key }} disabled={store.busy}
          onPress={() => setSelected(key)} style={{ ...panel, borderWidth: 2, borderColor: selected === key ? colors.primary : colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', flex: 1 }}>{STORE_PRODUCTS[key].name}</Text>
            <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: selected === key ? 0 : 2, borderColor: colors.border, backgroundColor: selected === key ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {selected === key && <Text style={{ color: colors.buttonText, fontWeight: '800' }}>✓</Text>}
            </View>
          </View>
          <Text style={{ color: colors.primary, marginTop: 8 }}>{Platform.OS === 'ios' ? 'App Store' : 'Google Play'}: {store.prices[storeProductId(key, Platform.OS)] || 'Хараахан бэлэн болоогүй'}</Text>
          {onChooseQPay && qpayPrices?.[key] != null && <Text style={{ color: colors.textSecondary, marginTop: 4 }}>QPay: {(qpayPrices[key]! * (kind === 'credit' ? 1 : ids.length)).toLocaleString()}₮</Text>}
        </TouchableOpacity>)}
        <View style={{ ...panel, alignItems: 'center', paddingVertical: 22 }}>
          <Text style={{ color: colors.textSecondary }}>Таны сонголт</Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 8 }}>{STORE_PRODUCTS[selected].name}</Text>
          <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '800', marginTop: 12 }}>{Platform.OS === 'ios' ? 'App Store' : 'Google Play'}: {price || 'Үнэ ачаалж байна…'}</Text>
          {onChooseQPay && qpayPrices?.[selected] != null && <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '800', marginTop: 6 }}>QPay: {(qpayPrices[selected]! * (kind === 'credit' ? 1 : ids.length)).toLocaleString()}₮</Text>}
        </View>
        {store.error && <Text accessibilityRole="alert" style={{ color: colors.text, marginBottom: 14 }}>{store.error}</Text>}
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Төлбөрийн аргаа сонгоно уу</Text>
        <TouchableOpacity accessibilityRole="button" disabled={!store.ready || !price || !validSelection || store.busy || recovering}
          style={{ padding: 18, borderRadius: 14, backgroundColor: colors.primary, opacity: !store.ready || !price || !validSelection || store.busy ? 0.45 : 1 }}
          onPress={async () => {
            requested.current = productId;
            try { await store.buy(selected, kind === 'credit' ? undefined : ids[0]); }
            catch (e) { Alert.alert('Худалдан авалт', e instanceof Error ? e.message : 'Худалдан авалт дуусаагүй.'); }
          }}>
          {store.busy ? <ActivityIndicator color={colors.buttonText} /> : <Text style={{ color: colors.buttonText, textAlign: 'center', fontWeight: '800' }}>{Platform.OS === 'ios' ? 'App Store' : 'Google Play'}-ээр төлөх</Text>}
        </TouchableOpacity>
        {onChooseQPay && <TouchableOpacity accessibilityRole="button" disabled={store.busy || store.hasPendingPurchase || recovering}
          style={{ padding: 18, marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.background, opacity: store.busy || store.hasPendingPurchase || recovering ? 0.45 : 1 }}
          onPress={() => onChooseQPay(selected)}>
          <Text style={{ color: colors.text, textAlign: 'center', fontWeight: '700' }}>QPay Mongolia</Text>
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>Банкны апп ашиглан төлөх</Text>
        </TouchableOpacity>}
        {store.hasPendingPurchase && <Text style={{ color: colors.textSecondary, marginTop: 10 }}>Давхар төлөхөөс сэргийлж хүлээгдэж буй дэлгүүрийн худалдан авалтаа эхлээд дахин шалгана уу.</Text>}
        <TouchableOpacity accessibilityRole="button" disabled={!store.ready || store.busy || recovering} style={{ padding: 18 }} onPress={async () => {
          setRecovering(true); try { await store.recover(); } finally { setRecovering(false); }
        }}><Text style={{ color: colors.primary, textAlign: 'center' }}>{recovering ? 'Шалгаж байна…' : 'Худалдан авалтаа шалгах'}</Text></TouchableOpacity>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>App Store / Google Play-ээр төлсөн худалдан авалт баталгаажаагүй бол дээрх товчоор дахин шалгаарай. Дахин төлөх шаардлагагүй.</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showPurchaseHelp }} style={{ paddingVertical: 18 }} onPress={() => setShowPurchaseHelp(value => !value)}>
          <Text style={{ color: colors.primary, textAlign: 'center' }}>Худалдан авалтын тухай {showPurchaseHelp ? '⌃' : '⌄'}</Text>
        </TouchableOpacity>
        {showPurchaseHelp && <View style={panel}>
          <Text style={{ color: colors.textSecondary }}>Та хүссэн үедээ нэмж эрх худалдаж авч болно. Дахин шалгах товч нь өмнөх төлбөрийн баталгаажуулалтыг шалгадаг бөгөөд шинэ худалдан авалт үүсгэхгүй.</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Хэрэгцээндээ тохирох багцаа сонгоорой. Ашигласан багцын буцаалтад хязгаарлалт үйлчилнэ. App Store / Google Play-ээр төлсөн бол тухайн дэлгүүрийн буцаалтын нөхцөл үйлчилнэ. Тусламж хэрэгтэй бол бидэнтэй холбогдоорой.</Text>
          <TouchableOpacity accessibilityRole="link" style={{ marginTop: 12 }} onPress={() => router.push('/help/terms')}><Text style={{ color: colors.primary }}>Үйлчилгээний нөхцөл</Text></TouchableOpacity>
        </View>}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
