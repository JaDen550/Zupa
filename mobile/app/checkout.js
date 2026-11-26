import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { useLoad } from '../lib/hooks';
import { C, R, METHOD } from '../lib/theme';
import { Button, Card, ErrorBox, Field, Loading, Page, Row } from '../components/ui';
import { BankModal, GatewayModal } from '../components/PaymentModals';

const METHODS = [
  { id: 'momo', sub: 'Orange Money, Africell Money & QMoney' },
  { id: 'bank', sub: 'Transfer first — our team verifies it' },
  { id: 'cod', sub: 'Pay the rider when it arrives' }
];

export default function Checkout() {
  const router = useRouter();
  const { user, cart, clearCart, settings, fmt, toast } = useApp();
  const { data: products, error, loading, reload } = useLoad(() => api('/api/products', { auth: false }), []);
  const [addr, setAddr] = useState({
    fullName: user?.name || '', phone: user?.phone || '', line1: '', city: user?.city || '', region: ''
  });
  const [method, setMethod] = useState('bank');
  const [notes, setNotes] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(null); // {code, percent}
  const [couponErr, setCouponErr] = useState('');
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState('');
  const [pending, setPending] = useState(null); // {order, payment} while a payment sheet is open
  const [placed, setPlaced] = useState(false); // stops the empty-cart redirect after a successful order

  if (!user) return <Redirect href="/login" />;
  if (!cart.length && !placed) return <Redirect href="/cart" />;
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const lines = cart.map((i) => ({ ...i, p: byId[i.productId] })).filter((l) => l.p);
  const subtotal = lines.reduce((s, l) => s + l.p.priceUSD * l.qty, 0);
  const discount = coupon ? Math.round(subtotal * coupon.percent) / 100 : 0;
  const shipping = subtotal - discount >= settings.freeShippingOverUSD ? 0 : settings.shippingFeeUSD;
  const total = subtotal - discount + shipping;
  const set = (k) => (v) => setAddr((a) => ({ ...a, [k]: v }));

  const applyCoupon = async () => {
    setCouponErr('');
    try { setCoupon(await api('/api/coupons/validate?code=' + encodeURIComponent(couponInput.trim()), { auth: false })); toast('Coupon applied'); }
    catch (e) { setCoupon(null); setCouponErr(e.message); }
  };

  const goToOrder = (id) => router.replace('/order/' + id);

  const place = async () => {
    setErr('');
    if (!addr.fullName || !addr.phone || !addr.line1 || !addr.city) {
      return setErr('Please fill in your name, phone, address and city.');
    }
    setPlacing(true);
    try {
      const res = await api('/api/orders', {
        method: 'POST',
        body: {
          items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          address: addr, paymentMethod: method, coupon: coupon?.code || '', notes
        }
      });
      setPlaced(true);
      clearCart();
      if (res.payment && ['card', 'momo', 'bank'].includes(method)) setPending(res);
      else goToOrder(res.order.id);
    } catch (e) { setErr(e.message); } finally { setPlacing(false); }
  };

  return (
    <Page>
      <View style={{ padding: 16, gap: 14 }}>
        <Card>
          <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 12 }}>Delivery details</Text>
          <Field label="Full name" value={addr.fullName} onChangeText={set('fullName')} autoCapitalize="words" />
          <Field label="Phone" value={addr.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <Field label="Address" value={addr.line1} onChangeText={set('line1')} autoCapitalize="sentences" placeholder="Street, area, landmark" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Field label="City" value={addr.city} onChangeText={set('city')} autoCapitalize="words" style={{ flex: 1 }} />
            <Field label="Region" value={addr.region} onChangeText={set('region')} autoCapitalize="words" style={{ flex: 1 }} />
          </View>
          <Field label="Order notes (optional)" value={notes} onChangeText={setNotes} autoCapitalize="sentences" style={{ marginBottom: 0 }} />
        </Card>

        <Card>
          <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 10 }}>Payment method</Text>
          {METHODS.map((m) => {
            const on = method === m.id;
            return (
              <Pressable key={m.id} onPress={() => setMethod(m.id)} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8, borderRadius: R.m,
                borderWidth: 1.5, borderColor: on ? C.brand : C.line, backgroundColor: on ? C.brandXL : '#fff'
              }}>
                <Ionicons name={METHOD[m.id].icon} size={24} color={on ? C.brand : C.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: C.ink }}>{METHOD[m.id].label}</Text>
                  <Text style={{ color: C.muted, fontSize: 12.5 }}>{m.sub}</Text>
                </View>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? C.brand : C.line} />
              </Pressable>
            );
          })}
        </Card>

        <Card>
          <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 10 }}>Coupon</Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Field value={couponInput} onChangeText={setCouponInput} placeholder="e.g. FREETOWN10" autoCapitalize="characters" style={{ flex: 1, marginBottom: 0 }} error={couponErr} />
            <Button title="Apply" variant="soft" onPress={applyCoupon} disabled={!couponInput.trim()} style={{ paddingVertical: 12 }} />
          </View>
          {coupon ? <Text style={{ color: C.ok, fontWeight: '700', marginTop: 8 }}>✓ {coupon.code} — {coupon.percent}% off</Text> : null}
        </Card>

        <Card>
          <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Summary</Text>
          {lines.map((l) => <Row key={l.productId} label={`${l.qty} × ${l.p.name}`} value={fmt(l.p.priceUSD * l.qty)} />)}
          <View style={{ height: 1, backgroundColor: C.line, marginVertical: 6 }} />
          <Row label="Subtotal" value={fmt(subtotal)} />
          {discount ? <Row label={`Discount (${coupon.code})`} value={'−' + fmt(discount)} color={C.ok} /> : null}
          <Row label="Delivery" value={shipping ? fmt(shipping) : 'Free'} color={shipping ? undefined : C.ok} />
          <View style={{ height: 1, backgroundColor: C.line, marginVertical: 6 }} />
          <Row label="Total" value={fmt(total)} bold />
        </Card>

        {err ? <Text style={{ color: C.red, fontWeight: '600' }}>{err}</Text> : null}
        <Button title={`Place order · ${fmt(total)}`} icon="lock-closed-outline" onPress={place} loading={placing} />
      </View>

      {/* Payment sheets: closing without paying still leaves a valid order the customer can pay from Orders. */}
      <GatewayModal
        visible={!!pending && ['card', 'momo'].includes(pending.payment.method)}
        payment={pending?.payment} order={pending?.order || {}}
        onClose={() => { const id = pending.order.id; setPending(null); goToOrder(id); }}
        onPaid={() => { const id = pending.order.id; setPending(null); goToOrder(id); }}
      />
      <BankModal
        visible={!!pending && pending.payment.method === 'bank'}
        payment={pending?.payment} order={pending?.order || {}}
        onClose={() => { const id = pending.order.id; setPending(null); goToOrder(id); }}
        onSubmitted={() => { const id = pending.order.id; setPending(null); goToOrder(id); }}
      />
    </Page>
  );
}
