import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { api, imageUrl } from '../../lib/api';
import { useLoad } from '../../lib/hooks';
import { C, R } from '../../lib/theme';
import { Button, Card, Empty, ErrorBox, Loading, Page, Row, Stepper } from '../../components/ui';

export default function Cart() {
  const router = useRouter();
  const { cart, setQty, removeFromCart, settings, fmt, user } = useApp();
  const { data: products, error, loading, reload } = useLoad(() => api('/api/products', { auth: false }), []);

  if (!cart.length) {
    return (
      <Empty icon="cart-outline" title="Your cart is empty" text="Add something you love from the shop."
        action={<Button title="Start shopping" onPress={() => router.push('/shop')} />} />
    );
  }
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  // drop lines whose product disappeared / was deactivated
  const lines = cart.map((i) => ({ ...i, p: byId[i.productId] })).filter((l) => l.p);
  const subtotal = lines.reduce((s, l) => s + l.p.priceUSD * l.qty, 0);
  const shipping = subtotal >= settings.freeShippingOverUSD ? 0 : settings.shippingFeeUSD;
  const missing = settings.freeShippingOverUSD - subtotal;

  return (
    <Page>
      <View style={{ padding: 16, gap: 10 }}>
        {missing > 0 ? (
          <View style={{ backgroundColor: C.goldL, borderRadius: R.m, padding: 12 }}>
            <Text style={{ color: C.amber, fontWeight: '700' }}>🚚 Add {fmt(missing)} more for free delivery!</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: C.okL, borderRadius: R.m, padding: 12 }}>
            <Text style={{ color: C.okD, fontWeight: '700' }}>🎉 You've unlocked free delivery</Text>
          </View>
        )}

        {lines.map(({ p, qty, size }) => (
          <Card key={p.id + '|' + (size || '')} style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable onPress={() => router.push('/product/' + p.id)}>
              <Image source={{ uri: imageUrl(p.image) }} style={{ width: 84, height: 84, borderRadius: R.s, backgroundColor: C.brandXL }} />
            </Pressable>
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ fontWeight: '700', color: C.ink }}>{p.name}</Text>
                  {size ? <Text style={{ color: C.muted, fontSize: 12.5 }}>Size: {size}</Text> : null}
                </View>
                <Ionicons name="trash-outline" size={22} color={C.red} onPress={() => removeFromCart(p.id, size)} style={{ marginLeft: 8 }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Stepper value={qty} onChange={(n) => setQty(p.id, n, size)} max={Math.max(1, p.stock)} />
                <Text style={{ fontWeight: '800', color: C.brandD }}>{fmt(p.priceUSD * qty)}</Text>
              </View>
              {qty > p.stock ? <Text style={{ color: C.red, fontSize: 12 }}>Only {p.stock} in stock</Text> : null}
            </View>
          </Card>
        ))}

        <Card>
          <Row label="Subtotal" value={fmt(subtotal)} />
          <Row label="Delivery" value={shipping ? fmt(shipping) : 'Free'} color={shipping ? undefined : C.ok} />
          <View style={{ height: 1, backgroundColor: C.line, marginVertical: 6 }} />
          <Row label="Total" value={fmt(subtotal + shipping)} bold />
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Coupons can be applied at checkout.</Text>
        </Card>

        <Button
          title={user ? 'Proceed to checkout' : 'Sign in to checkout'}
          icon={user ? 'lock-closed-outline' : 'log-in-outline'}
          onPress={() => router.push(user ? '/checkout' : '/login')}
        />
      </View>
    </Page>
  );
}
