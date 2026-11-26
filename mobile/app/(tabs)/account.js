import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { DEFAULT_API_URL } from '../../lib/config';
import { C, R } from '../../lib/theme';
import { Button, Card, Field, Page, PasswordField, Segmented, passwordIssue } from '../../components/ui';
import { Sheet } from '../../components/PaymentModals';
import { api } from '../../lib/api';

function Item({ icon, label, onPress, sub, color }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.brandL, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={19} color={color || C.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: C.ink, fontSize: 15.5 }}>{label}</Text>
        {sub ? <Text style={{ color: C.muted, fontSize: 12.5 }}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.muted} />
    </Pressable>
  );
}

export default function Account() {
  const router = useRouter();
  const { user, setUser, logout, isAdmin, currency, setCurrency, settings, wishlist, serverUrl, setServerUrl, toast } = useApp();
  const [url, setUrl] = useState(serverUrl);
  const [showServer, setShowServer] = useState(false);

  const [sheet, setSheet] = useState(null); // 'password' | 'delete' | 'profile'
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pName, setPName] = useState(user?.name || '');
  const [pPhone, setPPhone] = useState(user?.phone || '');
  const [pCity, setPCity] = useState(user?.city || '');
  const [busy, setBusy] = useState(false);
  const closeSheet = () => { setSheet(null); setPw1(''); setPw2(''); };
  const run = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast(okMsg); closeSheet(); }
    catch (e) { Alert.alert('Something went wrong', e.message); } finally { setBusy(false); }
  };
  const changePassword = () => {
    const issue = passwordIssue(pw2); if (issue) return Alert.alert('Weak password', issue);
    run(() => api('/api/auth/change-password', { method: 'POST', body: { current: pw1, next: pw2 } }), 'Password updated ✅');
  };
  const saveProfile = () => run(async () => {
    const r = await api('/api/auth/profile', { method: 'PUT', body: { name: pName, phone: pPhone, city: pCity } });
    setUser(r.user);
  }, 'Profile updated ✅');
  const deleteAccount = () => run(async () => {
    await api('/api/auth/account', { method: 'DELETE', body: { password: pw1 } });
    await logout();
  }, 'Your account has been deleted');
  const signOutOthers = () => run(() => api('/api/auth/logout-all', { method: 'POST' }), 'Signed out of all other devices ✅');
  const signOut = () => Alert.alert('Sign out?', undefined, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: logout }
  ]);

  return (
    <Page>
      <View style={{ padding: 16, gap: 14 }}>
        {user ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>{user.name}</Text>
              <Text style={{ color: C.muted }}>{user.email}</Text>
              {isAdmin ? <Text style={{ color: C.purple, fontWeight: '800', fontSize: 12, marginTop: 2 }}>ADMINISTRATOR</Text> : null}
            </View>
          </Card>
        ) : (
          <Card>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>Welcome to {settings.storeName}</Text>
            <Text style={{ color: C.muted, marginTop: 4, marginBottom: 14 }}>Sign in to check out, track orders and write reviews.</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Sign in" onPress={() => router.push('/login')} style={{ flex: 1 }} />
              <Button title="Register" variant="outline" onPress={() => router.push('/register')} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        {isAdmin ? (
          <Card style={{ backgroundColor: C.purpleL, borderColor: 'transparent' }}>
            <Item icon="speedometer-outline" color={C.purple} label="Admin portal" sub="Dashboard, orders, payments, products…" onPress={() => router.push('/admin')} />
          </Card>
        ) : null}

        {!isAdmin ? (
          <Card style={{ paddingVertical: 4 }}>
            <Item icon="receipt-outline" label="My orders" onPress={() => router.push('/orders')} />
            <Item icon="heart-outline" label="Wishlist" sub={`${wishlist.length} saved`} onPress={() => router.push('/wishlist')} />
          </Card>
        ) : null}

        <Card>
          <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 10 }}>Currency</Text>
          <Segmented value={currency} onChange={setCurrency}
            options={[{ value: 'SLE', label: 'NLe' }, { value: 'USD', label: 'Dollars ($)' }]} />
          <Text style={{ color: C.muted, fontSize: 12.5, marginTop: 8 }}>Rate: $1 = NLe {settings.exchangeRate}</Text>
        </Card>

        <Card>
          <Pressable onPress={() => setShowServer((s) => !s)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '800', color: C.ink }}>Server address</Text>
            <Ionicons name={showServer ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
          </Pressable>
          <Text style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>{serverUrl}</Text>
          {showServer ? (
            <View style={{ marginTop: 12 }}>
              <Field value={url} onChangeText={setUrl} keyboardType="url" placeholder={DEFAULT_API_URL} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Save" small onPress={async () => { await setServerUrl(url); toast('Server updated'); }} style={{ flex: 1 }} />
                <Button title="Reset" small variant="outline" onPress={async () => { setUrl(DEFAULT_API_URL); await setServerUrl(DEFAULT_API_URL); }} style={{ flex: 1 }} />
              </View>
            </View>
          ) : null}
        </Card>

        {user ? (
          <Card style={{ paddingVertical: 4 }}>
            <Item icon="person-outline" label="Edit profile" onPress={() => { setPName(user.name || ''); setPPhone(user.phone || ''); setPCity(user.city || ''); setSheet('profile'); }} />
            <Item icon="key-outline" label="Change password" onPress={() => setSheet('password')} />
            <Item icon="shield-checkmark-outline" label="Sign out of other devices" onPress={signOutOthers} />
            {!isAdmin ? <Item icon="trash-outline" label="Delete my account" color={C.red} onPress={() => setSheet('delete')} /> : null}
          </Card>
        ) : null}
        {user ? <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={signOut} /> : null}
        <Text style={{ textAlign: 'center', color: C.muted, fontSize: 12 }}>{settings.storeName} · v1.0.0</Text>
      </View>
      <Sheet visible={sheet === 'profile'} title="Edit profile" onClose={closeSheet}>
        <Field label="Full name" value={pName} onChangeText={setPName} autoCapitalize="words" />
        <Field label="Phone" value={pPhone} onChangeText={setPPhone} keyboardType="phone-pad" />
        <Field label="City" value={pCity} onChangeText={setPCity} autoCapitalize="words" />
        <Button title="Save changes" onPress={saveProfile} loading={busy} />
      </Sheet>
      <Sheet visible={sheet === 'password'} title="Change password" onClose={closeSheet}>
        <PasswordField label="Current password" value={pw1} onChangeText={setPw1} autoComplete="current-password" />
        <PasswordField label="New password" value={pw2} onChangeText={setPw2} strength autoComplete="new-password" />
        <Button title="Update password" onPress={changePassword} loading={busy} />
      </Sheet>
      <Sheet visible={sheet === 'delete'} title="Delete account" onClose={closeSheet}>
        <Text style={{ color: C.ink2, marginBottom: 12 }}>This permanently removes your profile and sign-in. Past orders stay with the store for its records, without your personal details. This cannot be undone.</Text>
        <PasswordField label="Enter your password to confirm" value={pw1} onChangeText={setPw1} />
        <Button title="Delete my account" variant="danger" onPress={deleteAccount} loading={busy} />
      </Sheet>
    </Page>
  );
}
