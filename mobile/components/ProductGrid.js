import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import ProductCard from './ProductCard';

/** Responsive 2-column (3 on tablets) product grid. */
export default function ProductGrid({ products }) {
  const { width } = useWindowDimensions();
  const cols = width >= 700 ? 3 : 2;
  const gap = 12, pad = 16;
  const w = Math.floor((width - pad * 2 - gap * (cols - 1)) / cols);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, paddingHorizontal: pad }}>
      {products.map((p) => <ProductCard key={p.id} p={p} width={w} />)}
    </View>
  );
}
