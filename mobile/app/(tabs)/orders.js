import React from 'react';
import { Image, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { api, imageUrl } from '../../lib/api';
import { useLoad } from '../../lib/hooks';
import { fmtDay } from '../../lib/format';
import { C, R } from '../../lib/theme';
import { Badge, Button, Card, Empty, ErrorBox, Loading, Page } from '../../components/ui';

export default function Orders() {
  const router = useRouter();
  const { user, fmt } = useApp();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(
    () => (user ? api('/api/orders') : Promise.resolve([])), [user?.id]
  );

  if (!user) {
    return <Empty icon="receipt-outline" title="Sign in to see your orders" text="Track deliveries and payments in one place."
      action={<Button title="Sign in" onPress={() => router.push('/login')} />} />;
  }
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data.length) {
    return <Empty icon="receipt-outline" title="No orders yet" text="When you place an order it will show up here."
      action={<Button title="Browse products" onPress={() => router.push('/shop')} />} />;
  }

  return (
    <Page onRefresh={refresh} refreshing={refreshing}>
      <View style={{ padding: 16, gap: 12 }}>
        {data.map((o) => (
          <Card key={o.id} onPress={() => router.push('/order/' + o.id)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '800', color: C.ink, fontSize: 16 }}>{o.id}</Text>
              <Badge status={o.status} />
            </View>
            <Text style={{ color: C.muted, marginTop: 2, fontSize: 12.5 }}>{fmtDay(o.createdAt)} · {o.items.length} item{o.items.length === 1 ? '' : 's'}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
              {o.items.slice(0, 4).map((i, idx) => (
                <Image key={idx} source={{ uri: imageUrl(i.image) }} style={{ width: 44, height: 44, borderRadius: R.s, backgroundColor: C.brandXL }} />
              ))}
              {o.items.length > 4 ? <View style={{ width: 44, height: 44, borderRadius: R.s, backgroundColor: C.brandL, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontWeight: '800', color: C.brandD }}>+{o.items.length - 4}</Text></View> : null}
              <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                <Text style={{ fontWeight: '900', color: C.brandD, fontSize: 16 }}>{fmt(o.totalUSD, o.exchangeRate)}</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Page>
  );
}
