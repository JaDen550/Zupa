import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { api, imageUrl } from '../../lib/api';
import { useLoad } from '../../lib/hooks';
import { C, R } from '../../lib/theme';
import { Button, Card, Chip, ErrorBox, Field, Loading, Page } from '../../components/ui';
import { Sheet } from '../../components/PaymentModals';

const IMAGES = ['coffee', 'phone', 'wax-outfit', 'palm-oil', 'sneakers', 'basket', 'earbuds', 'shea', 'powerbank', 'scarf', 'mango', 'lamp'].map((n) => `images/${n}.png`);
const blank = { name: '', category: '', priceSLE: '', stock: '', description: '', image: IMAGES[0], active: true, featured: false };

export default function AdminProducts() {
  const { fmt, settings, toast } = useApp();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => api('/api/admin/products'), []);
  const [form, setForm] = useState(null); // product being edited/created
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const patch = async (p, body) => {
    try { await api('/api/admin/products/' + p.id, { method: 'PUT', body }); await reload(); }
    catch (e) { Alert.alert('Update failed', e.message); }
  };
  const save = async () => {
    if (!form.name.trim() || form.priceSLE === '') return Alert.alert('Missing details', 'Name and price are required.');
    setBusy(true);
    try {
      const body = { ...form, priceSLE: parseFloat(form.priceSLE), stock: parseInt(form.stock, 10) || 0, category: form.category || settings.categories[0] };
      if (form.id) await api('/api/admin/products/' + form.id, { method: 'PUT', body });
      else await api('/api/admin/products', { method: 'POST', body });
      toast(form.id ? 'Product updated' : 'Product added'); setForm(null); await reload();
    } catch (e) { Alert.alert('Could not save', e.message); } finally { setBusy(false); }
  };
  const remove = (p) => Alert.alert(`Delete “${p.name}”?`, 'Products that appear in past orders are hidden instead of deleted.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete', style: 'destructive', onPress: async () => {
        try { const r = await api('/api/admin/products/' + p.id, { method: 'DELETE' }); toast(r.softDeleted ? 'Hidden (used in orders)' : 'Deleted'); await reload(); }
        catch (e) { Alert.alert('Failed', e.message); }
      }
    }
  ]);

  return (
    <>
      <Page onRefresh={refresh} refreshing={refreshing}>
        <View style={{ padding: 16, gap: 12 }}>
          <Button title="Add product" icon="add" onPress={() => setForm({ ...blank, category: settings.categories[0] || '' })} />
          {data.map((p) => (
            <Card key={p.id} style={{ opacity: p.active ? 1 : 0.6 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Image source={{ uri: imageUrl(p.image) }} style={{ width: 64, height: 64, borderRadius: R.s, backgroundColor: C.brandXL }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontWeight: '800', color: C.ink }}>{p.name}</Text>
                  <Text style={{ color: C.muted, fontSize: 12.5 }}>{p.category}</Text>
                  <Text style={{ color: C.brandD, fontWeight: '800' }}>{fmt(p.priceUSD)}</Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: p.stock <= 0 ? C.red : p.stock <= 5 ? C.amber : C.ink2 }}>
                    {p.stock <= 0 ? 'Sold out' : `${p.stock} in stock`}
                  </Text>
                </View>
                <View style={{ gap: 12 }}>
                  <Ionicons name="create-outline" size={22} color={C.brand} onPress={() => setForm({ ...p, priceSLE: String(p.priceSLE), stock: String(p.stock) })} />
                  <Ionicons name="trash-outline" size={22} color={C.red} onPress={() => remove(p)} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 24, marginTop: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Switch value={p.active} onValueChange={(v) => patch(p, { active: v })} trackColor={{ true: C.brand }} />
                  <Text style={{ color: C.ink2, fontWeight: '600' }}>Active</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Switch value={p.featured} onValueChange={(v) => patch(p, { featured: v })} trackColor={{ true: C.gold }} />
                  <Text style={{ color: C.ink2, fontWeight: '600' }}>Featured</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      </Page>

      <Sheet visible={!!form} title={form?.id ? 'Edit product' : 'New product'} onClose={() => setForm(null)}>
        {form ? (
          <>
            <Field label="Name" value={form.name} onChangeText={set('name')} autoCapitalize="words" />
            <Text style={{ fontWeight: '600', color: C.ink2, marginBottom: 6, fontSize: 13.5 }}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {settings.categories.map((c) => <Chip key={c} label={c} active={form.category === c} onPress={() => set('category')(c)} />)}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field label="Price (NLe)" value={form.priceSLE} onChangeText={set('priceSLE')} keyboardType="decimal-pad" style={{ flex: 1 }} />
              <Field label="Stock" value={form.stock} onChangeText={set('stock')} keyboardType="number-pad" style={{ flex: 1 }} />
            </View>
            <Text style={{ fontWeight: '600', color: C.ink2, marginBottom: 6, fontSize: 13.5 }}>Image</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {IMAGES.map((i) => (
                <Pressable key={i} onPress={() => set('image')(i)} style={{ marginRight: 8 }}>
                  <Image source={{ uri: imageUrl(i) }} style={{
                    width: 62, height: 62, borderRadius: R.s, backgroundColor: C.brandXL,
                    borderWidth: 3, borderColor: form.image === i ? C.brand : 'transparent'
                  }} />
                </Pressable>
              ))}
            </ScrollView>
            <Field label="Description" value={form.description} onChangeText={set('description')} multiline autoCapitalize="sentences" />
            <View style={{ flexDirection: 'row', gap: 24, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Switch value={form.active} onValueChange={set('active')} trackColor={{ true: C.brand }} /><Text>Active</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Switch value={form.featured} onValueChange={set('featured')} trackColor={{ true: C.gold }} /><Text>Featured</Text>
              </View>
            </View>
            <Button title={form.id ? 'Save changes' : 'Add product'} onPress={save} loading={busy} />
          </>
        ) : null}
      </Sheet>
    </>
  );
}
