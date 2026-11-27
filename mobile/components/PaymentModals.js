import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
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

const nleText = (usd, rate) => 'NLe ' + (usd * rate).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Bank transfer or mobile money. The customer pays the store's own account / wallet (details set by the
 * owner in Admin → Settings), then enters the transaction ID. An admin verifies it before the order is paid.
 */
export function TransferModal({ visible, payment, order, onClose, onSubmitted }) {
  const { settings, user, toast } = useApp();
  const pd = settings.paymentDetails || { bank: {}, momo: [] };
  const momoList = (pd.momo || []).filter((m) => m.number);
  const [ref, setRef] = useState('');
  const [provider, setProvider] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!payment) return null;
  const isMomo = payment.method === 'momo';
  const prov = provider || (momoList[0] && momoList[0].provider) || '';
  const b = pd.bank || {};
  const rate = payment.exchangeRate || settings.exchangeRate || 1;

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const body = isMomo ? { reference: ref, provider: prov, senderPhone: phone } : { reference: ref };
      await api(`/api/payments/${payment.id}/submit-reference`, { method: 'POST', body });
      toast('Submitted — we will verify it'); setRef('');
      onSubmitted && onSubmitted();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const line = { color: C.ink2 };
  const strong = { fontWeight: '800', color: C.ink };

  return (
    <Sheet visible={visible} onClose={onClose} title={isMomo ? '📱 Mobile money' : '🏦 Bank transfer'}>
      <Text style={{ color: C.ink2, marginBottom: 12 }}>Your order <Text style={{ fontWeight: '800' }}>{order.id}</Text> is reserved. Pay it, then enter your {isMomo ? 'transaction ID' : 'reference'} below.</Text>
      <View style={{ backgroundColor: C.brandXL, borderRadius: R.m, padding: 14, marginBottom: 14, gap: 3 }}>
        <Text style={{ color: C.muted }}>Send exactly</Text>
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.brandD, marginBottom: 6 }}>{nleText(payment.amountUSD, rate)}</Text>
        {isMomo ? (
          <>
            {momoList.map((m) => (
              <View key={m.provider} style={{ marginBottom: 6 }}>
                <Text style={line}>{m.provider}: <Text style={strong} selectable>{m.number}</Text></Text>
                <Text style={{ color: C.muted, fontSize: 12.5 }}>Name: {m.accountName}</Text>
              </View>
            ))}
          </>
        ) : (
          <>
            <Text style={line}>Account name: <Text style={strong}>{b.accountName}</Text></Text>
            <Text style={line}>Bank: <Text style={strong}>{b.bankName}</Text>{b.branch ? ` · ${b.branch}` : ''}</Text>
            <Text style={line}>Account no: <Text style={strong} selectable>{b.accountNumber}</Text></Text>
          </>
        )}
        <Text style={line}>Reference / note: <Text style={strong} selectable>{order.id}</Text></Text>
      </View>
      {isMomo ? (
        <>
          <Text style={{ fontWeight: '600', color: C.ink2, marginBottom: 6 }}>Provider you paid with</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {momoList.map((m) => (
              <Pressable key={m.provider} onPress={() => setProvider(m.provider)} style={{
                paddingHorizontal: 12, paddingVertical: 9, borderRadius: R.s, borderWidth: 1.5,
                borderColor: prov === m.provider ? C.brand : C.line, backgroundColor: prov === m.provider ? C.brandL : '#fff'
              }}>
                <Text style={{ fontWeight: '700', color: prov === m.provider ? C.brandD : C.ink2 }}>{m.provider}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Phone you sent from" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+232 7X XXX XXX" />
        </>
      ) : null}
      <Field label={isMomo ? 'Transaction ID from the confirmation SMS' : 'Transfer reference / transaction ID'} value={ref} onChangeText={setRef} placeholder="From your receipt or SMS" autoCapitalize="characters" />
      {err ? <Text style={{ color: C.red, marginBottom: 10, fontWeight: '600' }}>{err}</Text> : null}
      <Button title="I have paid — submit" onPress={submit} loading={busy} />
      <Text style={{ color: C.muted, fontSize: 12.5, textAlign: 'center', marginTop: 10 }}>
        Our team checks your payment and your order moves to “Paid”.
      </Text>
    </Sheet>
  );
}
