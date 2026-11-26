import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import HeaderActions from '../../components/HeaderActions';
import { C } from '../../lib/theme';

const icon = (name) => ({ color, size, focused }) =>
  <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />;

export default function TabsLayout() {
  const router = useRouter();
  const back = () => (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} style={{ marginLeft: 14 }}>
      <Ionicons name="chevron-back" size={24} color={C.ink} />
    </Pressable>
  );
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerRight: () => <HeaderActions />,
        tabBarActiveTintColor: C.brand, tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        headerStyle: { backgroundColor: '#fff' }, headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', color: C.ink }, sceneStyle: { backgroundColor: C.bg }
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false, tabBarIcon: icon('home') }} />
      <Tabs.Screen name="shop" options={{ title: 'Shop', tabBarIcon: icon('storefront') }} />
      <Tabs.Screen name="cart" options={{ title: 'Cart', href: null, headerLeft: back }} />
      <Tabs.Screen name="orders" options={{ title: 'My Orders', href: null, headerLeft: back }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
