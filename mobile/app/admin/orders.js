import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { useLoad } from '../../lib/hooks';
import { fmtDate } from '../../lib/format';
import { C, METHOD, NEXT_STATUS, STATUS } from '../../lib/theme';
import { Badge, Button, Card, Chip, Empty, ErrorBox, Field, Loading, Page } from '../../components/ui';
import { Sheet } from '../../components/PaymentModals';

const FILTERS = ['all', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
const PAY_METHODS = [{ v: 'cash', l: 'Cash' }, { v: 'pos', l: 'POS' }, { v: 'bank', l: 'Bank transfer' }, { v: 'momo', l: 'Mobile money' }, { v: 'manual', l: 'Other' }];

export default function AdminOrders() {
  const { fmt, toast } = useApp();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => api('/api/admin/orders'), []);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNote, setPayNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [locFor, setLocFor] = useState(null);
  const [loc, setLoc] = useState('');
  const [locNote, setLocNote] = useState('');

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const list = data.filter((o) => filter === 'all' || o.status === filter);

  const setStatus = async (o, status) => {
    setBusy(true);
    try { await api('/api/admin/orders/' + o.id, { method: 'PUT', body: { status } }); toast(`Order ${STATUS[status].label.toLowerCase()}`); await reload(); }
    catch (e) { Alert.alert('Could not update order', e.message); } finally { setBusy(false); }
  };
  const confirmCancel = (o) => Alert.alert(`Cancel ${o.id}?`, 'Stock will be returned.', [
    { text: 'Keep', style: 'cancel' }, { text: 'Cancel order', style: 'destructive', onPress: () => setStatus(o, 'cancelled') }
  ]);
  const openPay = (o) => { setPayFor(o); setPayAmt(String(o.totalUSD)); setPayMethod(o.paymentMethod === 'cod' ? 'cash' : 'bank'); setPayNote(''); };
  const postLocation = async () => {
    setBusy(true);
    try {
      await api(`/api/admin/orders/${locFor.id}/tracking`, { method: 'POST', body: { location: loc, note: locNote } });
      toast('Tracking updated'); setLocFor(null); setLoc(''); setLocNote(''); await reload();
    } catch (e) { Alert.alert('Could not update tracking', e.message); } finally { setBusy(false); }
  };
  const recordPayment = async () => {
    setBusy(true);
    try {
      await api('/api/admin/payments', { method: 'POST', body: { orderId: payFor.id, amountUSD: payAmt, method: payMethod, note: payNote } });
      toast('Payment recorded'); setPayFor(null); await reload();
    } catch (e) { Alert.alert('Could not record payment', e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <Page onRefresh={refresh} refreshing={refreshing} stickyHeaderIndices={[0]}>
        <View style={{ backgroundColor: C.bg, paddingVertical: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {FILTERS.map((f) => (
              <Chip key={f} active={filter === f} onPress={() => setFilter(f)}
                label={f === 'all' ? `All (${data.length})` : STATUS[f].label} />
            ))}
          </ScrollView>
        </View>
        {!list.length ? <Empty icon="receipt-outline" title="No orders here" /> : (
          <View style={{ padding: 16, paddingTop: 4, gap: 12 }}>
            {list.map((o) => {
              const isOpen = open === o.id;
              const next = NEXT_STATUS[o.status];
              return (
                <Card key={o.id} onPress={() => setOpen(isOpen ? null : o.id)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontWeight: '800', fontSize: 16, color: C.ink }}>{o.id}</Text>
                    <Badge status={o.status} />
                  </View>
                  <Text style={{ color: C.ink2, marginTop: 2 }}>{o.customerName} · {METHOD[o.paymentMethod]?.label}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ color: C.muted, fontSize: 12.5 }}>{fmtDate(o.createdAt)}</Text>
                    <Text style={{ fontWeight: '900', color: C.brandD }}>{fmt(o.totalUSD, o.exchangeRate)}</Text>
                  </View>

                  {isOpen ? (
                    <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 4 }}>
                      {o.items.map((i, idx) => <Text key={idx} style={{ color: C.ink2 }}>{i.qty} × {i.name}</Text>)}
                      <Text style={{ color: C.muted, marginTop: 6 }}>📍 {o.address.fullName}, {o.address.phone}</Text>
                      <Text style={{ color: C.muted }}>{o.address.line1}, {o.address.city}</Text>
                      {o.notes ? <Text style={{ color: C.muted }}>📝 {o.notes}</Text> : null}
                      <Text style={{ marginTop: 6, color: C.ink2 }}>Payment: <Text style={{ fontWeight: '800', color: o.paymentStatus === 'paid' ? C.ok : C.amber }}>{o.paymentStatus}</Text></Text>
                      {o.payments.map((p) => (
                        <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: C.muted, fontSize: 12.5, flex: 1 }}>{p.reference || p.id}{p.side === 'admin' ? ' (admin)' : ''}</Text>
                          <Badge status={p.status} />
                        </View>
                      ))}

                      <View style={{ gap: 8, marginTop: 10 }}>
                        {o.paymentStatus !== 'paid' && o.status !== 'cancelled' ? <Button title="Record payment" icon="cash-outline" small onPress={() => openPay(o)} /> : null}
                        {!['delivered', 'cancelled'].includes(o.status) ? <Button title="Update package location" icon="location-outline" variant="soft" small onPress={() => setLocFor(o)} /> : null}
                        {next ? <Button title={`Mark as ${STATUS[next].label.toLowerCase()}`} variant="soft" small loading={busy} onPress={() => setStatus(o, next)} /> : null}
                        {!['delivered', 'cancelled'].includes(o.status) ? <Button title="Cancel order" variant="danger" small onPress={() => confirmCancel(o)} /> : null}
                      </View>
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </Page>

      <Sheet visible={!!locFor} title="Update package location" onClose={() => setLocFor(null)}>
        <Text style={{ color: C.ink2, marginBottom: 12 }}>Order <Text style={{ fontWeight: '800' }}>{locFor?.id}</Text>. The customer sees this with today's date and time.</Text>
        <Field label="Current location" value={loc} onChangeText={setLoc} autoCapitalize="sentences" placeholder="e.g. Hastings checkpoint, Freetown" />
        <Field label="Note (optional)" value={locNote} onChangeText={setLocNote} autoCapitalize="sentences" placeholder="e.g. Out for delivery" />
        <Button title="Post update" onPress={postLocation} loading={busy} />
      </Sheet>

      <Sheet visible={!!payFor} title="Record payment" onClose={() => setPayFor(null)}>
        <Text style={{ color: C.ink2, marginBottom: 12 }}>Order <Text style={{ fontWeight: '800' }}>{payFor?.id}</Text> · total {payFor ? fmt(payFor.totalUSD) : ''}</Text>
        <Field label="Amount received (USD)" value={payAmt} onChangeText={setPayAmt} keyboardType="decimal-pad" />
        <Text style={{ fontWeight: '600', color: C.ink2, marginBottom: 6, fontSize: 13.5 }}>Method</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {PAY_METHODS.map((m) => <Chip key={m.v} label={m.l} active={payMethod === m.v} onPress={() => setPayMethod(m.v)} />)}
        </ScrollView>
        <Field label="Note (optional)" value={payNote} onChangeText={setPayNote} autoCapitalize="sentences" placeholder="e.g. Cash collected by rider" />
        <Button title="Save payment" onPress={recordPayment} loading={busy} />
      </Sheet>
    </>
  );
}
