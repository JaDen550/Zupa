import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { useLoad } from '../../lib/hooks';
import { C, R } from '../../lib/theme';
import { Badge, Card, ErrorBox, Loading, Page, Section, Segmented } from '../../components/ui';

function Stat({ icon, label, value, sub, color = C.brand, bg = C.brandL, onPress }) {
  return (
    <Card onPress={onPress} style={{ flexBasis: '47%', flexGrow: 1 }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={{ color: C.muted, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink }}>{value}</Text>
      {sub ? <Text style={{ color: C.muted, fontSize: 12 }}>{sub}</Text> : null}
    </Card>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { fmt, fmtCompact, fmt2, currency, setCurrency } = useApp();
  const { data: s, error, loading, refreshing, refresh, reload } = useLoad(() => api('/api/admin/stats'), []);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const max = Math.max(1, ...s.days.map((d) => d.total));

  return (
    <Page onRefresh={refresh} refreshing={refreshing}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, color: C.muted, fontWeight: '600' }}>Display currency</Text>
          <View style={{ width: 120 }}>
            <Segmented value={currency} onChange={setCurrency} options={[{ value: 'SLE', label: 'NLe' }, { value: 'USD', label: '$' }]} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Stat icon="cash-outline" label="Revenue" value={fmt(s.revenueUSD)} sub={fmt2(s.revenueUSD)} />
          <Stat icon="receipt-outline" label="Orders" value={s.orders} sub={`${s.openOrders} open · ${s.paidOrders} paid`} color={C.blue} bg={C.blueL} onPress={() => router.push('/admin/orders')} />
          <Stat icon="hourglass-outline" label="Payments to review" value={s.pendingPayments} color={C.amber} bg={C.amberL} onPress={() => router.push('/admin/payments')} />
          <Stat icon="people-outline" label="Customers" value={s.customers} sub={`${s.products} products`} color={C.purple} bg={C.purpleL} onPress={() => router.push('/admin/customers')} />
        </View>

        <Card>
          <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 12 }}>Revenue · last 7 days</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: 8 }}>
            {s.days.map((d) => (
              <View key={d.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <Text style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{d.total ? fmtCompact(d.total) : ''}</Text>
                <View style={{ width: '100%', height: Math.max(4, (d.total / max) * 90), backgroundColor: d.total ? C.brand : C.line, borderRadius: 6 }} />
                <Text style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{d.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {s.lowStock.length ? (
          <Card style={{ backgroundColor: C.amberL, borderColor: 'transparent' }}>
            <Text style={{ fontWeight: '800', color: C.amber, marginBottom: 6 }}>⚠️ Low stock</Text>
            {s.lowStock.map((p) => (
              <Text key={p.id} style={{ color: C.ink2, paddingVertical: 2 }}>{p.name} — <Text style={{ fontWeight: '800', color: p.stock ? C.amber : C.red }}>{p.stock ? `${p.stock} left` : 'sold out'}</Text></Text>
            ))}
          </Card>
        ) : null}
      </View>

      <Section title="Recent orders">
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {s.recent.map((o) => (
            <Card key={o.id} onPress={() => router.push('/admin/orders')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontWeight: '800', color: C.ink }}>{o.id}</Text>
                <Text style={{ color: C.muted, fontSize: 12.5 }}>{o.address.fullName}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontWeight: '800', color: C.brandD }}>{fmt(o.totalUSD, o.exchangeRate)}</Text>
                <Badge status={o.status} />
              </View>
            </Card>
          ))}
        </View>
      </Section>
    </Page>
  );
}
