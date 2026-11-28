/* ZUPA server — REST API + static frontend */
// With DATABASE_URL set (Neon), start.js pulls the data first and then loads this file again.
if (require('./storage').enabled() && !global.__zupaReady) { require('./start'); return; }
const storage = global.__zupaStorage || null;
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// CORS so the mobile app (and Expo web preview) can call the API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/admin/upload', express.json({ limit: '8mb' }));
app.use('/api/admin/products/bulk', express.json({ limit: '3mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { etag: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

/* ---------------- DB ---------------- */
let db;
try {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch (e) {
  console.error('data/db.json missing — run: node seed.js');
  process.exit(1);
}
function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  if (storage) storage.push(db); // also saved to Neon
}
if (storage) {
  // lets storage.js merge in changes that another copy of the server made in Neon (never overwrite them)
  storage.bind(() => db, (fresh) => {
    for (const k of Object.keys(db)) delete db[k];
    Object.assign(db, fresh);
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  });
  app.use('/api', (req, res, next) => { storage.refresh().then(() => next(), () => next()); });
}
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const uid = (p) => p + '-' + crypto.randomBytes(5).toString('hex').toUpperCase();

/* One-time data upgrades for databases created by older versions */
const TBT = 'TBT (The Bold Tribe)';
if (!db.settings.categories.includes(TBT)) { db.settings.categories.push(TBT); save(); }

// Delivery tracking: each event = where the package is, plus date & time
const STATUS_TRACK = {
  awaiting_payment: ['Order placed', 'ZUPA store, Freetown'],
  paid: ['Payment received', 'ZUPA store, Freetown'],
  processing: ['Order is being packed', 'ZUPA warehouse, Freetown'],
  shipped: ['Package handed to delivery rider', 'ZUPA dispatch, Freetown'],
  delivered: ['Package delivered', null],
  cancelled: ['Order cancelled', null]
};
function addTrack(o, status, location, note, atIso) {
  if (!Array.isArray(o.tracking)) o.tracking = [];
  o.tracking.push({ id: uid('TRK'), status, location: location || '', note: note || '', at: atIso || new Date().toISOString() });
}
function trackForStatus(o, status) {
  const [note, loc] = STATUS_TRACK[status] || ['Status updated', ''];
  addTrack(o, status, status === 'delivered' ? (o.address && (o.address.line1 + ', ' + o.address.city)) : loc, note);
}
// Estimated delivery windows (hours from now). Chosen by the admin when marking an order as shipped.
const ETA_PRESETS = {
  '2h': [1, 2, 'Within 2 hours'], '4h': [2, 4, 'Within 4 hours'], '1d': [12, 24, 'Within 1 day'],
  '1-2d': [24, 48, '1–2 days'], '2-3d': [48, 72, '2–3 days'], '3-5d': [72, 120, '3–5 days']
};
function setEta(o, spec, who) {
  const now = Date.now();
  let from, to;
  if (spec && spec.from && spec.to && !isNaN(Date.parse(spec.from)) && !isNaN(Date.parse(spec.to))) {
    from = Date.parse(spec.from); to = Date.parse(spec.to);
    if (to < from) [from, to] = [to, from];
  } else {
    const key = ETA_PRESETS[spec && spec.preset] ? spec.preset : (/freetown/i.test((o.address && o.address.city) || '') ? '1d' : '2-3d');
    from = now + ETA_PRESETS[key][0] * 3600000; to = now + ETA_PRESETS[key][1] * 3600000;
  }
  o.eta = { from: new Date(from).toISOString(), to: new Date(to).toISOString(), setAt: new Date(now).toISOString(), setBy: who || '' };
}
let _migrated = false;
for (const o of db.orders) {
  if (!Array.isArray(o.tracking)) {
    o.tracking = [];
    addTrack(o, 'awaiting_payment', STATUS_TRACK.awaiting_payment[1], STATUS_TRACK.awaiting_payment[0], o.createdAt);
    if (o.status !== 'awaiting_payment') trackForStatus(o, o.status);
    _migrated = true;
  }
}
if (_migrated) save();

// Multi-admin: every admin has their own account; the first one is the owner.
if (!Array.isArray(db.audit)) db.audit = [];
const _admins = db.users.filter((u) => u.role === 'admin');
if (_admins.length && !_admins.some((u) => u.adminRole === 'owner')) { _admins[0].adminRole = 'owner'; }
_admins.forEach((u) => { if (!u.adminRole) u.adminRole = 'admin'; if (u.active == null) u.active = true; });
// Products created before multi-admin are attributed to the owner so every product has an admin ID.
const _owner = _admins.find((u) => u.adminRole === 'owner');
if (_owner) db.products.forEach((p) => { if (!p.createdById) { p.createdById = _owner.id; p.createdByName = _owner.name; p.legacyOwner = true; } });
save();

// NLe is the source of truth for prices, shipping fee and free-delivery threshold; USD is derived from today's rate.
const _r0 = db.settings.exchangeRate;
db.products.forEach((p) => { if (p.priceSLE == null) p.priceSLE = round2(p.priceUSD * _r0); });
if (db.settings.shippingFeeSLE == null) db.settings.shippingFeeSLE = round2(db.settings.shippingFeeUSD * _r0);
if (db.settings.freeShippingOverSLE == null) db.settings.freeShippingOverSLE = round2(db.settings.freeShippingOverUSD * _r0);
if (!Array.isArray(db.settings.rateHistory)) db.settings.rateHistory = [{ at: new Date().toISOString(), rate: _r0, by: 'system' }];
db.orders.forEach((o) => { if (!o.exchangeRate) o.exchangeRate = _r0; });
db.payments.forEach((x) => { if (!x.exchangeRate) { const o = db.orders.find((q) => q.id === x.orderId); x.exchangeRate = (o && o.exchangeRate) || _r0; } });
function applyRate() {
  const r = db.settings.exchangeRate;
  db.products.forEach((p) => { p.priceUSD = Math.round((p.priceSLE / r) * 10000) / 10000; });
  db.settings.shippingFeeUSD = Math.round((db.settings.shippingFeeSLE / r) * 10000) / 10000;
  db.settings.freeShippingOverUSD = Math.round((db.settings.freeShippingOverSLE / r) * 10000) / 10000;
}
applyRate();
// Where customers send money. Filled in by the store owner under Admin -> Settings (never kept in the code).
if (!db.settings.paymentDetails || typeof db.settings.paymentDetails !== 'object') {
  db.settings.paymentDetails = { bank: { bankName: '', accountName: '', accountNumber: '', branch: '' }, momo: [] };
}
if (!Array.isArray(db.settings.paymentDetails.momo)) db.settings.paymentDetails.momo = [];
if (!db.settings.paymentDetails.bank) db.settings.paymentDetails.bank = { bankName: '', accountName: '', accountNumber: '', branch: '' };
// Sizes: wearable products (shirts, jerseys, gloves, shoes...) get a size picker in the store.
const SHOE_RE = /\b(sneakers?|shoes?|boots?|sandals?|slippers?|loafers?|heels?|trainers?)\b/i;
const WEAR_RE = /\b(t-?shirts?|shirts?|tees?|jerseys?|hoodies?|sweaters?|jackets?|trousers?|pants?|jeans?|shorts?|dress(es)?|skirts?|outfits?|gowns?|suits?|vests?|coats?|kaftans?|dashikis?|wax print|gloves?|socks?|leggings?|tracksuits?|sleeves?|wear|uniforms?|apparel|clothing|clothes)\b/i;
function suggestSizes(p) {
  const t = String((p && p.name) || '');
  if (SHOE_RE.test(t)) return ['38', '39', '40', '41', '42', '43', '44', '45'];
  if (WEAR_RE.test(t)) return ['S', 'M', 'L', 'XL', 'XXL'];
  return [];
}
function cleanSizes(v) {
  const parts = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,\/|;\n]+/);
  const out = [];
  for (const x of parts) {
    const t = String(x).trim().toUpperCase();
    if (/^[A-Z0-9.\-]{1,8}$/.test(t) && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 14);
}
db.products.forEach((p) => { if (!Array.isArray(p.sizes)) p.sizes = suggestSizes(p); });
save();
const MOMO_PROVIDERS = ['Orange Money', 'Africell Money', 'QMoney'];
const bankReady = () => { const b = db.settings.paymentDetails.bank; return !!(b.bankName && b.accountName && b.accountNumber); };
const momoReady = () => db.settings.paymentDetails.momo.filter((m) => m.number && m.accountName);
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
function parsePaymentDetails(x) {
  if (!x || typeof x !== 'object') return { error: 'Invalid payment details.' };
  const b = x.bank || {};
  const bank = { bankName: clean(b.bankName, 60), accountName: clean(b.accountName, 80), accountNumber: clean(b.accountNumber, 40), branch: clean(b.branch, 60) };
  const some = bank.bankName || bank.accountName || bank.accountNumber;
  if (some && !(bank.bankName && bank.accountName && bank.accountNumber)) return { error: 'For bank transfers fill in the bank name, account name and account number, or leave all three empty.' };
  if (bank.accountNumber && !/^[A-Za-z0-9][A-Za-z0-9 \-\/]{3,39}$/.test(String(b.accountNumber).trim())) return { error: 'The bank account number may only contain letters, numbers, spaces and dashes.' };
  const momo = [];
  for (const m of Array.isArray(x.momo) ? x.momo : []) {
    const provider = MOMO_PROVIDERS.find((p) => p === m.provider);
    const number = clean(m.number, 20), accountName = clean(m.accountName, 80);
    if (!provider || (!number && !accountName)) continue;
    if (!/^\+?[0-9 ]{8,15}$/.test(number)) return { error: `Enter a valid ${provider} number (digits only, for example +232 76 123456).` };
    if (!accountName) return { error: `Enter the name the ${provider} number is registered under.` };
    if (momo.some((q) => q.provider === provider)) continue;
    momo.push({ provider, number, accountName });
  }
  return { value: { bank, momo } };
}
const mask = (v) => (v && v.length > 4 ? '****' + v.slice(-4) : '****');

function pub(p) {
  const { createdById, createdByName, updatedById, updatedByName, legacyOwner, ...rest } = p;
  return rest;
}
function logAudit(req, action, target) {
  db.audit.push({ at: new Date().toISOString(), adminId: req.user.id, adminName: req.user.name, action, target: String(target || '') });
  if (db.audit.length > 500) db.audit.splice(0, db.audit.length - 500);
}

/* ---------------- Auth ---------------- */
function hashPw(pw, salt) {
  return crypto.scryptSync(pw, salt, 64).toString('hex');
}
const sha = (x) => crypto.createHash('sha256').update(String(x)).digest('hex');
const TOKEN_DAYS = 30;
// Only a hash of each token is stored, so a copy of db.json cannot be used to sign in as someone.
function tokenFor(userId, meta = {}) {
  const t = crypto.randomBytes(32).toString('hex');
  db.tokens[sha(t)] = { userId, createdAt: new Date().toISOString(), exp: Date.now() + TOKEN_DAYS * 86400000, ua: String(meta.ua || '').slice(0, 120) };
  return t;
}
function revokeUserTokens(userId, exceptHash) {
  for (const k of Object.keys(db.tokens)) if (db.tokens[k].userId === userId && k !== exceptHash) delete db.tokens[k];
}
function bearer(req) { return (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim(); }
function currentUser(req) {
  const t = bearer(req);
  if (!t) return null;
  const rec = db.tokens[sha(t)];
  if (!rec) return null;
  if (rec.exp < Date.now()) { delete db.tokens[sha(t)]; return null; }
  const u = db.users.find((x) => x.id === rec.userId);
  return u && u.active !== false && !u.deletedAt ? u : null;
}
// Old plain-text tokens (pre-hardening) are dropped: everyone signs in once more.
for (const k of Object.keys(db.tokens)) if (typeof db.tokens[k] !== 'object') delete db.tokens[k];

// Tiny in-memory rate limiter (per IP) for sign-in, sign-up and reset attempts
const _hits = new Map();
function limited(req, name, max, windowMs) {
  const key = name + ':' + (req.ip || req.socket.remoteAddress || 'x');
  const now = Date.now();
  const h = _hits.get(key);
  if (!h || h.reset < now) { _hits.set(key, { n: 1, reset: now + windowMs }); return false; }
  return ++h.n > max;
}
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const normEmail = (e) => String(e || '').trim().toLowerCase();
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function pwProblem(pw, isAdminAcct) {
  pw = String(pw || '');
  if (pw.length < (isAdminAcct ? 8 : 8)) return 'Password must be at least 8 characters.';
  if (pw.length > 100) return 'Password is too long.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use at least one letter and one number in your password.';
  return null;
}
function publicUser(u) {
  if (!u) return null;
  const { passwordHash, salt, reset, failedLogins, lockedUntil, ...rest } = u;
  return rest;
}
function auth(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Please sign in to continue.' });
  req.user = u;
  next();
}
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

app.get('/api/health', (req, res) => res.json({ ok: true, store: db.settings.storeName }));

/* ---------------- Settings / Products (public) ---------------- */
const publicSettings = () => { const { rateHistory, ...rest } = db.settings; return { ...rest, rateUpdatedAt: rateHistory.length ? rateHistory[rateHistory.length - 1].at : null }; };
app.get('/api/settings', (req, res) => res.json(publicSettings()));

app.get('/api/products', (req, res) => {
  const { search = '', category = '', sort = 'featured', max = '', featured = '' } = req.query;
  let list = db.products.filter((p) => p.active);
  if (featured === '1') list = list.filter((p) => p.featured);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((p) => (p.name + ' ' + p.description + ' ' + p.category).toLowerCase().includes(q));
  }
  if (category) list = list.filter((p) => p.category === category);
  if (max) list = list.filter((p) => p.priceUSD <= parseFloat(max));
  const withMeta = list.map((p) => ({
    ...pub(p),
    rating: p.reviews.length ? round2(p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length) : 0,
    reviewCount: p.reviews.length
  }));
  if (sort === 'price-asc') withMeta.sort((a, b) => a.priceUSD - b.priceUSD);
  else if (sort === 'price-desc') withMeta.sort((a, b) => b.priceUSD - a.priceUSD);
  else if (sort === 'newest') withMeta.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else if (sort === 'rating') withMeta.sort((a, b) => b.rating - a.rating);
  else withMeta.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.rating - a.rating);
  res.json(withMeta);
});

app.get('/api/products/:id', (req, res) => {
  const p = db.products.find((x) => x.id === req.params.id && x.active);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  const rating = p.reviews.length ? round2(p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length) : 0;
  const related = db.products
    .filter((x) => x.active && x.category === p.category && x.id !== p.id)
    .slice(0, 4)
    .map((x) => ({ id: x.id, name: x.name, priceUSD: x.priceUSD, image: x.image, category: x.category }));
  res.json({ ...pub(p), rating, reviewCount: p.reviews.length, related });
});

/* ---------------- Auth routes ---------------- */
app.post('/api/auth/register', (req, res) => {
  if (limited(req, 'register', 10, 60 * 60000)) return res.status(429).json({ error: 'Too many sign-up attempts. Please try again later.' });
  const { name, password, phone } = req.body || {};
  const email = normEmail(req.body && req.body.email);
  if (!String(name || '').trim() || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const pw = pwProblem(password); if (pw) return res.status(400).json({ error: pw });
  if (phone && !/^\+?[0-9 ]{8,15}$/.test(String(phone).trim())) return res.status(400).json({ error: 'Please enter a valid phone number.' });
  if (db.users.find((u) => u.email.toLowerCase() === email)) return res.status(400).json({ error: 'An account with that email already exists. Try signing in.' });
  const salt = crypto.randomBytes(16).toString('hex');
  const user = {
    id: uid('u'), name: String(name).trim().slice(0, 80), email,
    phone: String(phone || '').trim(), city: '', role: 'customer', salt, passwordHash: hashPw(String(password), salt),
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  const token = tokenFor(user.id, { ua: req.headers['user-agent'] });
  save();
  res.json({ user: publicUser(user), token });
});

const MAX_FAILS = 5, LOCK_MIN = 15;
app.post('/api/auth/login', (req, res) => {
  if (limited(req, 'login', 30, 15 * 60000)) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
  const email = normEmail(req.body && req.body.email);
  const password = String((req.body && req.body.password) || '');
  const user = db.users.find((u) => u.email.toLowerCase() === email && !u.deletedAt);
  if (user && user.lockedUntil && user.lockedUntil > Date.now()) {
    const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({ error: `Too many wrong passwords. This account is locked for ${mins} more minute${mins === 1 ? '' : 's'}. You can also reset your password.` });
  }
  // always hash, so response time does not reveal whether the email exists
  const ok = user ? safeEq(hashPw(password, user.salt), user.passwordHash) : (hashPw(password, 'x'.repeat(32)), false);
  if (!user || !ok) {
    if (user) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      if (user.failedLogins >= MAX_FAILS) { user.lockedUntil = Date.now() + LOCK_MIN * 60000; user.failedLogins = 0; }
      save();
    }
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  if (user.active === false) return res.status(403).json({ error: 'This account has been deactivated. Contact the store owner.' });
  user.failedLogins = 0; user.lockedUntil = null; user.lastLoginAt = new Date().toISOString();
  const token = tokenFor(user.id, { ua: req.headers['user-agent'] });
  save();
  res.json({ user: publicUser(user), token });
});

app.post('/api/auth/change-password', auth, (req, res) => {
  const { current, next } = req.body || {};
  if (!safeEq(hashPw(String(current || ''), req.user.salt), req.user.passwordHash)) return res.status(400).json({ error: 'Your current password is incorrect.' });
  const pw = pwProblem(next, req.user.role === 'admin'); if (pw) return res.status(400).json({ error: pw });
  req.user.salt = crypto.randomBytes(16).toString('hex');
  req.user.passwordHash = hashPw(String(next), req.user.salt);
  revokeUserTokens(req.user.id, sha(bearer(req))); // other devices are signed out, this one stays
  save();
  res.json({ ok: true });
});

/* Forgot password. With an email provider set up (see mailer.js) the 6-digit code is emailed.
   Without one, the code is printed in the server console instead (local testing only). */
const mailer = require('./mailer');
app.post('/api/auth/forgot', (req, res) => {
  if (limited(req, 'forgot', 5, 60 * 60000)) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  const email = normEmail(req.body && req.body.email);
  const user = db.users.find((u) => u.email.toLowerCase() === email && !u.deletedAt && u.active !== false);
  if (user) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    user.reset = { hash: sha(code + ':' + user.id), exp: Date.now() + 15 * 60000, tries: 0 };
    save();
    if (mailer.configured()) {
      // not awaited: the answer is the same, and equally fast, whether or not the account exists
      mailer.sendMail({ to: user.email, ...mailer.resetEmail(user.name, code) })
        .catch((e) => console.error('[ZUPA] Could not send the reset email:', e.message));
    } else {
      console.log(`\n[ZUPA] Password reset code for ${user.email}: ${code}  (valid 15 minutes)\n`);
    }
  }
  // same answer whether or not the account exists
  res.json({ ok: true, message: 'If that email has an account, a 6-digit reset code has been sent.' });
});
app.post('/api/auth/reset', (req, res) => {
  if (limited(req, 'reset', 20, 60 * 60000)) return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  const email = normEmail(req.body && req.body.email);
  const { code, password } = req.body || {};
  const bad = { error: 'That code is incorrect or has expired. Request a new one.' };
  const user = db.users.find((u) => u.email.toLowerCase() === email && !u.deletedAt);
  if (!user || !user.reset || user.reset.exp < Date.now()) return res.status(400).json(bad);
  const pw = pwProblem(password, user.role === 'admin'); if (pw) return res.status(400).json({ error: pw });
  if (user.reset.tries >= 5) { user.reset = null; save(); return res.status(400).json(bad); }
  if (!safeEq(sha(String(code || '').trim() + ':' + user.id), user.reset.hash)) { user.reset.tries++; save(); return res.status(400).json(bad); }
  user.salt = crypto.randomBytes(16).toString('hex');
  user.passwordHash = hashPw(String(password), user.salt);
  user.reset = null; user.failedLogins = 0; user.lockedUntil = null;
  revokeUserTokens(user.id);
  save();
  res.json({ ok: true });
});

app.put('/api/auth/profile', auth, (req, res) => {
  const { name, phone, city } = req.body || {};
  if (name != null) { if (!String(name).trim()) return res.status(400).json({ error: 'Name cannot be empty.' }); req.user.name = String(name).trim().slice(0, 80); }
  if (phone != null) {
    if (phone && !/^\+?[0-9 ]{8,15}$/.test(String(phone).trim())) return res.status(400).json({ error: 'Please enter a valid phone number.' });
    req.user.phone = String(phone).trim();
  }
  if (city != null) req.user.city = String(city).trim().slice(0, 60);
  save();
  res.json({ user: publicUser(req.user) });
});

app.get('/api/auth/sessions', auth, (req, res) => {
  const mine = sha(bearer(req));
  res.json(Object.entries(db.tokens).filter(([, r]) => r.userId === req.user.id).map(([k, r]) => ({ createdAt: r.createdAt, device: r.ua || 'Unknown device', current: k === mine })));
});
app.post('/api/auth/logout-all', auth, (req, res) => {
  revokeUserTokens(req.user.id, sha(bearer(req)));
  save();
  res.json({ ok: true });
});

// Account deletion (required by Apple/Google). Orders are kept for the store's records but de-identified.
app.delete('/api/auth/account', auth, (req, res) => {
  if (req.user.role === 'admin') return res.status(400).json({ error: 'Admin accounts are removed by the store owner (Admins tab).' });
  if (!safeEq(hashPw(String((req.body || {}).password || ''), req.user.salt), req.user.passwordHash)) return res.status(400).json({ error: 'Incorrect password.' });
  const u = req.user;
  revokeUserTokens(u.id);
  u.name = 'Deleted customer'; u.email = `deleted-${u.id}@deleted.invalid`; u.phone = ''; u.city = '';
  u.passwordHash = ''; u.salt = ''; u.deletedAt = new Date().toISOString(); u.reset = null;
  save();
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  delete db.tokens[sha(bearer(req))];
  save();
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user: publicUser(u) });
});

/* ---------------- Reviews ---------------- */
app.post('/api/products/:id/reviews', auth, (req, res) => {
  if (req.user.role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot place orders or write reviews. Sign in with a customer account to shop.' });
  const p = db.products.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  const { rating, comment } = req.body || {};
  const r = parseInt(rating, 10);
  if (!(r >= 1 && r <= 5)) return res.status(400).json({ error: 'Please choose a rating from 1 to 5.' });
  const existing = p.reviews.find((x) => x.userId === req.user.id);
  if (existing) return res.status(400).json({ error: 'You have already reviewed this product.' });
  const nameParts = String(req.user.name).trim().split(/\s+/);
  const userName = nameParts.length > 1 ? nameParts[0] + ' ' + nameParts[1][0] + '.' : nameParts[0];
  p.reviews.unshift({
    id: uid('r'), userId: req.user.id, userName,
    rating: r, comment: String(comment || '').slice(0, 500), createdAt: new Date().toISOString()
  });
  save();
  res.json({ ok: true, reviewCount: p.reviews.length });
});

/* ---------------- Orders ---------------- */
function orderByIdFor(req, id) {
  const o = db.orders.find((x) => x.id === id);
  if (!o) return null;
  if (req.user.role !== 'admin' && o.userId !== req.user.id) return null;
  return o;
}

app.get('/api/orders', auth, (req, res) => {
  const mine = db.orders.filter((o) => o.userId === req.user.id);
  mine.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(mine.map((o) => ({ ...o, payments: db.payments.filter((p) => p.orderId === o.id) })));
});

app.get('/api/orders/:id', auth, (req, res) => {
  const o = orderByIdFor(req, req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  res.json({ ...o, payments: db.payments.filter((p) => p.orderId === o.id) });
});

app.post('/api/orders', auth, (req, res) => {
  if (req.user.role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot place orders or write reviews. Sign in with a customer account to shop.' });
  const { items, address, paymentMethod, coupon, notes } = req.body || {};
  const method = ['momo', 'bank', 'cod'].includes(paymentMethod) ? paymentMethod : null;
  if (!method) return res.status(400).json({ error: 'Please choose a payment method.' });
  if (method === 'bank' && !bankReady()) return res.status(400).json({ error: 'Bank transfer is not available right now. Please choose another payment method.' });
  if (method === 'momo' && !momoReady().length) return res.status(400).json({ error: 'Mobile money is not available right now. Please choose another payment method.' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Your cart is empty.' });
  if (!address || !address.fullName || !address.phone || !address.line1 || !address.city) {
    return res.status(400).json({ error: 'Please fill in your delivery details (name, phone, address, city).' });
  }

  const lineItems = [];
  const wanted = {};
  for (const it of items) {
    const p = db.products.find((x) => x.id === it.productId && x.active);
    const qty = parseInt(it.qty, 10);
    if (!p || !(qty >= 1)) return res.status(400).json({ error: 'Invalid item in cart.' });
    wanted[p.id] = (wanted[p.id] || 0) + qty;
    if (p.stock < wanted[p.id]) return res.status(400).json({ error: `Only ${p.stock} left of “${p.name}”.` });
    const line = { productId: p.id, name: p.name, priceUSD: p.priceUSD, qty, image: p.image };
    if (Array.isArray(p.sizes) && p.sizes.length) {
      const size = String(it.size == null ? '' : it.size).trim().toUpperCase();
      if (!p.sizes.includes(size)) return res.status(400).json({ error: `Please choose a size for “${p.name}”.` });
      line.size = size;
    }
    lineItems.push(line);
  }

  let subtotalUSD = round2(lineItems.reduce((s, i) => s + i.priceUSD * i.qty, 0));
  let discountUSD = 0;
  let couponObj = null;
  if (coupon) {
    couponObj = db.coupons.find((c) => c.code.toUpperCase() === String(coupon).toUpperCase() && c.active);
    if (!couponObj) return res.status(400).json({ error: 'Invalid coupon code.' });
    discountUSD = round2((subtotalUSD * couponObj.percent) / 100);
  }
  const s = db.settings;
  const shippingUSD = subtotalUSD - discountUSD >= s.freeShippingOverUSD ? 0 : s.shippingFeeUSD;
  const totalUSD = round2(subtotalUSD - discountUSD + shippingUSD);

  // decrement stock
  for (const it of lineItems) {
    const p = db.products.find((x) => x.id === it.productId);
    p.stock -= it.qty;
  }

  const orderId = 'ZP-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const nowIso = new Date().toISOString();
  const order = {
    id: orderId, userId: req.user.id, items: lineItems,
    subtotalUSD, discountUSD, shippingUSD, totalUSD,
    currency: s.exchangeRate ? 'USD' : 'USD', exchangeRate: s.exchangeRate,
    address: { fullName: address.fullName, phone: address.phone, line1: address.line1, city: address.city, region: address.region || '' },
    paymentMethod: method, paymentStatus: 'unpaid', status: 'awaiting_payment',
    coupon: couponObj ? couponObj.code : null, notes: String(notes || '').slice(0, 500),
    createdAt: nowIso, updatedAt: nowIso
  };
  trackForStatus(order, 'awaiting_payment');
  db.orders.push(order);

  let payment = null;
  if (method === 'momo' || method === 'bank') {
    payment = {
      id: uid('PAY'), orderId, amountUSD: totalUSD, currency: 'USD', exchangeRate: s.exchangeRate, method,
      side: 'client', status: 'pending', reference: '',
      note: method === 'momo' ? 'Awaiting mobile money transaction ID' : 'Awaiting transfer reference', createdAt: nowIso, updatedAt: nowIso
    };
    db.payments.push(payment);
  } // cod: no payment record until delivered / admin records it

  save();
  res.json({ order, payment });
});

// Customers cannot cancel once an order is placed. Only the store (admin) can cancel an order.
app.post('/api/orders/:id/cancel', auth, (req, res) => {
  res.status(403).json({ error: 'Orders cannot be cancelled once they are placed. Please contact the store if you need help.' });
});

/* ---------------- Customer payments: bank transfer and mobile money ----------------
   The customer sends the money to the store's own account / wallet (details are set by the owner in
   Admin -> Settings) and submits the transaction ID. An admin checks it against the bank or wallet
   statement and only then marks the payment as paid. Nothing the browser says can mark an order paid. */
app.post('/api/payments/:id/submit-reference', auth, (req, res) => {
  const pay = db.payments.find((p) => p.id === req.params.id);
  if (!pay) return res.status(404).json({ error: 'Payment not found.' });
  const order = db.orders.find((o) => o.id === pay.orderId);
  if (!order || order.userId !== req.user.id) return res.status(403).json({ error: 'Not your payment.' });
  if (pay.side !== 'client' || !['bank', 'momo'].includes(pay.method)) return res.status(400).json({ error: 'This payment does not use a reference.' });
  if (!['pending', 'submitted', 'failed'].includes(pay.status) || order.status !== 'awaiting_payment') {
    return res.status(400).json({ error: 'This payment can no longer be changed.' });
  }
  const { reference, provider, senderPhone } = req.body || {};
  const ref = String(reference || '').trim().slice(0, 60);
  if (ref.length < 4) return res.status(400).json({ error: 'Please enter your transfer reference / transaction ID.' });
  let note = 'Client submitted reference — awaiting admin verification';
  if (pay.method === 'momo') {
    if (!momoReady().some((m) => m.provider === provider)) return res.status(400).json({ error: 'Please choose the mobile money provider you paid with.' });
    const phone = String(senderPhone || '').trim();
    if (!/^\+?[0-9 ]{8,15}$/.test(phone)) return res.status(400).json({ error: 'Enter the phone number you sent the money from.' });
    note = `${provider} • from ${phone} — awaiting admin verification`;
  }
  // one transaction ID can only pay for one order
  const used = db.payments.some((x) => x.id !== pay.id && x.method === pay.method && x.reference && x.reference.toLowerCase() === ref.toLowerCase() && ['submitted', 'completed'].includes(x.status));
  if (used) return res.status(400).json({ error: 'That reference has already been used for another payment. Please check it, or contact the store.' });
  pay.status = 'submitted';
  pay.reference = ref;
  pay.note = note;
  pay.updatedAt = new Date().toISOString();
  if (order.paymentStatus === 'failed') order.paymentStatus = 'unpaid';
  save();
  res.json({ ok: true, payment: pay, order });
});

/* ---------------- Coupons (public check) ---------------- */
app.get('/api/coupons/validate', (req, res) => {
  const code = String(req.query.code || '').toUpperCase();
  const c = db.coupons.find((x) => x.code === code && x.active);
  if (!c) return res.status(404).json({ error: 'Invalid coupon code.' });
  res.json({ code: c.code, percent: c.percent });
});

/* ---------------- ADMIN ---------------- */
app.use('/api/admin', auth, adminOnly);

app.get('/api/admin/stats', (req, res) => {
  const completed = db.payments.filter((p) => p.status === 'completed');
  const revenueUSD = round2(completed.reduce((s, p) => s + p.amountUSD, 0));
  const paidOrders = db.orders.filter((o) => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status));
  const customers = db.users.filter((u) => u.role === 'customer');
  const lowStock = db.products.filter((p) => p.stock <= 5).map((p) => ({ id: p.id, name: p.name, stock: p.stock }));
  // last 7 days revenue (completed payments by day)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-GB', { weekday: 'short' });
    const total = round2(
      completed.filter((p) => String(p.updatedAt || p.createdAt).slice(0, 10) === key).reduce((s, p) => s + p.amountUSD, 0)
    );
    days.push({ key, label, total });
  }
  const recent = [...db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
  const pendingPayments = db.payments.filter((p) => ['pending', 'submitted'].includes(p.status)).length;
  res.json({
    revenueUSD, revenueSLE: round2(completed.reduce((t, p) => t + p.amountUSD * (p.exchangeRate || db.settings.exchangeRate), 0)),
    orders: db.orders.length, paidOrders: paidOrders.length, customers: customers.length,
    products: db.products.length, lowStock, days, recent, pendingPayments,
    openOrders: db.orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length
  });
});

/* image upload (drag & drop / file picker) */
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
const IMG_TYPES = {
  'image/png': { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
  'image/jpeg': { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  'image/webp': { ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46] },
  'image/gif': { ext: 'gif', magic: [0x47, 0x49, 0x46] }
};
app.post('/api/admin/upload', (req, res) => {
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(String((req.body || {}).dataUrl || ''));
  const type = m && IMG_TYPES[m[1]];
  if (!type) return res.status(400).json({ error: 'Please choose a PNG, JPG, WEBP or GIF image.' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image is too large (maximum 5 MB).' });
  if (!type.magic.every((b, i) => buf[i] === b)) return res.status(400).json({ error: 'That file is not a valid image.' });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = crypto.randomBytes(8).toString('hex') + '.' + type.ext; // random name: the client cannot choose a path
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  const done = () => { logAudit(req, 'image.upload', name); save(); res.json({ path: 'uploads/' + name }); };
  if (storage) storage.putUpload(name, m[1], buf).then(done).catch((e) => { console.error('[ZUPA] upload not saved to Neon:', e.message); res.status(500).json({ error: 'Could not store the image. Please try again.' }); });
  else done();
});
// Images uploaded earlier (or on another machine) are restored from Neon when missing on disk
app.get('/uploads/:name', async (req, res, next) => {
  if (!storage || !/^[0-9a-f]{16}\.(png|jpg|webp|gif)$/.test(req.params.name)) return next();
  try {
    const u = await storage.getUpload(req.params.name);
    if (!u) return next();
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, req.params.name), u.data);
    res.setHeader('Content-Type', u.mime); res.setHeader('Cache-Control', 'public, max-age=86400'); res.end(u.data);
  } catch (e) { next(); }
});

/* best sellers (paid / fulfilled orders only) */
function bestSellers(days) {
  const since = days > 0 ? Date.now() - days * 86400000 : 0;
  const map = new Map();
  for (const o of db.orders) {
    if (!['paid', 'processing', 'shipped', 'delivered'].includes(o.status)) continue;
    if (new Date(o.createdAt).getTime() < since) continue;
    for (const it of o.items) {
      const r = map.get(it.productId) || { productId: it.productId, name: it.name, image: it.image, units: 0, revenueUSD: 0, orders: 0, lastSoldAt: o.createdAt };
      r.units += it.qty; r.revenueUSD = round2(r.revenueUSD + it.qty * it.priceUSD); r.orders += 1;
      if (new Date(o.createdAt) > new Date(r.lastSoldAt)) r.lastSoldAt = o.createdAt;
      map.set(it.productId, r);
    }
  }
  return [...map.values()].sort((a, b) => b.units - a.units || b.revenueUSD - a.revenueUSD).slice(0, 5);
}
app.get('/api/admin/best-sellers', (req, res) => {
  const days = Math.max(0, parseInt(req.query.days, 10) || 0);
  res.json({ days, generatedAt: new Date().toISOString(), items: bestSellers(days) });
});

/* admin accounts: each admin signs in with their own credentials; only the owner manages them */
function ownerOnly(req, res, next) {
  if (req.user.adminRole !== 'owner') return res.status(403).json({ error: 'Only the store owner can manage admin accounts.' });
  next();
}
const adminView = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, adminRole: u.adminRole, active: u.active !== false, createdAt: u.createdAt, products: db.products.filter((p) => p.createdById === u.id).length });
app.get('/api/admin/admins', (req, res) => res.json(db.users.filter((u) => u.role === 'admin').map(adminView)));
app.post('/api/admin/admins', ownerOnly, (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and a temporary password are required.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())) return res.status(400).json({ error: 'An account with that email already exists.' });
  const salt = crypto.randomBytes(16).toString('hex');
  const u = { id: uid('u'), name: String(name).slice(0, 80), email: String(email).toLowerCase(), phone: phone || '', city: '', role: 'admin', adminRole: 'admin', active: true, salt, passwordHash: hashPw(String(password), salt), createdAt: new Date().toISOString() };
  db.users.push(u);
  logAudit(req, 'admin.create', u.email);
  save();
  res.json(adminView(u));
});
app.put('/api/admin/admins/:id', ownerOnly, (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id && x.role === 'admin');
  if (!u) return res.status(404).json({ error: 'Admin not found.' });
  if (u.adminRole === 'owner') return res.status(400).json({ error: 'The owner account cannot be changed here.' });
  const { active, password } = req.body || {};
  if (active != null) {
    u.active = !!active;
    if (!u.active) revokeUserTokens(u.id); // sign them out everywhere
    logAudit(req, u.active ? 'admin.activate' : 'admin.deactivate', u.email);
  }
  if (password != null) {
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    u.salt = crypto.randomBytes(16).toString('hex'); u.passwordHash = hashPw(String(password), u.salt);
    revokeUserTokens(u.id);
    logAudit(req, 'admin.reset-password', u.email);
  }
  save();
  res.json(adminView(u));
});
app.get('/api/admin/audit', ownerOnly, (req, res) => res.json([...db.audit].reverse().slice(0, 100)));

// Prices are entered in NLe and stay fixed in NLe; the USD figure follows today's exchange rate.
function setPrice(p, b) {
  if (b.priceSLE != null && b.priceSLE !== '') p.priceSLE = round2(Math.max(0, parseFloat(b.priceSLE) || 0));
  else if (b.priceUSD != null) p.priceSLE = round2(Math.max(0, parseFloat(b.priceUSD) || 0) * db.settings.exchangeRate);
  p.priceUSD = Math.round((p.priceSLE / db.settings.exchangeRate) * 10000) / 10000;
}

/* products CRUD */
app.get('/api/admin/products', (req, res) => res.json(db.products));
app.post('/api/admin/products', (req, res) => {
  const b = req.body || {};
  if (!b.name || (b.priceUSD == null && b.priceSLE == null)) return res.status(400).json({ error: 'Name and price are required.' });
  const p = {
    id: String(b.id || b.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || uid('p'),
    name: String(b.name).slice(0, 120),
    category: b.category || db.settings.categories[0],
    priceUSD: 0, priceSLE: 0,
    stock: Math.max(0, parseInt(b.stock, 10) || 0),
    active: b.active !== false,
    featured: !!b.featured,
    image: b.image || 'images/coffee.png',
    description: String(b.description || '').slice(0, 2000),
    sizes: b.sizes != null ? cleanSizes(b.sizes) : suggestSizes({ name: b.name }),
    reviews: [], createdAt: new Date().toISOString(),
    createdById: req.user.id, createdByName: req.user.name   // set by the server, never trusted from the browser
  };
  if (db.products.find((x) => x.id === p.id)) p.id = uid('p');
  setPrice(p, b);
  db.products.push(p);
  logAudit(req, 'product.create', p.id);
  save();
  res.json(p);
});
/* bulk import: rows come from a spreadsheet saved as CSV (the browser parses it; the server checks every row again) */
const toBool = (v, dflt) => { const t = String(v == null ? '' : v).trim().toLowerCase(); if (!t) return dflt; if (['yes', 'y', 'true', '1', 'x'].includes(t)) return true; if (['no', 'n', 'false', '0'].includes(t)) return false; return null; };
function checkImportRow(r, catMap) {
  const name = clean(r.name, 120);
  if (!name) return { error: 'Name is missing.' };
  const category = catMap.get(String(r.category || '').trim().toLowerCase());
  if (!category) return { error: r.category ? `Unknown category “${clean(r.category, 40)}”.` : 'Category is missing.' };
  const priceTxt = String(r.priceSLE == null ? '' : r.priceSLE).replace(/nle|le|,|\s/gi, '');
  const price = parseFloat(priceTxt);
  if (!/^\d+(\.\d+)?$/.test(priceTxt) || !(price > 0) || price > 1e9) return { error: 'Price (NLe) must be a number above 0.' };
  const stockTxt = String(r.stock == null ? '' : r.stock).trim();
  if (stockTxt && !/^\d{1,7}$/.test(stockTxt)) return { error: 'Stock must be a whole number.' };
  const image = String(r.image || '').trim();
  if (image && !/^(https:\/\/[^\s"'<>]{4,480}|(images|uploads)\/[A-Za-z0-9._-]{1,80})$/.test(image)) return { error: 'Image must be an https:// link (or leave it empty and add the photo later).' };
  const featured = toBool(r.featured, false), active = toBool(r.active, true);
  if (featured === null || active === null) return { error: 'Featured / Active must be yes or no.' };
  const sz = String(r.sizes == null ? '' : r.sizes).trim();
  const sizes = !sz ? suggestSizes({ name }) : /^(none|no|-|n\/a)$/i.test(sz) ? [] : cleanSizes(sz);
  return { value: { name, sizes, category, price: round2(price), stock: stockTxt ? parseInt(stockTxt, 10) : 0, image: image || 'images/placeholder.png', description: clean(r.description, 2000), featured, active } };
}
app.post('/api/admin/products/bulk', (req, res) => {
  const rows = (req.body || {}).rows;
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'The file has no product rows.' });
  if (rows.length > 500) return res.status(400).json({ error: 'Please import at most 500 products at a time.' });
  const catMap = new Map(db.settings.categories.map((c) => [c.toLowerCase(), c]));
  const names = new Set(db.products.map((p) => p.name.trim().toLowerCase()));
  const created = [], skipped = [];
  rows.forEach((r, i) => {
    const line = parseInt(r && r.line, 10) || i + 2;
    const chk = checkImportRow(r || {}, catMap);
    if (chk.error) return skipped.push({ line, name: clean(r && r.name, 60), reason: chk.error });
    const v = chk.value, key = v.name.toLowerCase();
    if (names.has(key)) return skipped.push({ line, name: v.name, reason: 'A product with this name already exists.' });
    names.add(key);
    let id = v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || uid('p');
    if (db.products.find((x) => x.id === id)) id = uid('p');
    const p = {
      id, name: v.name, category: v.category, priceUSD: 0, priceSLE: 0, stock: v.stock, active: v.active, featured: v.featured,
      image: v.image, description: v.description, sizes: v.sizes, reviews: [], createdAt: new Date().toISOString(),
      createdById: req.user.id, createdByName: req.user.name
    };
    setPrice(p, { priceSLE: v.price });
    db.products.push(p);
    created.push(p.id);
  });
  if (created.length) { logAudit(req, 'product.bulk-import', `${created.length} products`); save(); }
  res.json({ created: created.length, skipped });
});
app.put('/api/admin/products/:id', (req, res) => {
  const p = db.products.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  const b = req.body || {};
  if (b.name != null) p.name = String(b.name).slice(0, 120);
  if (b.category != null) p.category = b.category;
  if (b.priceUSD != null || b.priceSLE != null) setPrice(p, b);
  if (b.stock != null) p.stock = Math.max(0, parseInt(b.stock, 10) || 0);
  if (b.active != null) p.active = !!b.active;
  if (b.featured != null) p.featured = !!b.featured;
  if (b.image != null) p.image = b.image;
  if (b.description != null) p.description = String(b.description).slice(0, 2000);
  if (b.sizes != null) p.sizes = cleanSizes(b.sizes);
  p.updatedById = req.user.id; p.updatedByName = req.user.name; p.updatedAt = new Date().toISOString();
  logAudit(req, 'product.update', p.id);
  save();
  res.json(p);
});
app.delete('/api/admin/products/:id', (req, res) => {
  const idx = db.products.findIndex((x) => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Product not found.' });
  const p = db.products[idx];
  if (db.orders.some((o) => o.items.some((i) => i.productId === p.id))) {
    p.active = false; // soft delete — appears in old orders
    logAudit(req, 'product.hide', p.id);
    save();
    return res.json({ ok: true, softDeleted: true });
  }
  db.products.splice(idx, 1);
  logAudit(req, 'product.delete', p.id);
  save();
  res.json({ ok: true });
});

/* orders admin */
app.get('/api/admin/orders', (req, res) => {
  const list = [...db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((o) => {
      const u = db.users.find((x) => x.id === o.userId);
      return { ...o, customerName: u ? u.name : 'Unknown', customerEmail: u ? u.email : '', payments: db.payments.filter((p) => p.orderId === o.id) };
    });
  res.json(list);
});
app.put('/api/admin/orders/:id', (req, res) => {
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  const { status } = req.body || {};
  const flow = { awaiting_payment: 1, paid: 2, processing: 3, shipped: 4, delivered: 5 };
  const nowIso = new Date().toISOString();
  if (status === 'cancelled') {
    if (o.status === 'delivered') return res.status(400).json({ error: 'Delivered orders cannot be cancelled.' });
    for (const it of o.items) {
      const p = db.products.find((x) => x.id === it.productId);
      if (p) p.stock += it.qty;
    }
    o.status = 'cancelled';
    trackForStatus(o, 'cancelled');
    o.updatedAt = nowIso;
    save();
    return res.json(o);
  }
  if (!flow[status]) return res.status(400).json({ error: 'Invalid status.' });
  // advancing one step at a time (or back within flow), but not into paid unless payment done
  if (status === 'paid' && o.paymentStatus !== 'paid') {
    return res.status(400).json({ error: 'Record/complete a payment first.' });
  }
  if (status === 'processing' && !['paid', 'awaiting_payment'].includes(o.status) && o.paymentStatus !== 'paid') {
    return res.status(400).json({ error: 'Order must be paid first.' });
  }
  if (o.status !== status) { trackForStatus(o, status); logAudit(req, 'order.' + status, o.id); }
  if (status === 'shipped') setEta(o, (req.body || {}).eta, req.user.name);
  o.status = status;
  o.updatedAt = nowIso;
  save();
  res.json(o);
});
app.put('/api/admin/orders/:id/eta', (req, res) => {
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  if (!['paid', 'processing', 'shipped'].includes(o.status)) return res.status(400).json({ error: 'An estimate can only be set on open orders.' });
  setEta(o, req.body || {}, req.user.name);
  addTrack(o, o.status, '', 'Delivery estimate updated');
  logAudit(req, 'order.eta', o.id);
  save();
  res.json(o);
});
// Admin posts a location update, e.g. "Hastings checkpoint" — time is stamped by the server
app.post('/api/admin/orders/:id/tracking', (req, res) => {
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  if (['delivered', 'cancelled'].includes(o.status)) return res.status(400).json({ error: 'This order is closed.' });
  const location = String((req.body || {}).location || '').trim().slice(0, 120);
  const note = String((req.body || {}).note || '').trim().slice(0, 200);
  if (!location) return res.status(400).json({ error: 'Enter the package\'s current location.' });
  addTrack(o, o.status, location, note || 'Location update');
  o.updatedAt = new Date().toISOString();
  save();
  res.json(o);
});

/* payments admin */
app.get('/api/admin/payments', (req, res) => {
  const list = [...db.payments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((p) => {
    const o = db.orders.find((x) => x.id === p.orderId);
    const u = o ? db.users.find((x) => x.id === o.userId) : null;
    return { ...p, orderTotalUSD: o ? o.totalUSD : 0, customerName: u ? u.name : '', orderStatus: o ? o.status : '' };
  });
  res.json(list);
});
// admin acts on a payment (complete / fail) — the ADMIN side of payments
app.post('/api/admin/payments/:id', (req, res) => {
  const p = db.payments.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Payment not found.' });
  const { action, note } = req.body || {};
  const o = db.orders.find((x) => x.id === p.orderId);
  const nowIso = new Date().toISOString();
  if (action === 'complete') {
    p.status = 'completed';
    p.note = note || 'Verified by admin';
    p.updatedAt = nowIso;
    if (o) {
      o.paymentStatus = 'paid';
      if (o.status === 'awaiting_payment') o.status = 'paid';
      o.updatedAt = nowIso;
    }
  } else if (action === 'fail') {
    p.status = 'failed';
    p.note = note || 'Rejected by admin';
    p.updatedAt = nowIso;
    if (o) { o.paymentStatus = 'failed'; o.updatedAt = nowIso; }
  } else return res.status(400).json({ error: 'Invalid action.' });
  save();
  res.json({ ok: true, payment: p, order: o });
});
// admin records a manual payment (cash, POS, transfer received) — ADMIN side
app.post('/api/admin/payments', (req, res) => {
  const { orderId, amountUSD, method, note } = req.body || {};
  const o = db.orders.find((x) => x.id === orderId);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  const amt = round2(parseFloat(amountUSD));
  if (!(amt > 0)) return res.status(400).json({ error: 'Enter a valid amount.' });
  const nowIso = new Date().toISOString();
  const p = {
    id: uid('PAY'), orderId, amountUSD: amt, currency: 'USD',
    method: method || 'manual', side: 'admin', status: 'completed',
    reference: 'ADM-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    note: String(note || 'Recorded by admin').slice(0, 200),
    exchangeRate: o.exchangeRate || db.settings.exchangeRate,
    createdAt: nowIso, updatedAt: nowIso
  };
  db.payments.push(p);
  o.paymentStatus = 'paid';
  if (o.status === 'awaiting_payment') o.status = 'paid';
  o.updatedAt = nowIso;
  save();
  res.json({ ok: true, payment: p, order: o });
});

/* users admin */
app.get('/api/admin/users', (req, res) => {
  const list = db.users.map((u) => {
    const orders = db.orders.filter((o) => o.userId === u.id);
    const spend = round2(orders.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + o.totalUSD, 0));
    const { salt, passwordHash, reset, ...rest } = u;
    return { ...rest, orders: orders.length, spendUSD: spend };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

/* coupons admin */
app.get('/api/admin/coupons', (req, res) => res.json(db.coupons));
app.post('/api/admin/coupons', (req, res) => {
  const { code, percent } = req.body || {};
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pc = parseInt(percent, 10);
  if (!c || !(pc > 0 && pc <= 90)) return res.status(400).json({ error: 'Enter a code and a percent between 1 and 90.' });
  if (db.coupons.find((x) => x.code === c)) return res.status(400).json({ error: 'Coupon already exists.' });
  const coupon = { code: c, percent: pc, active: true, createdAt: new Date().toISOString() };
  db.coupons.push(coupon);
  save();
  res.json(coupon);
});
app.delete('/api/admin/coupons/:code', (req, res) => {
  const c = db.coupons.find((x) => x.code === req.params.code.toUpperCase());
  if (!c) return res.status(404).json({ error: 'Coupon not found.' });
  c.active = false;
  save();
  res.json({ ok: true });
});

/* settings admin */
app.put('/api/admin/settings', (req, res) => {
  const b = req.body || {};
  const s = db.settings;
  let newPay = null;
  if (b.paymentDetails != null) {
    if (req.user.adminRole !== 'owner') return res.status(403).json({ error: 'Only the store owner can change where customers send payments.' });
    const r = parsePaymentDetails(b.paymentDetails);
    if (r.error) return res.status(400).json({ error: r.error });
    newPay = r.value;
  }
  if (newPay && JSON.stringify(newPay) !== JSON.stringify(s.paymentDetails)) {
    const sum = (d) => `bank ${d.bank.bankName ? d.bank.bankName + ' ' + mask(d.bank.accountNumber) : 'none'}; momo ${d.momo.map((m) => m.provider + ' ' + mask(m.number)).join(', ') || 'none'}`;
    logAudit(req, 'payment-details.update', `${sum(s.paymentDetails)} -> ${sum(newPay)}`);
    s.paymentDetails = newPay;
  }
  if (b.storeName != null) s.storeName = String(b.storeName).slice(0, 60);
  if (b.exchangeRate != null) {
    const r = parseFloat(b.exchangeRate);
    if (!(r > 0) || r > 100000) return res.status(400).json({ error: 'Enter a valid exchange rate (NLe per $1).' });
    if (r !== s.exchangeRate) {
      s.rateHistory.push({ at: new Date().toISOString(), rate: r, by: req.user.name, from: s.exchangeRate });
      if (s.rateHistory.length > 50) s.rateHistory.shift();
      logAudit(req, 'rate.update', `${s.exchangeRate} -> ${r}`);
      s.exchangeRate = r;
    }
  }
  if (b.shippingFeeSLE != null) s.shippingFeeSLE = Math.max(0, round2(parseFloat(b.shippingFeeSLE) || 0));
  if (b.freeShippingOverSLE != null) s.freeShippingOverSLE = Math.max(0, round2(parseFloat(b.freeShippingOverSLE) || 0));
  applyRate(); // re-derive every USD figure from the NLe prices
  if (Array.isArray(b.categories) && b.categories.length) s.categories = b.categories.map((c) => String(c).slice(0, 40)).slice(0, 12);
  save();
  res.json(publicSettings());
});
app.get('/api/admin/rate-history', (req, res) => res.json([...db.settings.rateHistory].reverse().slice(0, 30)));

/* SPA fallback */
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ZUPA running on http://0.0.0.0:${PORT}`);
});
