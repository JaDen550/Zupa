import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import { C } from '../lib/theme';
import { Button, Field, Page, PasswordField, passwordIssue } from '../components/ui';

export default function Forgot() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { toast } = useApp();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(String(params.email || ''));
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    setErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr('Enter a valid email address.');
    setBusy(true);
    try { await api('/api/auth/forgot', { method: 'POST', body: { email: email.trim() }, auth: false }); setStep(2); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const reset = async () => {
    setErr('');
    if (!/^\d{6}$/.test(code.trim())) return setErr('Enter the 6-digit code.');
    const issue = passwordIssue(pw); if (issue) return setErr(issue);
    setBusy(true);
    try {
      await api('/api/auth/reset', { method: 'POST', body: { email: email.trim(), code: code.trim(), password: pw }, auth: false });
      toast('Password updated — please sign in ✅');
      router.replace('/login');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Page contentStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: C.ink, marginBottom: 4 }}>Reset your password</Text>
        {step === 1 ? (
          <>
            <Text style={{ color: C.muted, marginBottom: 22 }}>Enter your account email and we will send a 6-digit code.</Text>
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" onSubmitEditing={send} />
            {err ? <Text style={{ color: C.red, marginBottom: 12, fontWeight: '600' }}>{err}</Text> : null}
            <Button title="Send code" onPress={send} loading={busy} />
          </>
        ) : (
          <>
            <Text style={{ color: C.muted, marginBottom: 22 }}>If {email.trim()} has an account, a code was sent. It works for 15 minutes.</Text>
            <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="123456" />
            <PasswordField label="New password" value={pw} onChangeText={setPw} strength autoComplete="new-password" onSubmitEditing={reset} />
            {err ? <Text style={{ color: C.red, marginBottom: 12, fontWeight: '600' }}>{err}</Text> : null}
            <Button title="Set new password" onPress={reset} loading={busy} />
            <Pressable onPress={() => { setStep(1); setErr(''); }} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: C.brand, fontWeight: '700' }}>Use a different email</Text>
            </Pressable>
          </>
        )}
      </Page>
    </KeyboardAvoidingView>
  );
}
