import React from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { useLoad } from '../../lib/hooks';
import { fmtDay } from '../../lib/format';
import { C } from '../../lib/theme';
import { Card, ErrorBox, Loading, Page } from '../../components/ui';

export default function Customers() {
  const { fmt } = useApp();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => api('/api/admin/users'), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <Page onRefresh={refresh} refreshing={refreshing}>
      <View style={{ padding: 16, gap: 10 }}>
        {data.map((u) => (
          <Card key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: u.role === 'admin' ? C.purple : C.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{u.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: C.ink }}>{u.name}{u.role === 'admin' ? '  · admin' : ''}</Text>
              <Text style={{ color: C.muted, fontSize: 12.5 }}>{u.email}</Text>
              <Text style={{ color: C.muted, fontSize: 12.5 }}>{u.phone || '—'} · joined {fmtDay(u.createdAt)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: '900', color: C.brandD }}>{fmt(u.spendUSD)}</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>{u.orders} order{u.orders === 1 ? '' : 's'}</Text>
            </View>
          </Card>
        ))}
      </View>
    </Page>
  );
}
