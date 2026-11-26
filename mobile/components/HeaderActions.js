import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { C } from '../lib/theme';

// Cart + Orders buttons shown in the top-right corner of every main screen.
export default function HeaderActions({ light = false }) {
  const router = useRouter();
  const { cartCount, user } = useApp();
  if (user && user.role === 'admin') return null; // admins oversee the store, they do not shop
  const color = light ? '#fff' : C.ink;
  const Btn = ({ icon, label, href, badge }) => (
    <Pressable onPress={() => router.push(href)} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
      style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: light ? 'rgba(255,255,255,0.2)' : C.brandL }}>
      <Ionicons name={icon} size={21} color={light ? '#fff' : C.brandD} />
      {badge > 0 ? (
        <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: C.ink, fontSize: 10.5, fontWeight: '800' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginRight: 12 }}>
      <Btn icon="receipt-outline" label="My orders" href="/orders" />
      <Btn icon="cart-outline" label="Cart" href="/cart" badge={cartCount} />
    </View>
  );
}
