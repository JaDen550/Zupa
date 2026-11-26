import React from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C, R, STATUS, shadow } from '../lib/theme';

export function Button({ title, onPress, variant = 'solid', loading, disabled, icon, style, small }) {
  const solid = variant === 'solid';
  const danger = variant === 'danger';
  const bg = solid ? C.brand : danger ? C.redL : variant === 'soft' ? C.brandL : 'transparent';
  const fg = solid ? '#fff' : danger ? C.red : C.brandD;
  const border = variant === 'outline' ? C.brand : 'transparent';
  const off = disabled || loading;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [{
        backgroundColor: bg, borderColor: border, borderWidth: 1.5, borderRadius: R.m,
        paddingVertical: small ? 9 : 14, paddingHorizontal: small ? 14 : 18,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        opacity: off ? 0.55 : pressed ? 0.85 : 1
      }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 13.5 : 15.5 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, error, style, ...props }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Text style={{ fontWeight: '600', color: C.ink2, marginBottom: 6, fontSize: 13.5 }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#a8a29b"
        autoCapitalize="none"
        {...props}
        style={[{
          backgroundColor: '#fff', borderWidth: 1.5, borderColor: error ? C.red : C.line,
          borderRadius: R.s, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15.5, color: C.ink
        }, props.multiline ? { minHeight: 80, textAlignVertical: 'top' } : null]}
      />
      {error ? <Text style={{ color: C.red, marginTop: 4, fontSize: 12.5 }}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style, onPress }) {
  const Comp = onPress ? Pressable : View;
  return (
    <Comp onPress={onPress} style={[{
      backgroundColor: C.card, borderRadius: R.m, padding: 14, borderWidth: 1, borderColor: C.line, ...shadow
    }, style]}>
      {children}
    </Comp>
  );
}

export function Badge({ status, label }) {
  const s = STATUS[status] || { label: status, fg: C.ink2, bg: C.line };
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: s.fg, fontWeight: '700', fontSize: 11.5 }}>{label || s.label}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, marginRight: 8,
      backgroundColor: active ? C.brand : '#fff', borderWidth: 1.5, borderColor: active ? C.brand : C.line
    }}>
      <Text style={{ color: active ? '#fff' : C.ink2, fontWeight: '600', fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  );
}

export function Loading({ style }) {
  return <View style={[{ padding: 40, alignItems: 'center' }, style]}><ActivityIndicator size="large" color={C.brand} /></View>;
}

export function ErrorBox({ message, onRetry }) {
  const router = useRouter();
  const unreachable = /can't reach the store server/i.test(message || '');
  return (
    <View style={{ padding: 28, alignItems: 'center' }}>
      <Ionicons name="cloud-offline-outline" size={44} color={C.muted} />
      <Text style={{ color: C.ink2, textAlign: 'center', marginVertical: 12 }}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="outline" onPress={onRetry} small /> : null}
      {unreachable ? <Button title="Change server address" variant="soft" onPress={() => router.push('/account')} small style={{ marginTop: 10 }} /> : null}
    </View>
  );
}

export function Empty({ icon = 'bag-outline', title, text, action }) {
  return (
    <View style={{ padding: 36, alignItems: 'center' }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.brandL, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={38} color={C.brand} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 16 }}>{title}</Text>
      {text ? <Text style={{ color: C.muted, textAlign: 'center', marginTop: 6, marginBottom: 16 }}>{text}</Text> : null}
      {action}
    </View>
  );
}

export function Section({ title, right, children, style }) {
  return (
    <View style={[{ marginTop: 18 }, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Scrollable page with pull-to-refresh. */
export function Page({ children, onRefresh, refreshing, contentStyle, ...rest }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={[{ paddingBottom: 40 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.brand} /> : undefined}
      {...rest}>
      {children}
    </ScrollView>
  );
}

export function Row({ label, value, bold, color }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: bold ? C.ink : C.ink2, fontWeight: bold ? '800' : '400', fontSize: bold ? 17 : 14.5 }}>{label}</Text>
      <Text style={{ color: color || (bold ? C.brandD : C.ink), fontWeight: bold ? '800' : '600', fontSize: bold ? 17 : 14.5 }}>{value}</Text>
    </View>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99 }) {
  const btn = (txt, on, off) => (
    <Pressable onPress={off ? undefined : on} style={{
      width: 34, height: 34, borderRadius: 17, backgroundColor: off ? C.line : C.brandL, alignItems: 'center', justifyContent: 'center'
    }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.brandD }}>{txt}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {btn('−', () => onChange(value - 1), value <= min)}
      <Text style={{ fontWeight: '800', fontSize: 16, minWidth: 22, textAlign: 'center' }}>{value}</Text>
      {btn('+', () => onChange(value + 1), value >= max)}
    </View>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.line, borderRadius: R.s, padding: 3 }}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={{
          flex: 1, paddingVertical: 8, borderRadius: R.s - 2, alignItems: 'center',
          backgroundColor: value === o.value ? '#fff' : 'transparent'
        }}>
          <Text style={{ fontWeight: '700', color: value === o.value ? C.brandD : C.muted, fontSize: 13.5 }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}


const pwLevel = (pw) => {
  let n = 0;
  if (pw.length >= 8) n++; if (pw.length >= 12) n++;
  if (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw)) n++;
  if (/[^A-Za-z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) n++;
  return Math.min(n, 4);
};
export const passwordIssue = (pw) => {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use at least one letter and one number in your password.';
  return '';
};

// Password input with a show/hide eye and (optionally) a strength bar
export function PasswordField({ label, value, onChangeText, strength, style, ...props }) {
  const [show, setShow] = React.useState(false);
  const lvl = value ? pwLevel(value) : -1;
  const names = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'];
  const colors = [C.red, C.red, C.gold, '#84cc16', C.ok];
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Text style={{ fontWeight: '600', color: C.ink2, marginBottom: 6, fontSize: 13.5 }}>{label}</Text> : null}
      <View>
        <TextInput
          placeholderTextColor="#a8a29b" autoCapitalize="none" autoCorrect={false}
          {...props} value={value} onChangeText={onChangeText} secureTextEntry={!show}
          style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.line, borderRadius: R.s, paddingLeft: 13, paddingRight: 48, paddingVertical: 12, fontSize: 15.5, color: C.ink }}
        />
        <Pressable onPress={() => setShow((v) => !v)} hitSlop={8} accessibilityLabel={show ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: 8, top: 0, bottom: 0, width: 38, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.muted} />
        </Pressable>
      </View>
      {strength ? (
        <View style={{ marginTop: 7 }}>
          {value ? (
            <View style={{ height: 6, borderRadius: 6, backgroundColor: '#eee8e1', overflow: 'hidden' }}>
              <View style={{ height: 6, borderRadius: 6, width: `${Math.max(1, lvl) * 25}%`, backgroundColor: colors[lvl] }} />
            </View>
          ) : null}
          <Text style={{ color: C.muted, fontSize: 12.5, marginTop: 5 }}>{value ? names[lvl] + ' · ' : ''}At least 8 characters with a letter and a number</Text>
        </View>
      ) : null}
    </View>
  );
}
