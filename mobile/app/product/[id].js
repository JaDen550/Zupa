import React, { useState } from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { api, imageUrl } from '../../lib/api';
import { useLoad } from '../../lib/hooks';
import { stars, fmtDay } from '../../lib/format';
import { C, R } from '../../lib/theme';
import { Button, Card, ErrorBox, Field, Loading, Page, Section, Stepper } from '../../components/ui';

export default function ProductScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { fmt, fmt2, addToCart, wishlist, toggleWish, user, toast } = useApp();
  const { data: p, error, loading, reload } = useLoad(() => api('/api/products/' + id, { auth: false }), [id]);
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [reviewErr, setReviewErr] = useState('');

  if (loading) return <Loading />;
  if (error || !p) return <ErrorBox message={error || 'Product not found.'} onRetry={reload} />;

  const wished = wishlist.includes(p.id);
  const out = p.stock <= 0;
  const alreadyReviewed = user && p.reviews.some((r) => r.userId === user.id);

  const submitReview = async () => {
    setReviewErr('');
    if (!rating) return setReviewErr('Please choose a star rating.');
    setPosting(true);
    try {
      await api(`/api/products/${p.id}/reviews`, { method: 'POST', body: { rating, comment } });
      toast('Thanks for your review!'); setRating(0); setComment(''); reload();
    } catch (e) { setReviewErr(e.message); } finally { setPosting(false); }
  };

  return (
    <>
      <Stack.Screen options={{
        title: p.name,
        headerRight: () => (
          <Ionicons name={wished ? 'heart' : 'heart-outline'} size={24} color={wished ? C.red : C.brandD} onPress={() => toggleWish(p.id)} />
        )
      }} />
      <Page>
        <Image source={{ uri: imageUrl(p.image) }} style={{ width, height: Math.min(width, 460), backgroundColor: C.brandXL }} resizeMode="cover" />
        <View style={{ padding: 16 }}>
          <Text style={{ color: C.muted, fontWeight: '600' }}>{p.category}</Text>
          <Text style={{ fontSize: 24, fontWeight: '900', color: C.ink, marginTop: 2 }}>{p.name}</Text>
          <Text style={{ color: C.gold, fontSize: 15, marginTop: 4 }}>
            {stars(p.rating)} <Text style={{ color: C.ink2 }}>{p.reviewCount ? `${p.rating} (${p.reviewCount})` : 'No reviews yet'}</Text>
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: C.brandD }}>{fmt(p.priceUSD)}</Text>
            <Text style={{ color: C.muted, fontSize: 15 }}>{fmt2(p.priceUSD)}</Text>
          </View>
          <Text style={{ marginTop: 6, fontWeight: '700', color: out ? C.red : p.stock <= 5 ? C.amber : C.ok }}>
            {out ? 'Out of stock' : p.stock <= 5 ? `Only ${p.stock} left` : 'In stock'}
          </Text>
          <Text style={{ color: C.ink2, lineHeight: 22, marginTop: 12, fontSize: 15 }}>{p.description}</Text>

          {!out && Array.isArray(p.sizes) && p.sizes.length ? (
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: C.muted, marginBottom: 8 }}>Size: <Text style={{ fontWeight: '800', color: C.ink }}>{size || 'Select a size'}</Text></Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {p.sizes.map((z) => (
                  <Pressable key={z} onPress={() => setSize(z)} accessibilityLabel={'Size ' + z}
                    style={{ minWidth: 46, height: 40, paddingHorizontal: 10, borderRadius: R.s, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
                      borderColor: size === z ? C.brand : C.line, backgroundColor: size === z ? C.brand : '#fff' }}>
                    <Text style={{ fontWeight: '800', color: size === z ? '#fff' : C.ink2 }}>{z}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {!out ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
              <Stepper value={qty} onChange={setQty} max={p.stock} />
              <Button title="Add to cart" icon="cart-outline" onPress={() => {
                if (Array.isArray(p.sizes) && p.sizes.length && !size) { toast('Please choose a size first.'); return; }
                addToCart(p.id, qty, size); setQty(1);
              }} style={{ flex: 1, marginLeft: 16 }} />
            </View>
          ) : null}
        </View>

        <Section title={`Reviews (${p.reviewCount})`}>
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {p.reviews.map((r) => (
              <Card key={r.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '700', color: C.ink }}>{r.userName}</Text>
                  <Text style={{ color: C.muted, fontSize: 12.5 }}>{fmtDay(r.createdAt)}</Text>
                </View>
                <Text style={{ color: C.gold, marginVertical: 3 }}>{stars(r.rating)}</Text>
                {r.comment ? <Text style={{ color: C.ink2 }}>{r.comment}</Text> : null}
              </Card>
            ))}

            {!user ? (
              <Card><Button title="Sign in to write a review" variant="outline" small onPress={() => router.push('/login')} /></Card>
            ) : alreadyReviewed ? null : (
              <Card>
                <Text style={{ fontWeight: '800', marginBottom: 8 }}>Write a review</Text>
                <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setRating(n)} hitSlop={4}>
                      <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={30} color={C.gold} />
                    </Pressable>
                  ))}
                </View>
                <Field placeholder="Share your experience (optional)" value={comment} onChangeText={setComment} multiline autoCapitalize="sentences" />
                {reviewErr ? <Text style={{ color: C.red, marginBottom: 8 }}>{reviewErr}</Text> : null}
                <Button title="Post review" onPress={submitReview} loading={posting} small />
              </Card>
            )}
          </View>
        </Section>

        {p.related?.length ? (
          <Section title="You may also like">
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {p.related.map((x) => (
                <Card key={x.id} onPress={() => router.push('/product/' + x.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
                  <Image source={{ uri: imageUrl(x.image) }} style={{ width: 56, height: 56, borderRadius: R.s, backgroundColor: C.brandXL }} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontWeight: '700', color: C.ink }}>{x.name}</Text>
                    <Text style={{ color: C.brandD, fontWeight: '800' }}>{fmt(x.priceUSD)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.muted} />
                </Card>
              ))}
            </View>
          </Section>
        ) : null}
      </Page>
    </>
  );
}
