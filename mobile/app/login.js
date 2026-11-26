import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { C } from '../lib/theme';
import { Button, Field, Page, PasswordField } from '../components/ui';

export default function Login() {
  const router = useRouter();
  const { login, toast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr('Enter a valid email address.');
    if (!password) return setErr('Enter your password.');
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      toast(`Welcome back, ${u.name.split(' ')[0]}!`);
      router.canGoBack() ? router.back() : router.replace('/');
    } catch (e) { setErr(e.message); setPassword(''); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Page contentStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: C.ink, marginBottom: 4 }}>Welcome back</Text>
        <Text style={{ color: C.muted, marginBottom: 22 }}>Sign in to check out, track orders and write reviews.</Text>
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
        <PasswordField label="Password" value={password} onChangeText={setPassword} autoComplete="password" placeholder="••••••••" onSubmitEditing={submit} />
        <Pressable onPress={() => router.push({ pathname: '/forgot', params: { email: email.trim() } })} style={{ alignSelf: 'flex-end', marginTop: -6, marginBottom: 14 }}>
          <Text style={{ color: C.brandD, fontWeight: '700' }}>Forgot password?</Text>
        </Pressable>
        {err ? <Text style={{ color: C.red, marginBottom: 12, fontWeight: '600' }}>{err}</Text> : null}
        <Button title="Sign in" onPress={submit} loading={busy} />
        <Pressable onPress={() => router.replace('/register')} style={{ marginTop: 18, alignItems: 'center' }}>
          <Text style={{ color: C.ink2 }}>New here? <Text style={{ color: C.brand, fontWeight: '800' }}>Create an account</Text></Text>
        </Pressable>
        <View style={{ marginTop: 28, padding: 14, backgroundColor: C.brandXL, borderRadius: 12 }}>
          <Text style={{ fontWeight: '800', color: C.brandD, marginBottom: 4 }}>Demo accounts</Text>
          <Text style={{ color: C.ink2 }}>Customer: demo@zupa.sl / demo123</Text>
        </View>
      </Page>
    </KeyboardAvoidingView>
  );
}
