import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { useLoad } from '../../lib/hooks';
import { fmtDate } from '../../lib/format';
import { C, METHOD } from '../../lib/theme';
import { Badge, Button, Card, Chip, Empty, ErrorBox, Loading, Page } from '../../components/ui';

const FILTERS = [{ v: 'review', l: 'Needs review' }, { v: 'all', l: 'All' }, { v: 'completed', l: 'Completed' }, { v: 'failed', l: 'Failed' }];

export default function AdminPayments() {
  const { fmt, toast } = useApp();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => api('/api/admin/payments'), []);
  const [filter, setFilter] = useState('review');
  const [busy, setBusy] = useState('');

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const list = data.filter((p) =>
    filter === 'all' ? true : filter === 'review' ? ['pending', 'submitted'].includes(p.status) : p.status === filter);
  const total = data.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amountUSD, 0);

  const act = (p, action) => {
    const doIt = async () => {
      setBusy(p.id);
      try {
        await api('/api/admin/payments/' + p.id, { method: 'POST', body: { action } });
        toast(action === 'complete' ? 'Payment verified ✓' : 'Payment rejected'); await reload();
      } catch (e) { Alert.alert('Action failed', e.message); } finally { setBusy(''); }
    };
    Alert.alert(
      action === 'complete' ? 'Mark payment as received?' : 'Reject this payment?',
      `${p.orderId} · ${fmt(p.amountUSD, p.exchangeRate)}${p.reference ? '\nRef: ' + p.reference : ''}`,
      [{ text: 'Cancel', style: 'cancel' },
        { text: action === 'complete' ? 'Complete' : 'Reject', style: action === 'complete' ? 'default' : 'destructive', onPress: doIt }]
    );
  };

  return (
    <Page onRefresh={refresh} refreshing={refreshing} stickyHeaderIndices={[0]}>
      <View style={{ backgroundColor: C.bg, paddingVertical: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {FILTERS.map((f) => <Chip key={f.v} label={f.l} active={filter === f.v} onPress={() => setFilter(f.v)} />)}
        </ScrollView>
      </View>
      <Text style={{ paddingHorizontal: 16, color: C.muted, marginBottom: 8 }}>Collected so far: <Text style={{ fontWeight: '800', color: C.brandD }}>{fmt(total)}</Text></Text>
      {!list.length ? <Empty icon="checkmark-done-outline" title="Nothing here" text="No payments match this filter." /> : (
        <View style={{ padding: 16, paddingTop: 4, gap: 12 }}>
          {list.map((p) => (
            <Card key={p.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: '800', color: C.ink }}>{p.orderId}</Text>
                <Badge status={p.status} />
              </View>
              <Text style={{ color: C.ink2, marginTop: 2 }}>{p.customerName} · {METHOD[p.method]?.label || p.method}{p.side === 'admin' ? ' · admin-recorded' : ''}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ color: C.muted, fontSize: 12.5 }}>{fmtDate(p.createdAt)}</Text>
                <Text style={{ fontWeight: '900', color: C.brandD }}>{fmt(p.amountUSD, p.exchangeRate)}</Text>
              </View>
              {p.reference ? <Text style={{ color: C.ink2, marginTop: 6 }} selectable>Ref: <Text style={{ fontWeight: '700' }}>{p.reference}</Text></Text> : null}
              {p.note ? <Text style={{ color: C.muted, fontSize: 12.5 }}>{p.note}</Text> : null}
              {['pending', 'submitted'].includes(p.status) ? (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <Button title="Complete" icon="checkmark" small onPress={() => act(p, 'complete')} loading={busy === p.id} style={{ flex: 1 }} />
                  <Button title="Reject" variant="danger" small onPress={() => act(p, 'fail')} disabled={busy === p.id} style={{ flex: 1 }} />
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Page>
  );
}
