import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { BANK } from '../lib/config';
import { C, R } from '../lib/theme';
import { Button, Field } from './ui';

export function Sheet({ visible, title, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, paddingBottom: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>{title}</Text>
            <Ionicons name="close" size={26} color={C.muted} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingTop: 6, paddingBottom: 34 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const PROVIDERS = ['Orange Money', 'Africell Money', 'QMoney'];

/** Card or mobile-money payment through the ZUPA Pay gateway. */
export function GatewayModal({ visible, payment, order, onClose, onPaid }) {
  const { fmt, user, toast } = useApp();
  const [card, setCard] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [phone, setPhone] = useState(user?.phone || '');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!payment) return null;
  const isMomo = payment.method === 'momo';

  const fmtCard = (t) => t.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  const fmtExp = (t) => { const d = t.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; };

  const pay = async () => {
    setErr('');
    if (isMomo && pin.length < 4) return setErr('Enter your wallet PIN to approve the payment.');
    if (!isMomo && (exp.length < 5 || cvc.length < 3)) return setErr('Enter the card expiry (MM/YY) and CVC.');
    setBusy(true);
    try {
      const body = isMomo ? { momoProvider: provider, momoPhone: phone } : { cardNumber: card };
      await api(`/api/payments/${payment.id}/process`, { method: 'POST', body });
      toast('Payment successful 🎉');
      setCard(''); setCvc(''); setPin('');
      onPaid && onPaid();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={isMomo ? '📱 Mobile Money' : '💳 Card payment'}>
      <View style={{ backgroundColor: C.brandXL, borderRadius: R.m, padding: 14, marginBottom: 14 }}>
        <Text style={{ color: C.muted }}>Order {order.id}</Text>
        <Text style={{ fontSize: 24, fontWeight: '900', color: C.brandD }}>{fmt(payment.amountUSD, payment.exchangeRate)}</Text>
      </View>
      {isMomo ? (
        <>
          <Text style={{ fontWeight: '600', color: C.ink2, marginBottom: 6 }}>Provider</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {PROVIDERS.map((p) => (
              <Pressable key={p} onPress={() => setProvider(p)} style={{
                paddingHorizontal: 12, paddingVertical: 9, borderRadius: R.s, borderWidth: 1.5,
                borderColor: provider === p ? C.brand : C.line, backgroundColor: provider === p ? C.brandL : '#fff'
              }}>
                <Text style={{ fontWeight: '700', color: provider === p ? C.brandD : C.ink2 }}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Wallet phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+232 7X XXX XXX" />
          <Field label="Wallet PIN" value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry placeholder="••••" />
        </>
      ) : (
        <>
          <Field label="Card number" value={card} onChangeText={(t) => setCard(fmtCard(t))} keyboardType="number-pad" placeholder="4242 4242 4242 4242" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Field label="Expiry" value={exp} onChangeText={(t) => setExp(fmtExp(t))} keyboardType="number-pad" placeholder="MM/YY" style={{ flex: 1 }} />
            <Field label="CVC" value={cvc} onChangeText={(t) => setCvc(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry placeholder="123" style={{ flex: 1 }} />
          </View>
          <Text style={{ color: C.muted, fontSize: 12.5, marginBottom: 12 }}>
            Demo gateway: use 4242 4242 4242 4242 to succeed — cards ending in 0 are declined.
          </Text>
        </>
      )}
      {err ? <Text style={{ color: C.red, marginBottom: 10, fontWeight: '600' }}>{err}</Text> : null}
      <Button title={`Pay ${fmt(payment.amountUSD, payment.exchangeRate)}`} icon="lock-closed-outline" onPress={pay} loading={busy} />
    </Sheet>
  );
}

/** Bank transfer: show account details and collect the customer's transfer reference. */
export function BankModal({ visible, payment, order, onClose, onSubmitted }) {
  const { fmt, toast } = useApp();
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!payment) return null;

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      await api(`/api/payments/${payment.id}/submit-reference`, { method: 'POST', body: { reference: ref } });
      toast('Reference submitted — we will verify it'); setRef('');
      onSubmitted && onSubmitted();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="🏦 Bank transfer">
      <Text style={{ color: C.ink2, marginBottom: 12 }}>Your order <Text style={{ fontWeight: '800' }}>{order.id}</Text> is reserved. Transfer exactly:</Text>
      <View style={{ backgroundColor: C.brandXL, borderRadius: R.m, padding: 14, marginBottom: 14, gap: 3 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.brandD, marginBottom: 6 }}>{fmt(payment.amountUSD, payment.exchangeRate)}</Text>
        <Text style={{ color: C.ink2 }}>Account name: <Text style={{ fontWeight: '800', color: C.ink }}>{BANK.name}</Text></Text>
        <Text style={{ color: C.ink2 }}>Bank: <Text style={{ fontWeight: '800', color: C.ink }}>{BANK.bank}</Text></Text>
        <Text style={{ color: C.ink2 }}>Account no: <Text style={{ fontWeight: '800', color: C.ink }} selectable>{BANK.account}</Text></Text>
        <Text style={{ color: C.ink2 }}>Reference: <Text style={{ fontWeight: '800', color: C.ink }} selectable>{order.id}</Text></Text>
      </View>
      <Field label="Transfer reference / transaction ID" value={ref} onChangeText={setRef} placeholder="e.g. SL26 9001 4455 8890" autoCapitalize="characters" />
      {err ? <Text style={{ color: C.red, marginBottom: 10, fontWeight: '600' }}>{err}</Text> : null}
      <Button title="I have paid — submit reference" onPress={submit} loading={busy} />
      <Text style={{ color: C.muted, fontSize: 12.5, textAlign: 'center', marginTop: 10 }}>
        Our team verifies transfers and your order moves to “Paid”.
      </Text>
    </Sheet>
  );
}
