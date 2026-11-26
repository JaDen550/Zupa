/* ZUPA seed script — creates data/db.json with products, users, coupons, orders */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const now = Date.now();
const daysAgo = (d, h = 10) => {
  const t = new Date(now - d * 86400000);
  t.setHours(h, Math.floor(Math.random() * 59), 0, 0);
  return t.toISOString();
};

function hash(pw, salt) {
  return crypto.scryptSync(pw, salt, 64).toString('hex');
}
function mkUser(u) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { ...u, salt, passwordHash: hash(u.password, salt), password: undefined, createdAt: daysAgo(Math.floor(Math.random() * 60) + 10) };
}

const products = [
  {
    id: 'sl-coffee', name: 'Premium Sierra Leone Coffee — 500g', category: 'Food & Agro',
    priceUSD: 12.5, stock: 40, active: true, featured: true, image: 'images/coffee.png',
    description: 'Single-origin Arabica beans grown in the highlands of Sierra Leone, hand-picked and slow-roasted in small batches. Rich chocolatey aroma with a bright, fruity finish. Whole bean, 500g resealable pack.',
    reviews: [
      { id: 'r1', userId: 'u-demo', userName: 'Aminata K.', rating: 5, comment: 'Best coffee I have had in Freetown. Will order again!', createdAt: daysAgo(3) },
      { id: 'r2', userId: 'u-joe', userName: 'Joseph S.', rating: 4, comment: 'Great aroma, freshness is spot on.', createdAt: daysAgo(6) }
    ],
    createdAt: daysAgo(90)
  },
  {
    id: 'nova-phone', name: 'Nova X15 Smartphone 256GB', category: 'Electronics',
    priceUSD: 329, stock: 15, active: true, featured: true, image: 'images/phone.png',
    description: '6.7" AMOLED 120Hz display, 50MP triple camera, 5000mAh battery with 65W fast charge, 8GB RAM + 256GB storage. Dual SIM with 4G+ support. 2-year warranty included.',
    reviews: [
      { id: 'r3', userId: 'u-joe', userName: 'Joseph S.', rating: 5, comment: 'Smooth, fast and the camera is incredible for the price.', createdAt: daysAgo(2) }
    ],
    createdAt: daysAgo(75)
  },
  {
    id: 'wax-outfit', name: 'African Wax Print Two-Piece Outfit', category: 'Fashion',
    priceUSD: 38, stock: 25, active: true, featured: true, image: 'images/wax-outfit.png',
    description: 'Tailored crop top and wide-leg trousers in vibrant emerald-and-gold wax print. Breathable 100% cotton, fully lined. Available in XS–XXL. Handmade by Freetown artisans.',
    reviews: [
      { id: 'r4', userId: 'u-demo', userName: 'Aminata K.', rating: 5, comment: 'The fit is perfect and the fabric quality is top class.', createdAt: daysAgo(4) }
    ],
    createdAt: daysAgo(60)
  },
  {
    id: 'palm-oil', name: 'Cold-Pressed Red Palm Oil — 1L', category: 'Food & Agro',
    priceUSD: 9.75, stock: 60, active: true, featured: false, image: 'images/palm-oil.png',
    description: 'Pure, unrefined red palm oil cold-pressed from fresh local fruit. Deep colour and authentic flavour for your stews and soups. 1 litre bottle, no additives.',
    reviews: [], createdAt: daysAgo(80)
  },
  {
    id: 'sneakers', name: 'TrailRun Aerolite Running Sneakers', category: 'Sports',
    priceUSD: 54.99, stock: 30, active: true, featured: true, image: 'images/sneakers.png',
    description: 'Feather-light trainers with responsive foam midsole, breathable mesh upper and high-grip outsole. Built for daily runs and all-day comfort. Sizes 38–46.',
    reviews: [
      { id: 'r5', userId: 'u-joe', userName: 'Joseph S.', rating: 4, comment: 'Very comfortable for morning jogs on the beach road.', createdAt: daysAgo(5) }
    ],
    createdAt: daysAgo(55)
  },
  {
    id: 'raffia-basket', name: 'Handwoven Raffia Market Basket', category: 'Home & Craft',
    priceUSD: 22, stock: 35, active: true, featured: false, image: 'images/basket.png',
    description: 'Beautifully handwoven raffia basket with leather handles — perfect for market runs, picnics or as a statement decor piece. Each basket is unique.',
    reviews: [], createdAt: daysAgo(50)
  },
  {
    id: 'earbuds', name: 'Aircell Pro Wireless Earbuds', category: 'Electronics',
    priceUSD: 45, stock: 50, active: true, featured: true, image: 'images/earbuds.png',
    description: 'Active noise cancellation, 32h total playtime with the case, Bluetooth 5.3, dual-mic calls and IPX5 water resistance. Touch controls with low-game-mode latency.',
    reviews: [
      { id: 'r6', userId: 'u-demo', userName: 'Aminata K.', rating: 5, comment: 'Noise cancelling works so well on the bus. Love them.', createdAt: daysAgo(1) }
    ],
    createdAt: daysAgo(45)
  },
  {
    id: 'shea-butter', name: 'Organic Shea Butter Body Cream — 250ml', category: 'Beauty',
    priceUSD: 14, stock: 45, active: true, featured: false, image: 'images/shea.png',
    description: 'Raw, unrefined shea butter whipped with coconut and jojoba oils. Deeply moisturising for dry skin and hair. Light natural fragrance. 250ml glass jar.',
    reviews: [], createdAt: daysAgo(40)
  },
  {
    id: 'solar-powerbank', name: 'SunPack 20,000mAh Solar Power Bank', category: 'Electronics',
    priceUSD: 28, stock: 40, active: true, featured: false, image: 'images/powerbank.png',
    description: 'Rugged solar power bank with 20,000mAh capacity, 3 USB outputs, built-in flashlight and carabiner. Charges by solar or USB-C. Perfect for travel and load-shedding days.',
    reviews: [], createdAt: daysAgo(35)
  },
  {
    id: 'woven-scarf', name: 'Handwoven Indigo Scarf', category: 'Fashion',
    priceUSD: 18, stock: 30, active: true, featured: false, image: 'images/scarf.png',
    description: 'Soft handwoven cotton scarf in deep indigo with hand-knotted fringe. Generous 180cm length — wear it as a head wrap, neck scarf or shawl.',
    reviews: [], createdAt: daysAgo(30)
  },
  {
    id: 'dried-mango', name: 'Sweet Dried Mango Pack — 500g', category: 'Food & Agro',
    priceUSD: 7.5, stock: 80, active: true, featured: false, image: 'images/mango.png',
    description: 'Naturally sweet dried mango slices with no added sugar or preservatives. Chewy, tropical and addictive — the perfect snack. 500g resealable pouch.',
    reviews: [
      { id: 'r7', userId: 'u-joe', userName: 'Joseph S.', rating: 5, comment: 'My kids finish a pack in two days. Amazing quality.', createdAt: daysAgo(2) }
    ],
    createdAt: daysAgo(25)
  },
  {
    id: 'desk-lamp', name: 'GlowMax LED Desk Lamp', category: 'Home & Craft',
    priceUSD: 19, stock: 25, active: true, featured: false, image: 'images/lamp.png',
    description: 'Minimalist LED desk lamp with 3 colour modes, 5 brightness levels, touch dimmer and a flexible arm. USB powered — great for students and home offices.',
    reviews: [], createdAt: daysAgo(20)
  }
];

const users = [
  mkUser({ id: 'u-admin', name: 'Store Admin', email: 'admin@zupa.sl', password: 'admin123', role: 'admin', phone: '+232 76 000 000', city: 'Freetown' }),
  mkUser({ id: 'u-demo', name: 'Aminata Kamara', email: 'demo@zupa.sl', password: 'demo123', role: 'customer', phone: '+232 77 123 456', city: 'Freetown' }),
  mkUser({ id: 'u-joe', name: 'Joseph Sesay', email: 'joe@zupa.sl', password: 'demo123', role: 'customer', phone: '+232 78 987 654', city: 'Bo' })
];

const P = (id) => products.find(p => p.id === id);
function order(o) {
  const items = o.items.map(([pid, qty]) => {
    const p = P(pid);
    return { productId: pid, name: p.name, priceUSD: p.priceUSD, qty, image: p.image };
  });
  const subtotalUSD = +items.reduce((s, i) => s + i.priceUSD * i.qty, 0).toFixed(2);
  const shippingUSD = subtotalUSD >= 75 ? 0 : 7.5;
  const totalUSD = +(subtotalUSD + shippingUSD).toFixed(2);
  return {
    id: o.id, userId: o.userId, items, subtotalUSD, discountUSD: 0, shippingUSD, totalUSD,
    currency: o.currency || 'USD', exchangeRate: 23.5,
    address: o.address, paymentMethod: o.method, paymentStatus: o.paid ? 'paid' : 'unpaid',
    status: o.status, coupon: null, notes: o.notes || '',
    createdAt: o.createdAt, updatedAt: o.createdAt
  };
}
function payment(p) {
  return { id: p.id, orderId: p.orderId, amountUSD: p.amountUSD, currency: p.currency || 'USD', method: p.method, side: p.side, status: p.status, reference: p.reference || '', note: p.note || '', createdAt: p.createdAt, updatedAt: p.createdAt };
}

const addr1 = { fullName: 'Aminata Kamara', phone: '+232 77 123 456', line1: '12 Wilberforce Street', city: 'Freetown', region: 'Western Area', notes: 'Call when close' };
const addr2 = { fullName: 'Joseph Sesay', phone: '+232 78 987 654', line1: '45 Sierra Leone Road', city: 'Bo', region: 'Bo District', notes: '' };

const orders = [
  order({ id: 'ZP-8Q2K1', userId: 'u-demo', items: [['sl-coffee', 2], ['dried-mango', 1]], method: 'card', paid: true, status: 'delivered', address: addr1, createdAt: daysAgo(6, 9) }),
  order({ id: 'ZP-7J9P4', userId: 'u-joe', items: [['shea-butter', 1], ['woven-scarf', 2]], method: 'cod', paid: true, status: 'delivered', address: addr2, createdAt: daysAgo(5, 14) }),
  order({ id: 'ZP-6H5R8', userId: 'u-demo', items: [['sneakers', 1]], method: 'momo', paid: true, status: 'processing', address: addr1, createdAt: daysAgo(4, 11) }),
  order({ id: 'ZP-5T3W7', userId: 'u-joe', items: [['earbuds', 1], ['raffia-basket', 1]], method: 'card', paid: true, status: 'shipped', address: addr2, createdAt: daysAgo(2, 16) }),
  order({ id: 'ZP-4Y6B2', userId: 'u-demo', items: [['nova-phone', 1]], method: 'bank', paid: false, status: 'awaiting_payment', address: addr1, createdAt: daysAgo(1, 10) })
];

const payments = [
  payment({ id: 'PAY-3001', orderId: 'ZP-8Q2K1', amountUSD: 32.5, method: 'card', side: 'client', status: 'completed', reference: 'ch_9f2a1c', note: 'Visa •••• 4242', createdAt: daysAgo(6, 9) }),
  payment({ id: 'PAY-3002', orderId: 'ZP-7J9P4', amountUSD: 47.0, method: 'cod', side: 'admin', status: 'completed', reference: 'COD-7J9P4', note: 'Cash collected on delivery', createdAt: daysAgo(5, 15) }),
  payment({ id: 'PAY-3003', orderId: 'ZP-6H5R8', amountUSD: 62.49, method: 'momo', side: 'client', status: 'completed', reference: 'OM-8821345', note: 'Orange Money •••• 77 123', createdAt: daysAgo(4, 11) }),
  payment({ id: 'PAY-3004', orderId: 'ZP-5T3W7', amountUSD: 74.5, method: 'card', side: 'client', status: 'completed', reference: 'ch_4b7e2d', note: 'Mastercard •••• 5100', createdAt: daysAgo(2, 16) }),
  payment({ id: 'PAY-3005', orderId: 'ZP-4Y6B2', amountUSD: 336.5, method: 'bank', side: 'client', status: 'submitted', reference: 'SL26 9001 4455 8890', note: 'Client says they transferred on 22 Nov', createdAt: daysAgo(1, 10) })
];

const db = {
  settings: {
    storeName: 'ZUPA',
    tagline: 'Your everyday shopping destination.',
    exchangeRate: 23.5,
    shippingFeeUSD: 7.5,
    freeShippingOverUSD: 75,
    categories: ['Electronics', 'Fashion', 'Food & Agro', 'Home & Craft', 'Beauty', 'Sports', 'TBT (The Bold Tribe)']
  },
  users,
  products,
  orders,
  payments,
  coupons: [
    { code: 'FREETOWN10', percent: 10, active: true, createdAt: daysAgo(20) },
    { code: 'ZUPA5', percent: 5, active: true, createdAt: daysAgo(20) }
  ],
  tokens: {},
  audit: []
};

fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
console.log('Seeded', DB_FILE, '—', products.length, 'products,', users.length, 'users,', orders.length, 'orders,', payments.length, 'payments');
