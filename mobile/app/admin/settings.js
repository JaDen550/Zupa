import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { C } from '../../lib/theme';
import { Button, Card, Field, Page } from '../../components/ui';

export default function StoreSettings() {
  const { settings, refreshSettings, toast } = useApp();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setF({
      storeName: settings.storeName, exchangeRate: String(settings.exchangeRate),
      shippingFeeSLE: String(settings.shippingFeeSLE), freeShippingOverSLE: String(settings.freeShippingOverSLE),
      categories: settings.categories.join(', ')
    });
  }, [settings]);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await api('/api/admin/settings', {
        method: 'PUT',
        body: {
          storeName: f.storeName, exchangeRate: f.exchangeRate, shippingFeeSLE: f.shippingFeeSLE,
          freeShippingOverSLE: f.freeShippingOverSLE,
          categories: f.categories.split(',').map((c) => c.trim()).filter(Boolean)
        }
      });
      await refreshSettings(); toast('Settings saved');
    } catch (e) { Alert.alert('Could not save', e.message); } finally { setBusy(false); }
  };

  return (
    <Page>
      <View style={{ padding: 16, gap: 12 }}>
        <Card>
          <Field label="Store name" value={f.storeName} onChangeText={set('storeName')} autoCapitalize="words" />
          <Field label="Exchange rate (NLe per $1)" value={f.exchangeRate} onChangeText={set('exchangeRate')} keyboardType="decimal-pad" />
          <Field label="Delivery fee (NLe)" value={f.shippingFeeSLE} onChangeText={set('shippingFeeSLE')} keyboardType="decimal-pad" />
          <Field label="Free delivery over (NLe)" value={f.freeShippingOverSLE} onChangeText={set('freeShippingOverSLE')} keyboardType="decimal-pad" />
          <Field label="Categories (comma separated)" value={f.categories} onChangeText={set('categories')} autoCapitalize="words" multiline style={{ marginBottom: 0 }} />
        </Card>
        <Text style={{ color: C.muted, fontSize: 12.5 }}>Changes apply instantly to the website and every customer's app.</Text>
        <Button title="Save settings" onPress={save} loading={busy} />
      </View>
    </Page>
  );
}
