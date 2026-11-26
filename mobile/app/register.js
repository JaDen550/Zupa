import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { C } from '../lib/theme';
import { Button, Field, Page, PasswordField, passwordIssue } from '../components/ui';

export default function Register() {
  const router = useRouter();
  const { register, toast } = useApp();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    setErr('');
    if (f.name.trim().length < 2) return setErr('Enter your full name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return setErr('Enter a valid email address.');
    if (f.phone.trim() && !/^\+?[0-9 ]{8,15}$/.test(f.phone.trim())) return setErr('Enter a valid phone number, e.g. +232 77 123456.');
    const issue = passwordIssue(f.password); if (issue) return setErr(issue);
    if (f.password !== f.confirm) return setErr('The two passwords do not match.');
    setBusy(true);
    try {
      const u = await register({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.password });
      toast(`Welcome, ${u.name.split(' ')[0]}! 🎉`);
      router.canGoBack() ? router.back() : router.replace('/');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Page contentStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: C.ink, marginBottom: 4 }}>Create your account</Text>
        <Text style={{ color: C.muted, marginBottom: 22 }}>It takes less than a minute.</Text>
        <Field label="Full name" value={f.name} onChangeText={set('name')} autoCapitalize="words" autoComplete="name" />
        <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoComplete="email" />
        <Field label="Phone (optional)" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="+232 7X XXX XXX" />
        <PasswordField label="Password" value={f.password} onChangeText={set('password')} strength autoComplete="new-password" />
        <PasswordField label="Confirm password" value={f.confirm} onChangeText={set('confirm')} autoComplete="new-password" onSubmitEditing={submit} />
        {err ? <Text style={{ color: C.red, marginBottom: 12, fontWeight: '600' }}>{err}</Text> : null}
        <Button title="Create account" onPress={submit} loading={busy} />
        <Pressable onPress={() => router.replace('/login')} style={{ marginTop: 18, alignItems: 'center' }}>
          <Text style={{ color: C.ink2 }}>Already have an account? <Text style={{ color: C.brand, fontWeight: '800' }}>Sign in</Text></Text>
        </Pressable>
      </Page>
    </KeyboardAvoidingView>
  );
}
