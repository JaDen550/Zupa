import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { C } from '../../lib/theme';

const icon = (name) => ({ color, size, focused }) =>
  <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />;

export default function AdminLayout() {
  const { user, isAdmin } = useApp();
  if (!user || !isAdmin) return <Redirect href="/" />; // customers never see the admin area

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.purple, tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        headerStyle: { backgroundColor: '#fff' }, headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', color: C.ink }, sceneStyle: { backgroundColor: C.bg }
      }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: icon('speedometer') }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: icon('receipt') }} />
      <Tabs.Screen name="payments" options={{ title: 'Payments', tabBarIcon: icon('card') }} />
      <Tabs.Screen name="products" options={{ title: 'Products', tabBarIcon: icon('cube') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('menu') }} />
      <Tabs.Screen name="customers" options={{ title: 'Customers', href: null }} />
      <Tabs.Screen name="coupons" options={{ title: 'Coupons', href: null }} />
      <Tabs.Screen name="settings" options={{ title: 'Store settings', href: null }} />
    </Tabs>
  );
}
