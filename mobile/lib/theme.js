// Brand tokens, mirrored from the web app's styles.css
export const C = {
  // ZUPA brand: orange + golden yellow + charcoal on warm white
  brand: '#ea580c', brandD: '#c2410c', brandL: '#fff1e6', brandXL: '#fff8f2',
  gold: '#fbbf24', goldL: '#fff6db',
  // success states keep a true green so "paid / delivered / in stock" never reads as a brand colour
  ok: '#15803d', okD: '#166534', okL: '#e7f6ec',
  ink: '#1f2124', ink2: '#44484f', muted: '#6f737a',
  bg: '#faf8f5', card: '#ffffff', line: '#ece7e1',
  red: '#d64545', redL: '#fdecec', blue: '#2563eb', blueL: '#eaf1ff',
  amber: '#b7791f', amberL: '#fff4d9', purple: '#7c3aed', purpleL: '#f3ecff'
};
export const R = { s: 9, m: 14, l: 20 };
export const shadow = {
  shadowColor: '#1f2124', shadowOpacity: 0.08, shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 }, elevation: 2
};

export const STATUS = {
  awaiting_payment: { label: 'Awaiting payment', fg: C.amber, bg: C.amberL },
  paid: { label: 'Paid', fg: C.blue, bg: C.blueL },
  processing: { label: 'Processing', fg: C.purple, bg: C.purpleL },
  shipped: { label: 'Shipped', fg: C.blue, bg: C.blueL },
  delivered: { label: 'Delivered', fg: C.ok, bg: C.okL },
  cancelled: { label: 'Cancelled', fg: C.red, bg: C.redL },
  // payment statuses
  pending: { label: 'Pending', fg: C.amber, bg: C.amberL },
  submitted: { label: 'Submitted', fg: C.blue, bg: C.blueL },
  completed: { label: 'Completed', fg: C.ok, bg: C.okL },
  failed: { label: 'Failed', fg: C.red, bg: C.redL },
  unpaid: { label: 'Unpaid', fg: C.amber, bg: C.amberL }
};
export const ORDER_FLOW = ['awaiting_payment', 'paid', 'processing', 'shipped', 'delivered'];
export const NEXT_STATUS = { paid: 'processing', processing: 'shipped', shipped: 'delivered' };
export const METHOD = {
  card: { label: 'Card payment', icon: 'card-outline' },
  momo: { label: 'Mobile Money', icon: 'phone-portrait-outline' },
  bank: { label: 'Bank transfer', icon: 'business-outline' },
  cod: { label: 'Cash on delivery', icon: 'cash-outline' },
  manual: { label: 'Manual entry', icon: 'create-outline' }
};
