import React, { useState } from 'react';
import { Alert, Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { api, imageUrl } from '../../lib/api';
import { useLoad } from '../../lib/hooks';
import { fmtDate } from '../../lib/format';
import { C, METHOD, ORDER_FLOW, R, STATUS } from '../../lib/theme';
import { Badge, Button, Card, ErrorBox, Loading, Page, Row } from '../../components/ui';
import { TransferModal } from '../../components/PaymentModals';

function fmtEta(eta) {
  const a = new Date(eta.from), b = new Date(eta.to);
  const day = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = (d) => d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (b - a <= 8 * 3600000 && a.toDateString() === b.toDateString()) return `${a.toDateString() === new Date().toDateString() ? 'Today' : day(a)}, ${time(a)} – ${time(b)}`;
  return a.toDateString() === b.toDateString() ? day(a) : `${day(a)} – ${day(b)}`;
}

function TrackingCard({ events, status, eta }) {
  const list = [...events].sort((a, b) => new Date(b.at) - new Date(a.at));
  const latest = list[0];
  return (
    <Card>
      <Text style={{ fontWeight: '800', fontSize: 16, color: C.ink }}>📦 Delivery tracking</Text>
      {eta && !['delivered', 'cancelled'].includes(status) ? (
        <View style={{ marginTop: 10, backgroundColor: '#fff4cc', borderRadius: R.m, padding: 12, borderWidth: 1, borderColor: '#f4d675' }}>
          <Text style={{ color: '#8a6500', fontSize: 12, fontWeight: '800' }}>ESTIMATED ARRIVAL</Text>
          <Text style={{ color: C.ink, fontWeight: '800', fontSize: 17, marginTop: 2 }}>{fmtEta(eta)}</Text>
        </View>
      ) : null}
      {latest ? (
        <View style={{ marginTop: 10, backgroundColor: C.brandL, borderRadius: R.m, padding: 12 }}>
          <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700' }}>{status === 'delivered' ? 'DELIVERED TO' : 'PACKAGE IS NOW AT'}</Text>
          <Text style={{ color: C.ink, fontWeight: '800', fontSize: 17, marginTop: 2 }}>{latest.location || 'Location not updated yet'}</Text>
          <Text style={{ color: C.ink2, marginTop: 2 }}>{fmtDate(latest.at)}</Text>
        </View>
      ) : <Text style={{ color: C.muted, marginTop: 8 }}>No tracking updates yet.</Text>}
      <View style={{ marginTop: 12 }}>
        {list.map((t, i) => (
          <View key={t.id} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: i === 0 ? C.brand : C.line, marginTop: 4 }} />
              {i < list.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: C.line }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 14 }}>
              <Text style={{ fontWeight: i === 0 ? '800' : '600', color: C.ink }}>{t.note}</Text>
              {t.location ? <Text style={{ color: C.ink2 }}>{t.location}</Text> : null}
              <Text style={{ color: C.muted, fontSize: 12.5 }}>{fmtDate(t.at)}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

export default function OrderScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { fmt, toast } = useApp();
  const { data: o, error, loading, refreshing, refresh, reload } = useLoad(() => api('/api/orders/' + id), [id]);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (error || !o) return <ErrorBox message={error || 'Order not found.'} onRetry={reload} />;

  const cancelled = o.status === 'cancelled';
  const step = ORDER_FLOW.indexOf(o.status);
  // the payment the customer can still act on
  const active = [...o.payments].reverse().find((p) => ['pending', 'submitted', 'failed'].includes(p.status) && p.method !== 'cod');
  const completed = o.payments.some((p) => p.status === 'completed');
  const afterPay = () => { setSheet(false); reload(); };

  return (
    <>
      <Stack.Screen options={{ title: o.id }} />
      <Page onRefresh={refresh} refreshing={refreshing}>
        <View style={{ padding: 16, gap: 14 }}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: C.muted }}>Placed {fmtDate(o.createdAt)}</Text>
              <Badge status={o.status} />
            </View>
            {cancelled ? (
              <Text style={{ color: C.red, fontWeight: '700', marginTop: 12 }}>This order was cancelled.</Text>
            ) : (
              <View style={{ marginTop: 14 }}>
                {ORDER_FLOW.map((s, i) => {
                  const done = i <= step;
                  return (
                    <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 34 }}>
                      <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: done ? C.brand : C.line, alignItems: 'center', justifyContent: 'center' }}>
                          {done ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                        </View>
                        {i < ORDER_FLOW.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: i < step ? C.brand : C.line }} /> : null}
                      </View>
                      <Text style={{ fontWeight: i === step ? '800' : '500', color: done ? C.ink : C.muted, paddingBottom: 10 }}>{STATUS[s].label}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          <TrackingCard events={o.tracking || []} status={o.status} eta={o.eta} />

          {active && !cancelled && o.status === 'awaiting_payment' && ['bank', 'momo'].includes(active.method) ? (
            <Card style={{ backgroundColor: active.status === 'failed' ? C.redL : C.amberL, borderColor: 'transparent' }}>
              <Text style={{ fontWeight: '800', fontSize: 16, color: C.ink }}>
                {active.status === 'submitted' ? '⏳ Payment submitted'
                  : active.status === 'failed' ? 'Payment could not be verified' : 'Payment needed'}
              </Text>
              <Text style={{ color: C.ink2, marginVertical: 6 }}>
                {active.status === 'submitted' ? 'Our team is verifying your reference. This usually takes a short while.'
                  : active.status === 'failed' ? (active.note || 'We could not verify it.') + ' Check the details and submit the correct reference.'
                  : 'Pay the total, then submit your transaction ID.'}
              </Text>
              {active.status !== 'submitted' ? (
                <Button title={active.status === 'failed' ? 'Try again' : 'Payment details'} onPress={() => setSheet(true)} small />
              ) : null}
            </Card>
          ) : null}

          <Card>
            <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 10 }}>Items</Text>
            {o.items.map((i, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <Image source={{ uri: imageUrl(i.image) }} style={{ width: 50, height: 50, borderRadius: R.s, backgroundColor: C.brandXL }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ fontWeight: '700', color: C.ink }}>{i.name}</Text>
                  <Text style={{ color: C.muted, fontSize: 12.5 }}>{i.size ? 'Size ' + i.size + ' · ' : ''}{i.qty} × {fmt(i.priceUSD, o.exchangeRate)}</Text>
                </View>
                <Text style={{ fontWeight: '800', color: C.brandD }}>{fmt(i.priceUSD * i.qty, o.exchangeRate)}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: C.line, marginVertical: 6 }} />
            <Row label="Subtotal" value={fmt(o.subtotalUSD, o.exchangeRate)} />
            {o.discountUSD ? <Row label={`Discount${o.coupon ? ' (' + o.coupon + ')' : ''}`} value={'−' + fmt(o.discountUSD, o.exchangeRate)} color={C.ok} /> : null}
            <Row label="Delivery" value={o.shippingUSD ? fmt(o.shippingUSD, o.exchangeRate) : 'Free'} />
            <Row label="Total" value={fmt(o.totalUSD, o.exchangeRate)} bold />
          </Card>

          <Card>
            <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Delivery</Text>
            <Text style={{ color: C.ink, fontWeight: '700' }}>{o.address.fullName}</Text>
            <Text style={{ color: C.ink2 }}>{o.address.phone}</Text>
            <Text style={{ color: C.ink2 }}>{o.address.line1}, {o.address.city}{o.address.region ? ', ' + o.address.region : ''}</Text>
            {o.notes ? <Text style={{ color: C.muted, marginTop: 6 }}>Note: {o.notes}</Text> : null}
          </Card>

          <Card>
            <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Payment</Text>
            <Text style={{ color: C.ink2, marginBottom: 6 }}>{METHOD[o.paymentMethod]?.label} · <Text style={{ fontWeight: '700', color: o.paymentStatus === 'paid' ? C.ok : C.amber }}>{o.paymentStatus}</Text></Text>
            {o.payments.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontWeight: '600', color: C.ink }}>{p.reference || p.id}</Text>
                  {p.note ? <Text style={{ color: C.muted, fontSize: 12.5 }}>{p.note}</Text> : null}
                </View>
                <Badge status={p.status} />
              </View>
            ))}
            {o.paymentMethod === 'cod' && !o.payments.length ? <Text style={{ color: C.muted }}>Pay the rider on delivery.</Text> : null}
          </Card>

          <Button title="Continue shopping" variant="outline" onPress={() => router.push('/shop')} />
        </View>
      </Page>

      <TransferModal visible={sheet && !!active && ['bank', 'momo'].includes(active.method)} payment={active} order={o} onClose={() => setSheet(false)} onSubmitted={afterPay} />
    </>
  );
}
