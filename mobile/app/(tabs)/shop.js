import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { C, R } from '../../lib/theme';
import { Chip, Empty, ErrorBox, Loading, Page } from '../../components/ui';
import ProductGrid from '../../components/ProductGrid';

const SORTS = [
  { v: 'featured', l: 'Featured' }, { v: 'newest', l: 'Newest' },
  { v: 'price-asc', l: 'Price ↑' }, { v: 'price-desc', l: 'Price ↓' }, { v: 'rating', l: 'Top rated' }
];

export default function Shop() {
  const params = useLocalSearchParams();
  const { settings } = useApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('featured');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // jump to a category when arriving from the home screen
  useEffect(() => { if (params.category !== undefined) setCategory(String(params.category || '')); }, [params.category]);

  const load = async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    try {
      const qs = new URLSearchParams({ search: search.trim(), category, sort }).toString();
      setList(await api('/api/products?' + qs, { auth: false })); setError('');
    } catch (e) { setError(e.message); } finally { setRefreshing(false); }
  };

  // debounce typing
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, sort]);

  return (
    <Page onRefresh={() => load(true)} refreshing={refreshing} stickyHeaderIndices={[0]}>
      <View style={{ backgroundColor: C.bg, paddingBottom: 8 }}>
        <View style={{ margin: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: R.m, borderWidth: 1.5, borderColor: C.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput
            value={search} onChangeText={setSearch} placeholder="Search products…" placeholderTextColor="#a8a29b"
            returnKeyType="search" style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 15.5, color: C.ink }}
          />
          {search ? <Ionicons name="close-circle" size={18} color={C.muted} onPress={() => setSearch('')} /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          <Chip label="All" active={!category} onPress={() => setCategory('')} />
          {settings.categories.map((c) => <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, marginTop: 8 }}>
          {SORTS.map((s) => <Chip key={s.v} label={s.l} active={sort === s.v} onPress={() => setSort(s.v)} />)}
        </ScrollView>
      </View>

      {error ? <ErrorBox message={error} onRetry={() => load()} />
        : !list ? <Loading />
        : !list.length ? <Empty icon="search-outline" title="No products found" text="Try a different search or category." />
        : (
          <>
            <Text style={{ paddingHorizontal: 16, color: C.muted, marginBottom: 10 }}>{list.length} product{list.length === 1 ? '' : 's'}</Text>
            <ProductGrid products={list} />
          </>
        )}
    </Page>
  );
}
