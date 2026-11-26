import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '../../lib/theme';
import { Card, Page } from '../../components/ui';

const ITEMS = [
  { icon: 'people-outline', label: 'Customers', sub: 'Accounts, orders and spend', to: '/admin/customers' },
  { icon: 'pricetags-outline', label: 'Coupons', sub: 'Create and retire discount codes', to: '/admin/coupons' },
  { icon: 'settings-outline', label: 'Store settings', sub: 'Exchange rate, delivery fees, categories', to: '/admin/settings' }
];

export default function More() {
  const router = useRouter();
  return (
    <Page>
      <View style={{ padding: 16, gap: 12 }}>
        <Card style={{ paddingVertical: 4 }}>
          {ITEMS.map((i) => (
            <Pressable key={i.to} onPress={() => router.push(i.to)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.purpleL, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={i.icon} size={20} color={C.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: C.ink, fontSize: 15.5 }}>{i.label}</Text>
                <Text style={{ color: C.muted, fontSize: 12.5 }}>{i.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </Pressable>
          ))}
        </Card>
        <Card style={{ paddingVertical: 4 }}>
          <Pressable onPress={() => router.replace('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.brandL, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="storefront-outline" size={20} color={C.brand} />
            </View>
            <Text style={{ flex: 1, fontWeight: '700', color: C.ink, fontSize: 15.5 }}>Back to storefront</Text>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </Pressable>
        </Card>
      </View>
    </Page>
  );
}
