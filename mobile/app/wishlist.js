import React from 'react';
import { useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { useLoad } from '../lib/hooks';
import { Button, Empty, ErrorBox, Loading, Page } from '../components/ui';
import ProductGrid from '../components/ProductGrid';

export default function Wishlist() {
  const router = useRouter();
  const { wishlist } = useApp();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => api('/api/products', { auth: false }), []);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const items = data.filter((p) => wishlist.includes(p.id));
  if (!items.length) {
    return <Empty icon="heart-outline" title="Your wishlist is empty" text="Tap the heart on any product to save it."
      action={<Button title="Browse products" onPress={() => router.push('/shop')} />} />;
  }
  return <Page onRefresh={refresh} refreshing={refreshing} contentStyle={{ paddingTop: 16 }}><ProductGrid products={items} /></Page>;
}
