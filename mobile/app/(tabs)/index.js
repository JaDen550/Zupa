import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { useLoad } from '../../lib/hooks';
import { C, R } from '../../lib/theme';
import { Chip, ErrorBox, Loading, Page, Section, Segmented } from '../../components/ui';
import HeaderActions from '../../components/HeaderActions';
import ProductGrid from '../../components/ProductGrid';

const CAT_ICON = {
  Electronics: 'phone-portrait-outline', Fashion: 'shirt-outline', 'Food & Agro': 'nutrition-outline',
  'Home & Craft': 'home-outline', Beauty: 'sparkles-outline', Sports: 'basketball-outline', 'TBT (The Bold Tribe)': 'flame-outline'
};

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, currency, setCurrency, fmt, refreshSettings, user } = useApp();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(async () => {
    const [featured, newest] = await Promise.all([
      api('/api/products?featured=1', { auth: false }),
      api('/api/products?sort=newest', { auth: false })
    ]);
    return { featured, newest: newest.slice(0, 6) };
  });

  return (
    <Page onRefresh={() => { refreshSettings(); refresh(); }} refreshing={refreshing}>
      <View style={{ backgroundColor: C.brand, paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 22, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Image source={require('../../assets/logo.png')} style={{ width: 36, height: 36 }} resizeMode="contain" />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 0.5 }}>{settings.storeName}</Text>
              <Text numberOfLines={1} style={{ color: '#ffe8d6', marginTop: 0, fontSize: 12.5 }}>{user ? `Hi, ${user.name.split(' ')[0]} 👋` : 'Your everyday shopping destination'}</Text>
            </View>
          </View>
          <View style={{ marginRight: -12 }}><HeaderActions light /></View>
        </View>
        <Pressable
          onPress={() => router.push('/shop')}
          style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: R.m, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="search" size={18} color={C.muted} />
          <Text style={{ color: C.muted, fontSize: 15 }}>Search products…</Text>
        </Pressable>
        <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '600', flex: 1 }}>🚚 Free delivery over {fmt(settings.freeShippingOverUSD)}</Text>
          <View style={{ width: 110 }}>
            <Segmented value={currency} onChange={setCurrency} options={[{ value: 'SLE', label: 'NLe' }, { value: 'USD', label: '$' }]} />
          </View>
        </View>
      </View>

      <Section title="Categories">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {settings.categories.map((c) => (
            <Pressable key={c} onPress={() => router.push({ pathname: '/shop', params: { category: c } })}
              style={{ alignItems: 'center', marginRight: 14, width: 76 }}>
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: C.brandL, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={CAT_ICON[c] || 'pricetag-outline'} size={26} color={C.brand} />
              </View>
              <Text numberOfLines={2} style={{ textAlign: 'center', fontSize: 12, fontWeight: '600', color: C.ink2, marginTop: 6 }}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Section>

      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <>
          <Section title="⭐ Featured">
            <ProductGrid products={data.featured} />
          </Section>
          <Section title="New arrivals" right={<Chip label="See all" onPress={() => router.push('/shop')} />}>
            <ProductGrid products={data.newest} />
          </Section>
        </>
      )}
    </Page>
  );
}
