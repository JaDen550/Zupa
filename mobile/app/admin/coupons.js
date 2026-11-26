import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { useLoad } from '../../lib/hooks';
import { C } from '../../lib/theme';
import { Badge, Button, Card, ErrorBox, Field, Loading, Page } from '../../components/ui';

export default function Coupons() {
  const { toast } = useApp();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => api('/api/admin/coupons'), []);
  const [code, setCode] = useState('');
  const [percent, setPercent] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const add = async () => {
    setBusy(true);
    try {
      await api('/api/admin/coupons', { method: 'POST', body: { code, percent } });
      toast('Coupon created'); setCode(''); setPercent(''); await reload();
    } catch (e) { Alert.alert('Could not create coupon', e.message); } finally { setBusy(false); }
  };
  const retire = (c) => Alert.alert(`Deactivate ${c.code}?`, 'Customers will no longer be able to use it.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Deactivate', style: 'destructive', onPress: async () => { try { await api('/api/admin/coupons/' + c.code, { method: 'DELETE' }); await reload(); } catch (e) { Alert.alert('Failed', e.message); } } }
  ]);

  return (
    <Page onRefresh={refresh} refreshing={refreshing}>
      <View style={{ padding: 16, gap: 12 }}>
        <Card>
          <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 10 }}>New coupon</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Field label="Code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" placeholder="WELCOME15" style={{ flex: 2 }} />
            <Field label="% off" value={percent} onChangeText={setPercent} keyboardType="number-pad" placeholder="15" style={{ flex: 1 }} />
          </View>
          <Button title="Create coupon" onPress={add} loading={busy} disabled={!code || !percent} />
        </Card>
        {data.map((c) => (
          <Card key={c.code} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: c.active ? 1 : 0.55 }}>
            <View>
              <Text style={{ fontWeight: '900', color: C.ink, fontSize: 16, letterSpacing: 1 }}>{c.code}</Text>
              <Text style={{ color: C.muted }}>{c.percent}% off</Text>
            </View>
            {c.active
              ? <Ionicons name="trash-outline" size={22} color={C.red} onPress={() => retire(c)} />
              : <Badge status="cancelled" label="Inactive" />}
          </Card>
        ))}
      </View>
    </Page>
  );
}
