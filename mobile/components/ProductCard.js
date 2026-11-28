import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { imageUrl } from '../lib/api';
import { C, R, shadow } from '../lib/theme';

export default function ProductCard({ p, width }) {
  const router = useRouter();
  const { fmt, fmt2, wishlist, toggleWish, addToCart } = useApp();
  const wished = wishlist.includes(p.id);
  const out = p.stock <= 0;
  return (
    <Pressable
      onPress={() => router.push('/product/' + p.id)}
      style={{ width, backgroundColor: C.card, borderRadius: R.m, borderWidth: 1, borderColor: C.line, overflow: 'hidden', ...shadow }}>
      <View style={{ backgroundColor: C.brandXL }}>
        <Image source={{ uri: imageUrl(p.image) }} style={{ width: '100%', aspectRatio: 1 }} resizeMode="cover" />
        <Pressable
          hitSlop={8}
          onPress={() => toggleWish(p.id)}
          style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: '#ffffffee', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={wished ? 'heart' : 'heart-outline'} size={18} color={wished ? C.red : C.ink2} />
        </Pressable>
        {out ? (
          <View style={{ position: 'absolute', left: 8, top: 8, backgroundColor: C.ink, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Sold out</Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 10 }}>
        <Text style={{ fontSize: 11.5, color: C.muted, fontWeight: '600' }}>{p.category}</Text>
        <Text numberOfLines={2} style={{ fontWeight: '700', color: C.ink, fontSize: 14, minHeight: 36, marginTop: 2 }}>{p.name}</Text>
        {p.reviewCount ? (
          <Text style={{ color: C.gold, fontSize: 12, marginTop: 2 }}>★ <Text style={{ color: C.ink2 }}>{p.rating} ({p.reviewCount})</Text></Text>
        ) : <Text style={{ fontSize: 12, marginTop: 2, color: C.muted }}>No reviews yet</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6 }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ fontWeight: '800', color: C.brandD, fontSize: 15 }}>{fmt(p.priceUSD)}</Text>
            <Text style={{ fontSize: 11, color: C.muted }}>{fmt2(p.priceUSD)}</Text>
          </View>
          <Pressable
            disabled={out}
            onPress={() => (Array.isArray(p.sizes) && p.sizes.length ? router.push('/product/' + p.id) : addToCart(p.id, 1))}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: out ? C.line : C.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
