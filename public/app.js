/* ==================== ZUPA · Online Store SPA ==================== */
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%23fff1e6%22/%3E%3Ccircle cx=%22100%22 cy=%22100%22 r=%2252%22 fill=%22%23ea580c%22/%3E%3Ctext x=%22100%22 y=%22115%22 font-family=%22Arial%22 font-size=%2238%22 font-weight=%22bold%22 fill=%22white%22 text-anchor=%22middle%22%3EZ%3C/text%3E%3C/svg%3E";

const METHOD = {
  card: { label: 'Card payment', icon: '💳' },
  momo: { label: 'Mobile Money', icon: '📱' },
  bank: { label: 'Bank transfer', icon: '🏦' },
  cod: { label: 'Cash on delivery', icon: '💵' },
  manual: { label: 'Manual entry', icon: '📝' }
};
const ORDER_FLOW = ['awaiting_payment', 'paid', 'processing', 'shipped', 'delivered'];
const ORDER_LABELS = {
  awaiting_payment: 'Awaiting payment', paid: 'Paid', processing: 'Processing',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled'
};
const NEXT_STATUS = { paid: 'processing', processing: 'shipped', shipped: 'delivered' };

function guardImages(root) {
  $$('img', root).forEach(img => {
    img.addEventListener('error', () => { img.src = FALLBACK_IMG; }, { once: true });
  });
}
const fmtDate = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/* ---------- state ---------- */
const store = {
  // Admin sign-ins live only in this browser tab (sessionStorage); customer sign-ins are remembered (localStorage).
  // So an admin window and a customer window can be open side by side without overwriting each other.
  get token() { try { return sessionStorage.getItem('lm_token') || localStorage.getItem('lm_token') || ''; } catch { return ''; } },
  set token(v) {
    try {
      if (!v) { sessionStorage.removeItem('lm_token'); localStorage.removeItem('lm_token'); }
    } catch { /* storage unavailable */ }
  },
  saveToken(v, role) {
    try {
      if (role === 'admin') sessionStorage.setItem('lm_token', v);
      else { sessionStorage.removeItem('lm_token'); localStorage.setItem('lm_token', v); }
    } catch { /* storage unavailable */ }
  },
  get currency() { return localStorage.getItem('lm_currency') || 'SLE'; },
  set currency(v) { localStorage.setItem('lm_currency', v); },
  get cart() { try { return JSON.parse(localStorage.getItem('lm_cart')) || []; } catch { return []; } },
  set cart(v) { localStorage.setItem('lm_cart', JSON.stringify(v)); updateBadges(); },
  get wishlist() { try { return JSON.parse(localStorage.getItem('lm_wishlist')) || []; } catch { return []; } },
  set wishlist(v) { localStorage.setItem('lm_wishlist', JSON.stringify(v)); updateBadges(); }
};
const state = { user: null, settings: { storeName: 'ZUPA', exchangeRate: 23.5, shippingFeeUSD: 7.5, freeShippingOverUSD: 75, categories: [] }, products: [] };
let checkoutState = { method: 'bank', coupon: null };

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {   // callers already pass full '/api/...' paths
    method,
    headers: { 'Content-Type': 'application/json', ...(store.token ? { Authorization: 'Bearer ' + store.token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data;
}
function go(h) { if (location.hash === h) route(); else location.hash = h; }
async function refreshProducts() { try { state.products = await api('/api/products'); } catch { /* ignore */ } }

/* ---------- money / display ---------- */
const ETA_OPTIONS = [['2h', 'Within 2 hours'], ['4h', 'Within 4 hours'], ['1d', 'Within 1 day'], ['1-2d', '1–2 days'], ['2-3d', '2–3 days'], ['3-5d', '3–5 days']];
function fmtEta(eta) {
  if (!eta) return '';
  const a = new Date(eta.from), b = new Date(eta.to);
  const day = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = (d) => d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  const today = new Date().toDateString();
  if (b - a <= 8 * 3600000 && a.toDateString() === b.toDateString()) return `${a.toDateString() === today ? 'Today' : day(a)}, ${time(a)} – ${time(b)}`;
  return a.toDateString() === b.toDateString() ? day(a) : `${day(a)} – ${day(b)}`;
}
function money(usd, frozenRate) {
  const rate = frozenRate || state.settings.exchangeRate || 23.5;
  if (store.currency === 'SLE') {
    return 'NLe ' + (usd * rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + Number(usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function moneyCompact(usd) {
  const rate = state.settings.exchangeRate || 23.5;
  if (store.currency === 'SLE') {
    const v = usd * rate;
    return v >= 1000 ? 'NLe ' + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : 'NLe ' + Math.round(v);
  }
  return usd >= 1000 ? '$' + (usd / 1000).toFixed(1) + 'k' : '$' + Math.round(usd);
}
function secondCurrency(usd) {
  const rate = state.settings.exchangeRate || 23.5;
  return store.currency === 'SLE'
    ? '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : 'NLe ' + (usd * rate).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function stars(r) {
  const v = Math.round(r || 0);
  return '<span class="stars">' + '★'.repeat(v) + '<span class="off">' + '★'.repeat(5 - v) + '</span></span>';
}
function pill(status) { return `<span class="pill ${esc(status)}">${esc(String(status).replace(/_/g, ' '))}</span>`; }

/* ---------- toast / modal ---------- */
function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = (type === 'err' ? '⚠️ ' : type === 'warn' ? '⏳ ' : '✅ ') + esc(msg);
  $('#toastRoot').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 320); }, 3200);
}
function openModal(html, cls = '') {
  const b = document.createElement('div');
  b.className = 'modal-backdrop';
  b.innerHTML = `<div class="modal ${cls}">${html}</div>`;
  b.addEventListener('click', (e) => { if (e.target === b) b.remove(); });
  $('#modalRoot').appendChild(b);
  $$('.modal-x', b).forEach(x => x.addEventListener('click', () => b.remove()));
  return b;
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
function confirmDialog(title, message, onOk, danger = false) {
  const m = openModal(`
    <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-x">✕</button></div>
    <div class="modal-body">
      <p style="color:var(--ink-2);margin-bottom:18px">${esc(message)}</p>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn ghost" id="cfNo">Cancel</button>
        <button class="btn ${danger ? 'danger' : ''}" id="cfYes">Confirm</button>
      </div>
    </div>`);
  $('#cfNo', m).addEventListener('click', () => m.remove());
  $('#cfYes', m).addEventListener('click', async () => {
    const btn = $('#cfYes', m); btn.disabled = true; btn.textContent = 'Working…';
    try { await onOk(); m.remove(); } catch (e) { btn.disabled = false; btn.textContent = 'Confirm'; toast(e.message, 'err'); }
  });
}

/* ---------- header ---------- */
function cartCount() { return store.cart.reduce((s, i) => s + i.qty, 0); }
function updateBadges() {
  const cb = $('#cartBadge'), c = cartCount();
  cb.hidden = !c; cb.textContent = c;
  const wb = $('#wishBadge'), w = store.wishlist.length;
  wb.hidden = !w; wb.textContent = w;
}
const isAdmin = () => !!(state.user && state.user.role === 'admin');
function syncHeader() {
  document.body.classList.toggle('is-admin', isAdmin());
  document.body.classList.toggle('is-guest', !state.user);
  $('#userLabel').textContent = state.user ? state.user.name.split(' ')[0] : 'Sign in';
  $('#adminNav').hidden = !(state.user && state.user.role === 'admin');
  $('#curLe').classList.toggle('on', store.currency === 'SLE');
  $('#curUsd').classList.toggle('on', store.currency === 'USD');
  updateBadges();
}

/* ---------- cart helpers ---------- */
function addToCart(id, qty = 1) {
  if (isAdmin()) { toast('Admin accounts cannot place orders.', 'warn'); return; }
  const p = state.products.find(x => x.id === id);
  const max = p ? Math.max(p.stock, 0) : 99;
  if (max <= 0) { toast('Sorry, this item is out of stock.', 'err'); return; }
  const cart = store.cart;
  const it = cart.find(x => x.id === id);
  if (it) it.qty = Math.min(it.qty + qty, max);
  else cart.push({ id, qty: Math.min(qty, max) });
  store.cart = cart;
  toast('Added to cart 🛒');
}
function setQty(id, qty) {
  let cart = store.cart;
  const it = cart.find(x => x.id === id);
  if (!it) return;
  if (qty <= 0) cart = cart.filter(x => x.id !== id);
  else it.qty = qty;
  store.cart = cart;
}
function toggleWish(id) {
  if (isAdmin()) { toast('Admin accounts do not have a wishlist.', 'warn'); return; }
  let w = store.wishlist;
  if (w.includes(id)) { w = w.filter(x => x !== id); toast('Removed from wishlist'); }
  else { w.push(id); toast('Saved to wishlist ♥'); }
  store.wishlist = w;
}
function requireUser(next) {
  if (state.user) return true;
  toast('Please sign in to continue.', 'warn');
  go('#/login' + (next ? '?next=' + encodeURIComponent(next) : ''));
  return false;
}

/* ---------- product card component ---------- */
function pCard(p) {
  const wished = store.wishlist.includes(p.id);
  const out = p.stock <= 0;
  const isNew = (Date.now() - new Date(p.createdAt)) / 86400000 < 14;
  return `
  <article class="p-card">
    <div class="img-wrap">
      <div class="flags">${p.featured ? '<span class="flag">★ Featured</span>' : ''}${isNew ? '<span class="flag new">New</span>' : ''}${out ? '<span class="flag off">Sold out</span>' : ''}</div>
      <button class="wish-btn ${wished ? 'on' : ''}" data-wish="${esc(p.id)}" title="Wishlist">${wished ? '♥' : '♡'}</button>
      <a href="#/product/${esc(p.id)}"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></a>
    </div>
    <div class="body">
      <span class="cat">${esc(p.category)}</span>
      <h3><a href="#/product/${esc(p.id)}">${esc(p.name)}</a></h3>
      <div class="rate">${stars(p.rating)} <span>${p.rating ? p.rating.toFixed(1) : 'New'}${p.reviewCount ? ' (' + p.reviewCount + ')' : ''}</span></div>
      <div class="price-row">
        <div class="price">${money(p.priceUSD)}<small>${secondCurrency(p.priceUSD)}</small></div>
        <button class="add-btn" data-add="${esc(p.id)}" ${out ? 'disabled' : ''} title="Add to cart">+</button>
      </div>
      ${out ? '<div class="stock-out">Out of stock</div>' : p.stock <= 5 ? `<div class="stock-low">Only ${p.stock} left</div>` : ''}
    </div>
  </article>`;
}
function bindCards(root) {
  $$('[data-add]', root).forEach(b => b.addEventListener('click', () => { addToCart(b.dataset.add, 1); }));
  $$('[data-wish]', root).forEach(b => b.addEventListener('click', () => {
    toggleWish(b.dataset.wish);
    b.classList.toggle('on', store.wishlist.includes(b.dataset.wish));
    b.textContent = store.wishlist.includes(b.dataset.wish) ? '♥' : '♡';
  }));
}

/* ==================== PAGES ==================== */

/* ----- Home ----- */
async function renderHome(app) {
  await refreshProducts();
  const all = state.products;
  const featured = all.filter(p => p.featured).slice(0, 8);
  const fresh = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);
  const cats = state.settings.categories;
  app.innerHTML = `
  <section class="hero">
    <div class="hero-inner">
      <div>
        <span class="hero-kicker">🇸🇱 Your everyday shopping destination</span>
        <h1>Everything you love,<br><em>delivered to your door.</em></h1>
        <p>Electronics, fashion, local flavours and handcrafted goods — pay securely in <b>NLe</b> or <b>Dollars</b>, your choice.</p>
        <div class="hero-cta">
          ${isAdmin() ? '' : `<a class="btn lg" href="#/shop">Shop now →</a>
          <a class="btn gold lg" href="#/orders">Track my order</a>`}
        </div>
        <div class="hero-stats">
          <div class="hero-stat"><b>12+</b><span>quality products</span></div>
          <div class="hero-stat"><b>4 ways</b><span>to pay securely</span></div>
          <div class="hero-stat"><b>NLe / $</b><span>live currency switch</span></div>
        </div>
      </div>
      <div class="hero-art">
        <div class="hero-card">
          <h4>Choose how you pay</h4>
          <div class="pay-row"><span>💳 Card</span><span>📱 Orange Money</span><span>🏦 Bank transfer</span><span>💵 Cash on delivery</span></div>
        </div>
        <div class="hero-float a">📦 Order #ZP-5T3W7 shipped<small>Track it in My Orders</small></div>
        <div class="hero-float b">✅ Payment verified by admin<small>Bank transfer · NLe 7,917.75</small></div>
      </div>
    </div>
  </section>

  <div class="container">
    <div class="why-strip">
      <div class="why-card"><div class="ico">🔒</div><b>Secure payments</b><span>Card & mobile money through the ZUPA Pay gateway, verified by our team.</span></div>
      <div class="why-card"><div class="ico">🚚</div><b>Fast delivery</b><span>Free delivery in Freetown on orders over ${money(state.settings.freeShippingOverUSD)}.</span></div>
      <div class="why-card"><div class="ico">💱</div><b>NLe & Dollars</b><span>Switch currency instantly — pay in the money you prefer.</span></div>
      <div class="why-card"><div class="ico">🤝</div><b>Local support</b><span>Real people in Freetown, ready to help with your order.</span></div>
    </div>

    <section class="section">
      <div class="section-head"><div><h2>Shop by category</h2><p>Find what you need, fast</p></div></div>
      <div class="cat-chips">${cats.map(c => `<a class="cat-chip" href="#/shop?category=${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</div>
    </section>

    <section class="section">
      <div class="section-head"><div><h2>★ Featured picks</h2><p>Customer favourites this week</p></div><a class="btn ghost sm" href="#/shop">View all →</a></div>
      <div class="grid">${featured.map(pCard).join('')}</div>
    </section>

    <section class="section">
      <div class="section-head"><div><h2>Just arrived</h2><p>Fresh stock on the shelves</p></div></div>
      <div class="grid">${fresh.map(pCard).join('')}</div>
    </section>
  </div>`;
  bindCards(app);
  guardImages(app);
}

/* ----- Shop ----- */
const shopState = { q: '', category: '', sort: 'featured', max: 400 };
function shopHash() {
  const p = new URLSearchParams();
  if (shopState.q) p.set('q', shopState.q);
  if (shopState.category) p.set('category', shopState.category);
  if (shopState.sort && shopState.sort !== 'featured') p.set('sort', shopState.sort);
  if (shopState.max && shopState.max < 400) p.set('max', shopState.max);
  const s = p.toString();
  return '#/shop' + (s ? '?' + s : '');
}
async function renderShop(app, params) {
  shopState.q = params.get('q') || '';
  shopState.category = params.get('category') || '';
  shopState.sort = params.get('sort') || 'featured';
  shopState.max = params.get('max') ? parseInt(params.get('max'), 10) : 400;
  $('#searchInput').value = shopState.q;

  const qs = new URLSearchParams();
  if (shopState.q) qs.set('search', shopState.q);
  if (shopState.category) qs.set('category', shopState.category);
  qs.set('sort', shopState.sort);
  if (shopState.max < 400) qs.set('max', shopState.max);
  const [list, all] = await Promise.all([api('/api/products?' + qs.toString()), api('/api/products')]);
  const counts = {};
  all.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });

  app.innerHTML = `
  <div class="container page">
    <div class="crumb"><a href="#/">Home</a> / Shop${shopState.category ? ' / ' + esc(shopState.category) : ''}${shopState.q ? ' / “' + esc(shopState.q) + '”' : ''}</div>
    <div class="shop-layout">
      <aside class="filters">
        <h4>Categories</h4>
        <div class="filter-list">
          <button data-cat="" class="${!shopState.category ? 'on' : ''}">All products <span>${all.length}</span></button>
          ${state.settings.categories.map(c => `<button data-cat="${esc(c)}" class="${shopState.category === c ? 'on' : ''}">${esc(c)} <span>${counts[c] || 0}</span></button>`).join('')}
        </div>
        <h4>Max price (${store.currency === 'SLE' ? 'NLe' : 'Dollars'})</h4>
        <input type="range" class="range-input" id="priceRange" min="5" max="400" step="5" value="${shopState.max}">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-top:4px">
          <span>${money(5)}</span><b id="priceLabel" style="color:var(--brand-d)">${shopState.max >= 400 ? 'Any' : money(shopState.max)}</b>
        </div>
        <h4>Refine</h4>
        <button class="btn ghost sm block" id="clearFilters">Clear all filters</button>
      </aside>
      <div>
        <div class="toolbar">
          <span class="count"><b>${list.length}</b> product${list.length === 1 ? '' : 's'} found</span>
          <select id="sortSel">
            <option value="featured" ${shopState.sort === 'featured' ? 'selected' : ''}>Featured</option>
            <option value="newest" ${shopState.sort === 'newest' ? 'selected' : ''}>Newest</option>
            <option value="price-asc" ${shopState.sort === 'price-asc' ? 'selected' : ''}>Price: low → high</option>
            <option value="price-desc" ${shopState.sort === 'price-desc' ? 'selected' : ''}>Price: high → low</option>
            <option value="rating" ${shopState.sort === 'rating' ? 'selected' : ''}>Top rated</option>
          </select>
        </div>
        ${list.length ? `<div class="grid">${list.map(pCard).join('')}</div>`
      : `<div class="empty-state"><div class="big">🔍</div><h3>No products match</h3><p>Try a different search or clear your filters.</p><button class="btn" id="clearFilters2">Clear filters</button></div>`}
      </div>
    </div>
  </div>`;

  $$('[data-cat]', app).forEach(b => b.addEventListener('click', () => { shopState.category = b.dataset.cat; go(shopHash()); }));
  $('#sortSel', app).addEventListener('change', (e) => { shopState.sort = e.target.value; go(shopHash()); });
  const range = $('#priceRange', app);
  if (range) {
    range.addEventListener('input', () => {
      const v = parseInt(range.value, 10);
      $('#priceLabel', app).textContent = v >= 400 ? 'Any' : money(v);
    });
    range.addEventListener('change', () => { shopState.max = parseInt(range.value, 10); go(shopHash()); });
  }
  const clear = () => { shopState.q = ''; shopState.category = ''; shopState.sort = 'featured'; shopState.max = 400; go(shopHash()); };
  if ($('#clearFilters', app)) $('#clearFilters', app).addEventListener('click', clear);
  if ($('#clearFilters2', app)) $('#clearFilters2', app).addEventListener('click', clear);
  bindCards(app);
  guardImages(app);
}

/* ----- Product detail ----- */
async function renderProduct(app, id) {
  let p;
  try { p = await api('/api/products/' + encodeURIComponent(id)); }
  catch (e) {
    app.innerHTML = `<div class="container page"><div class="empty-state"><div class="big">😕</div><h3>Product not found</h3><p>${esc(e.message)}</p><a class="btn" href="#/shop">Back to shop</a></div></div>`;
    return;
  }
  const wished = store.wishlist.includes(p.id);
  const out = p.stock <= 0;
  const canReview = state.user && !p.reviews.some(r => r.userId === state.user.id);
  app.innerHTML = `
  <div class="container page">
    <div class="crumb"><a href="#/">Home</a> / <a href="#/shop">Shop</a> / <a href="#/shop?category=${encodeURIComponent(p.category)}">${esc(p.category)}</a> / ${esc(p.name)}</div>
    <div class="pd">
      <div class="pd-img"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div>
      <div class="pd-info">
        <span class="cat">${esc(p.category)}</span>
        <h1>${esc(p.name)}</h1>
        <div class="pd-rate">${stars(p.rating)} <b>${p.rating ? p.rating.toFixed(1) : 'No rating'}</b> · ${p.reviewCount} review${p.reviewCount === 1 ? '' : 's'}</div>
        <div class="pd-price">${money(p.priceUSD)} <small>${secondCurrency(p.priceUSD)}</small></div>
        <div style="font-size:13px;color:var(--muted)">Incl. all taxes · ${money(state.settings.freeShippingOverUSD)}+ order = free delivery</div>
        <p class="pd-desc">${esc(p.description)}</p>
        <div class="pd-meta">
          <span>Availability: <b>${out ? '<span style="color:var(--red)">Out of stock</span>' : p.stock <= 5 ? `<span style="color:var(--amber)">Only ${p.stock} left</span>` : `<span style="color:var(--ok-d)">In stock (${p.stock})</span>`}</b></span>
          <span>SKU: <b>${esc(p.id.toUpperCase())}</b></span>
          <span>Currency: <b>${store.currency === 'SLE' ? 'NLe' : 'Dollars ($)'}</b></span>
        </div>
        <div class="qty-row">
          <div class="qty-box">
            <button id="qMinus">−</button><input id="qInput" value="1" inputmode="numeric"><button id="qPlus">+</button>
          </div>
          <span style="font-size:13.5px;color:var(--muted)">Subtotal: <b id="qTotal" style="color:var(--brand-d)">${money(p.priceUSD)}</b></span>
        </div>
        <div class="pd-actions">
          <button class="btn lg" id="addBtn" ${out ? 'disabled' : ''}>🛒 ${out ? 'Out of stock' : 'Add to cart'}</button>
          <button class="btn outline lg" id="wishBtn">${wished ? '♥ In wishlist' : '♡ Wishlist'}</button>
        </div>
      </div>
    </div>

    <div class="reviews-wrap section">
      <div>
        <div class="section-head"><div><h2>Customer reviews</h2><p>${p.reviewCount ? 'What buyers are saying' : 'Be the first to review'}</p></div></div>
        ${p.reviews.length ? p.reviews.map(r => `
          <div class="review">
            <div class="review-head"><b>${esc(r.userName)} ${r.userId === (state.user && state.user.id) ? '(you)' : ''}</b><time>${fmtDay(r.createdAt)}</time></div>
            ${stars(r.rating)}
            <p style="margin-top:6px">${esc(r.comment)}</p>
          </div>`).join('')
      : '<div class="empty-state" style="padding:40px 20px"><div class="big">💬</div><h3>No reviews yet</h3><p>Share your thoughts and help other shoppers.</p></div>'}
      </div>
      <div class="review-form">
        <h3>Write a review</h3>
        ${canReview ? `
          <div class="rate-picker" id="ratePicker">
            ${[1, 2, 3, 4, 5].map(i => `<span data-r="${i}">★</span>`).join('')}
          </div>
          <div class="field"><textarea id="revComment" placeholder="What did you like or dislike?"></textarea></div>
          <div id="revErr"></div>
          <button class="btn block" id="revSubmit">Submit review</button>`
      : state.user ? '<p style="color:var(--muted);font-size:14.5px">You have already reviewed this product. Thank you! 🙏</p>'
        : '<p style="color:var(--muted);font-size:14.5px;margin-bottom:12px">Sign in to leave a review.</p><a class="btn block" href="#/login">Sign in</a>'}
      </div>
    </div>

    ${p.related.length ? `
    <section class="section">
      <div class="section-head"><div><h2>You may also like</h2></div></div>
      <div class="grid" id="relGrid">${p.related.map(r => `
        <article class="p-card">
          <div class="img-wrap"><a href="#/product/${esc(r.id)}"><img src="${esc(r.image)}" alt="${esc(r.name)}" loading="lazy"></a></div>
          <div class="body">
            <span class="cat">${esc(r.category)}</span>
            <h3><a href="#/product/${esc(r.id)}">${esc(r.name)}</a></h3>
            <div class="price-row"><div class="price">${money(r.priceUSD)}<small>${secondCurrency(r.priceUSD)}</small></div>
            <button class="add-btn" data-add="${esc(r.id)}">+</button></div>
          </div>
        </article>`).join('')}</div>
    </section>` : ''}
  </div>`;

  // qty controls
  const qi = $('#qInput', app);
  const updTotal = () => {
    let v = parseInt(qi.value, 10) || 1;
    v = Math.max(1, Math.min(v, Math.max(p.stock, 1)));
    qi.value = v;
    $('#qTotal', app).textContent = money(round2(p.priceUSD * v));
  };
  $('#qMinus', app).addEventListener('click', () => { qi.value = Math.max(1, (parseInt(qi.value, 10) || 1) - 1); updTotal(); });
  $('#qPlus', app).addEventListener('click', () => { qi.value = (parseInt(qi.value, 10) || 1) + 1; updTotal(); });
  qi.addEventListener('change', updTotal);
  $('#addBtn', app).addEventListener('click', () => { addToCart(p.id, parseInt(qi.value, 10) || 1); });
  $('#wishBtn', app).addEventListener('click', () => {
    toggleWish(p.id);
    $('#wishBtn', app).textContent = store.wishlist.includes(p.id) ? '♥ In wishlist' : '♡ Wishlist';
  });

  // review form
  let rating = 0;
  const picker = $('#ratePicker', app);
  if (picker) {
    $$('span', picker).forEach(s => {
      s.addEventListener('click', () => {
        rating = parseInt(s.dataset.r, 10);
        $$('span', picker).forEach(x => x.classList.toggle('on', parseInt(x.dataset.r, 10) <= rating));
      });
      s.addEventListener('mouseenter', () => {
        $$('span', picker).forEach(x => x.classList.toggle('on', parseInt(x.dataset.r, 10) <= parseInt(s.dataset.r, 10)));
      });
      s.addEventListener('mouseleave', () => {
        $$('span', picker).forEach(x => x.classList.toggle('on', parseInt(x.dataset.r, 10) <= rating));
      });
    });
    $('#revSubmit', app).addEventListener('click', async () => {
      const btn = $('#revSubmit', app);
      if (!rating) { $('#revErr', app).innerHTML = '<div class="error-text">Please pick a star rating.</div>'; return; }
      btn.disabled = true; btn.textContent = 'Submitting…';
      try {
        await api('/api/products/' + p.id + '/reviews', { method: 'POST', body: { rating, comment: $('#revComment', app).value } });
        toast('Review posted — thank you!');
        renderProduct(app, id);
      } catch (e) {
        toast(e.message, 'err'); btn.disabled = false; btn.textContent = 'Submit review';
      }
    });
  }
  bindCards(app);
  guardImages(app);
}

/* ----- Cart ----- */
function cartRows() {
  return store.cart.map(item => ({ ...item, p: state.products.find(x => x.id === item.id) })).filter(x => x.p);
}
function renderCart(app) {
  const rows = cartRows();
  const subtotal = round2(rows.reduce((s, r) => s + r.p.priceUSD * r.qty, 0));
  if (!rows.length) {
    app.innerHTML = `<div class="container page"><div class="empty-state"><div class="big">🛒</div><h3>Your cart is empty</h3><p>Browse the shop and add something you love.</p><a class="btn" href="#/shop">Start shopping</a></div></div>`;
    return;
  }
  app.innerHTML = `
  <div class="container page">
    <h1 class="page-title">Shopping cart</h1>
    <p class="page-sub">${cartCount()} item${cartCount() === 1 ? '' : 's'} · prices shown in ${store.currency === 'SLE' ? 'NLe' : 'Dollars ($)'}</p>
    <div class="checkout-layout">
      <div>
        <table class="cart-table">
          <thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Total</th><th></th></tr></thead>
          <tbody>
            ${rows.map(r => `
            <tr>
              <td><div class="cart-item">
                <a href="#/product/${esc(r.p.id)}"><img src="${esc(r.p.image)}" alt=""></a>
                <div><b><a href="#/product/${esc(r.p.id)}">${esc(r.p.name)}</a></b><span>${esc(r.p.category)}</span></div>
              </div></td>
              <td>${money(r.p.priceUSD)}</td>
              <td><div class="qty-box" style="height:38px">
                <button style="height:38px;width:34px" data-dec="${esc(r.id)}">−</button>
                <input style="height:38px;width:44px" value="${r.qty}" data-qty="${esc(r.id)}">
                <button style="height:38px;width:34px" data-inc="${esc(r.id)}">+</button>
              </div></td>
              <td><b>${money(round2(r.p.priceUSD * r.qty))}</b></td>
              <td><button class="link-btn" data-del="${esc(r.id)}">Remove</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
          <a class="btn ghost" href="#/shop">← Continue shopping</a>
          ${store.wishlist.length ? '<a class="btn ghost" href="#/wishlist">♥ View wishlist</a>' : ''}
        </div>
      </div>
      <div class="panel summary">
        <h2>Order summary</h2>
        <div class="sum-row"><span>Subtotal</span><b>${money(subtotal)}</b></div>
        <div class="sum-row"><span>Delivery</span><span>${subtotal >= state.settings.freeShippingOverUSD ? '<b class="free">FREE</b>' : money(state.settings.shippingFeeUSD)}</span></div>
        <div class="sum-row" style="font-size:13px;color:var(--muted)"><span>&nbsp;</span><span>${subtotal >= state.settings.freeShippingOverUSD ? 'You unlocked free delivery 🎉' : `Free delivery over ${money(state.settings.freeShippingOverUSD)}`}</span></div>
        <div class="sum-row total"><span>Estimated total</span><span>${money(round2(subtotal + (subtotal >= state.settings.freeShippingOverUSD ? 0 : state.settings.shippingFeeUSD)))}</span></div>
        <a class="btn block lg" href="#/checkout" style="margin-top:14px">Proceed to checkout →</a>
        <p style="font-size:12.5px;color:var(--muted);text-align:center;margin-top:10px">Coupons applied at checkout</p>
      </div>
    </div>
  </div>`;

  $$('[data-inc]', app).forEach(b => b.addEventListener('click', () => { setQty(b.dataset.inc, (store.cart.find(x => x.id === b.dataset.inc).qty) + 1); renderCart(app); }));
  $$('[data-dec]', app).forEach(b => b.addEventListener('click', () => { setQty(b.dataset.dec, (store.cart.find(x => x.id === b.dataset.dec).qty) - 1); renderCart(app); }));
  $$('[data-del]', app).forEach(b => b.addEventListener('click', () => { setQty(b.dataset.del, 0); renderCart(app); toast('Item removed'); }));
  $$('[data-qty]', app).forEach(inp => inp.addEventListener('change', () => {
    setQty(inp.dataset.qty, Math.max(0, parseInt(inp.value, 10) || 0)); renderCart(app);
  }));
  guardImages(app);
}

/* ----- Checkout ----- */
async function renderCheckout(app) {
  if (!requireUser('checkout')) return;
  const rows = cartRows();
  if (!rows.length) { renderCart(app); return; }
  const subtotal = round2(rows.reduce((s, r) => s + r.p.priceUSD * r.qty, 0));
  checkoutState = { method: checkoutState.method || 'bank', coupon: checkoutState.coupon };

  app.innerHTML = `
  <div class="container page">
    <div class="crumb"><a href="#/">Home</a> / <a href="#/cart">Cart</a> / Checkout</div>
    <h1 class="page-title">Checkout</h1>
    <p class="page-sub">Complete your delivery details and choose how to pay.</p>
    <div class="checkout-layout">
      <div>
        <div class="panel">
          <h2>1 · Delivery details</h2>
          <div class="form-row">
            <div class="field"><label>Full name *</label><input id="ckName" value="${esc(state.user.name)}" placeholder="Your name"></div>
            <div class="field"><label>Phone *</label><input id="ckPhone" value="${esc(state.user.phone || '')}" placeholder="+232 77 ..."></div>
          </div>
          <div class="field"><label>Street address *</label><input id="ckLine1" placeholder="House number, street"></div>
          <div class="form-row">
            <div class="field"><label>City / Town *</label><input id="ckCity" value="${esc(state.user.city || 'Freetown')}" placeholder="Freetown"></div>
            <div class="field"><label>Region</label>
              <select id="ckRegion">
                ${['Western Area', 'Bo', 'Bombali', 'Bonthe', 'Kailahun', 'Kenema', 'Koinadugu', 'Kono', 'Port Loko', 'Pujehun', 'Tonkolili'].map(r => `<option ${state.user.city === r ? 'selected' : ''}>${r}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field"><label>Delivery notes (optional)</label><textarea id="ckNotes" placeholder="Landmark, best time to call…"></textarea></div>
        </div>

        <div class="panel">
          <h2>2 · Payment method</h2>
          <div class="pay-methods" id="payMethods">
            <button class="pay-method" data-m="momo"><span class="ico">📱</span><b>Mobile Money</b><span>Orange Money, Africell Money & QMoney</span></button>
            <button class="pay-method" data-m="bank"><span class="ico">🏦</span><b>Bank transfer</b><span>Transfer first — our team verifies it</span></button>
            <button class="pay-method" data-m="cod"><span class="ico">💵</span><b>Cash on delivery</b><span>Pay the rider when your order arrives</span></button>
          </div>
          <div id="methodHint" style="background:var(--brand-xl);border-radius:10px;padding:12px 14px;font-size:13.5px;color:var(--ink-2);margin-top:12px"></div>
        </div>
      </div>

      <div class="panel summary">
        <h2>Your order</h2>
        <div class="mini-items">
          ${rows.map(r => `
          <div class="mini-item">
            <img src="${esc(r.p.image)}" alt="">
            <div><b>${esc(r.p.name)}</b><span>Qty ${r.qty} · ${money(r.p.priceUSD)} each</span></div>
            <span class="m-price">${money(round2(r.p.priceUSD * r.qty))}</span>
          </div>`).join('')}
        </div>
        <div id="sumBox"></div>
        <div class="coupon-row">
          <input id="ckCoupon" placeholder="Coupon code" value="${checkoutState.coupon ? esc(checkoutState.coupon.code) : ''}">
          <button class="btn ghost sm" id="ckCouponBtn">Apply</button>
        </div>
        <button class="btn block lg" id="placeBtn">Place order · <span id="placeAmt"></span></button>
        <p style="font-size:12.5px;color:var(--muted);text-align:center;margin-top:10px">🔒 Payments are processed securely. This is a demo store — no real money moves.</p>
      </div>
    </div>
  </div>`;

  const HINTS = {
    momo: 'You will confirm the payment from your mobile wallet right after placing the order.',
    bank: 'Order is placed first. Transfer the total to our bank account and submit your transfer reference — our admin verifies it and your order moves forward.',
    cod: 'No payment now. Our rider collects cash when your order is delivered. Available nationwide.'
  };
  function calc() {
    const sub = round2(rows.reduce((s, r) => s + r.p.priceUSD * r.qty, 0));
    const disc = checkoutState.coupon ? round2(sub * checkoutState.coupon.percent / 100) : 0;
    const ship = sub - disc >= state.settings.freeShippingOverUSD ? 0 : state.settings.shippingFeeUSD;
    return { sub, disc, ship, total: round2(sub - disc + ship) };
  }
  function refreshSummary() {
    const c = calc();
    $('#sumBox', app).innerHTML = `
      <div class="sum-row"><span>Subtotal</span><b>${money(c.sub)}</b></div>
      ${c.disc ? `<div class="sum-row" style="color:var(--ok)"><span>Coupon ${esc(checkoutState.coupon.code)} (−${checkoutState.coupon.percent}%)</span><b>−${money(c.disc)}</b></div>` : ''}
      <div class="sum-row"><span>Delivery</span><span>${c.ship === 0 ? '<b class="free">FREE</b>' : money(c.ship)}</span></div>
      <div class="sum-row total"><span>Total</span><span>${money(c.total)}</span></div>
      ${store.currency === 'SLE' ? `<div style="font-size:12.5px;color:var(--muted);text-align:right">≈ ${secondCurrency(c.total)} · rate NLe ${state.settings.exchangeRate}/$1</div>`
      : `<div style="font-size:12.5px;color:var(--muted);text-align:right">≈ ${secondCurrency(c.total)}</div>`}`;
    $('#placeAmt', app).textContent = money(c.total);
  }
  function selectMethod(m) {
    checkoutState.method = m;
    $$('.pay-method', app).forEach(b => b.classList.toggle('on', b.dataset.m === m));
    $('#methodHint', app).textContent = HINTS[m];
  }
  $$('.pay-method', app).forEach(b => b.addEventListener('click', () => selectMethod(b.dataset.m)));
  selectMethod(checkoutState.method);
  refreshSummary();

  $('#ckCouponBtn', app).addEventListener('click', async () => {
    const code = $('#ckCoupon', app).value.trim();
    if (!code) { checkoutState.coupon = null; refreshSummary(); return; }
    const btn = $('#ckCouponBtn', app); btn.disabled = true; btn.textContent = '…';
    try {
      checkoutState.coupon = await api('/api/coupons/validate?code=' + encodeURIComponent(code));
      toast(`Coupon applied: −${checkoutState.coupon.percent}%`);
      refreshSummary();
    } catch (e) {
      checkoutState.coupon = null; refreshSummary(); toast(e.message, 'err');
    } finally { btn.disabled = false; btn.textContent = 'Apply'; }
  });

  $('#placeBtn', app).addEventListener('click', async () => {
    const address = {
      fullName: $('#ckName', app).value.trim(), phone: $('#ckPhone', app).value.trim(),
      line1: $('#ckLine1', app).value.trim(), city: $('#ckCity', app).value.trim(),
      region: $('#ckRegion', app).value
    };
    if (!address.fullName || !address.phone || !address.line1 || !address.city) {
      toast('Please fill in all required delivery fields.', 'err'); return;
    }
    const btn = $('#placeBtn', app); btn.disabled = true; btn.textContent = 'Placing order…';
    try {
      const { order, payment } = await api('/api/orders', {
        method: 'POST',
        body: {
          items: store.cart.map(i => ({ productId: i.id, qty: i.qty })),
          address, paymentMethod: checkoutState.method,
          coupon: checkoutState.coupon ? checkoutState.coupon.code : null,
          notes: $('#ckNotes', app).value.trim()
        }
      });
      store.cart = [];
      checkoutState.coupon = null;
      await refreshProducts();
      toast('Order ' + order.id + ' placed 🎉');
      if (payment && (payment.method === 'card' || payment.method === 'momo')) {
        openGateway(payment, order);
      } else if (payment && payment.method === 'bank') {
        openBankModal(payment, order);
      } else {
        go('#/order/' + order.id);
      }
    } catch (e) {
      toast(e.message, 'err'); btn.disabled = false; btn.innerHTML = 'Place order · <span id="placeAmt"></span>'; refreshSummary();
    }
  });
  guardImages(app);
}

/* ----- Payment gateway (CLIENT-side payment flow) ----- */
function openGateway(payment, order) {
  const isCard = payment.method === 'card';
  const m = openModal(`
    <div class="gateway">
      <div class="g-top"><span>🔒 ZUPA Pay Secure Gateway</span><span>DEMO</span></div>
      <div class="g-amt">${money(payment.amountUSD, payment.exchangeRate)}</div>
      <div class="g-sec">${isCard ? '💳 Card payment' : '📱 Mobile money'} · Order ${esc(order.id)}</div>
    </div>
    <div class="modal-body" id="gwBody">
      ${isCard ? `
        <div class="field"><label>Card number</label><input id="gwNumber" inputmode="numeric" value="4242 4242 4242 4242"></div>
        <div class="form-row">
          <div class="field"><label>Expiry</label><input id="gwExp" value="12/28"></div>
          <div class="field"><label>CVC</label><input id="gwCvc" value="123" maxlength="4"></div>
        </div>
        <div class="field"><label>Name on card</label><input id="gwName" value="${esc(order.address.fullName)}"></div>
        <p style="font-size:12.5px;color:var(--muted);margin-bottom:12px">Demo gateway — a card number ending in <b>0</b> will be declined (try it!).</p>`
      : `
        <div class="field"><label>Provider</label><select id="gwProvider"><option>Orange Money</option><option>Africell Money</option><option>QMoney</option></select></div>
        <div class="field"><label>Mobile wallet number</label><input id="gwPhone" value="${esc(order.address.phone)}"></div>
        <div class="field"><label>Wallet PIN</label><input id="gwPin" type="password" value="1234" maxlength="6"></div>
        <p style="font-size:12.5px;color:var(--muted);margin-bottom:12px">Demo gateway — any PIN is accepted; a confirmation SMS would arrive in production.</p>`}
      <div id="gwError"></div>
      <button class="btn block lg" id="gwPay">Pay ${money(payment.amountUSD, payment.exchangeRate)} securely</button>
    </div>`);

  $('#gwPay', m).addEventListener('click', async () => {
    const btn = $('#gwPay', m);
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:3px;display:inline-block;vertical-align:middle"></span> Processing payment…';
    $('#gwError', m).innerHTML = '';
    try {
      const body = isCard
        ? { cardNumber: $('#gwNumber', m).value }
        : { momoProvider: $('#gwProvider', m).value, momoPhone: $('#gwPhone', m).value };
      await api('/api/payments/' + payment.id + '/process', { method: 'POST', body });
      await refreshProducts();
      $('#gwBody', m).innerHTML = `
        <div class="processing">
          <div class="success-mark">✓</div>
          <h3 style="margin-bottom:6px">Payment successful!</h3>
          <p style="color:var(--muted);font-size:14.5px;margin-bottom:4px">${money(payment.amountUSD, payment.exchangeRate)} paid for order <b>${esc(order.id)}</b></p>
          <p style="color:var(--muted);font-size:13px">Receipt sent to your account email.</p>
          <button class="btn block lg" id="gwDone" style="margin-top:18px">View my order →</button>
        </div>`;
      $('#gwDone', m).addEventListener('click', () => { closeModal(); go('#/order/' + order.id); });
      toast('Payment confirmed ✅');
    } catch (e) {
      $('#gwError', m).innerHTML = `<div class="error-text">${esc(e.message)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Pay ' + money(payment.amountUSD, payment.exchangeRate) + ' securely';
    }
  });
}

function openBankModal(payment, order) {
  const m = openModal(`
    <div class="modal-head"><h3>🏦 Bank transfer</h3><button class="modal-x">✕</button></div>
    <div class="modal-body">
      <p style="font-size:14.5px;color:var(--ink-2);margin-bottom:12px">Your order <b>${esc(order.id)}</b> is reserved. Transfer exactly:</p>
      <div class="bank-box">
        <b style="font-size:19px">${money(payment.amountUSD, payment.exchangeRate)}</b>
        <div class="acc">
          Account name: <b>ZUPA Ltd</b><br>
          Bank: <b>Rokel Commercial Bank</b><br>
          Account no: <b>SL01 RCBL 0000 1234 5678</b><br>
          Reference: <b>${esc(order.id)}</b>
        </div>
      </div>
      <div class="field"><label>Transfer reference / transaction ID</label><input id="bankRef" placeholder="e.g. SL26 9001 4455 8890"></div>
      <div id="bankError"></div>
      <button class="btn block" id="bankSubmit">I have paid — submit reference</button>
      <p style="font-size:12.5px;color:var(--muted);text-align:center;margin-top:10px">Our admin verifies transfers and your order moves to “Paid”.</p>
    </div>`);
  $('#bankSubmit', m).addEventListener('click', async () => {
    const btn = $('#bankSubmit', m); btn.disabled = true; btn.textContent = 'Submitting…';
    try {
      await api('/api/payments/' + payment.id + '/submit-reference', { method: 'POST', body: { reference: $('#bankRef', m).value } });
      closeModal();
      toast('Reference submitted — awaiting verification ⏳', 'warn');
      go('#/order/' + order.id);
    } catch (e) {
      $('#bankError', m).innerHTML = `<div class="error-text">${esc(e.message)}</div>`;
      btn.disabled = false; btn.textContent = 'I have paid — submit reference';
    }
  });
}

/* ----- Orders ----- */
async function renderOrders(app) {
  if (!requireUser('orders')) return;
  const orders = await api('/api/orders');
  app.innerHTML = `
  <div class="container page">
    <h1 class="page-title">My orders</h1>
    <p class="page-sub">Hi ${esc(state.user.name.split(' ')[0])} — track and manage your purchases.</p>
    ${orders.length ? orders.map(o => `
      <a class="order-card" href="#/order/${esc(o.id)}" style="color:inherit">
        <div>
          <div class="o-id">#${esc(o.id)}</div>
          <div class="o-meta">${fmtDate(o.createdAt)} · ${o.items.length} item${o.items.length === 1 ? '' : 's'} · ${METHOD[o.paymentMethod] ? METHOD[o.paymentMethod].icon + ' ' + METHOD[o.paymentMethod].label : ''}</div>
        </div>
        <div>${pill(o.status)} <span style="margin-left:6px">${pill(o.paymentStatus)}</span></div>
        <div class="o-total">${money(o.totalUSD, o.exchangeRate)}</div>
        <div class="btn ghost sm">View →</div>
      </a>`).join('')
      : `<div class="empty-state"><div class="big">📦</div><h3>No orders yet</h3><p>When you place an order it will show up here.</p><a class="btn" href="#/shop">Start shopping</a></div>`}
  </div>`;
  guardImages(app);
}

async function renderOrder(app, id) {
  if (!requireUser('order/' + id)) return;
  let o;
  try { o = await api('/api/orders/' + encodeURIComponent(id)); }
  catch (e) {
    app.innerHTML = `<div class="container page"><div class="empty-state"><div class="big">😕</div><h3>Order not found</h3><p>${esc(e.message)}</p><a class="btn" href="#/orders">My orders</a></div></div>`;
    return;
  }
  const payments = o.payments || [];
  const activePay = payments.find(p => ['pending', 'submitted', 'failed'].includes(p.status));
  const completedPay = payments.find(p => p.status === 'completed');
  const flowIdx = ORDER_FLOW.indexOf(o.status);
  const cancelled = o.status === 'cancelled';
  const canCancel = ['awaiting_payment', 'paid'].includes(o.status) && !completedPay;

  const timeline = cancelled ? `
    <div class="tl-step done"><div class="tl-dot">✓</div><div><b>Order placed</b><span>${fmtDate(o.createdAt)}</span></div></div>
    <div class="tl-step current"><div class="tl-dot">✕</div><div><b>Cancelled</b><span>Stock was returned to inventory.</span></div></div>`
    : ORDER_FLOW.map((s, i) => {
      const delivered = o.status === 'delivered';
      const isDone = delivered || i < flowIdx;
      const isCurrent = !delivered && i === flowIdx;
      const ev = (o.tracking || []).find(t => t.status === s);   // when this step happened
      let when;
      if (i === 0) when = fmtDate(o.createdAt);
      else if (ev) when = fmtDate(ev.at);
      else if (i === 1 && completedPay) when = fmtDate(completedPay.updatedAt || completedPay.createdAt);
      else when = isDone ? 'Done' : isCurrent ? 'In progress' : 'Pending';
      if (s === 'shipped' && o.eta && !delivered && i <= flowIdx) when += `<br><b style="color:var(--brand-d)">Estimated arrival: ${esc(fmtEta(o.eta))}</b>`;
      return `<div class="tl-step ${isDone ? 'done' : isCurrent ? 'current' : ''}"><div class="tl-dot">${isDone ? '✓' : i + 1}</div><div><b>${ORDER_LABELS[s]}</b><span>${when}</span></div></div>`;
    }).join('');

  app.innerHTML = `
  <div class="container page">
    <div class="crumb"><a href="#/">Home</a> / <a href="#/orders">My orders</a> / #${esc(o.id)}</div>
    <div class="order-hero">
      <div class="check">${cancelled ? '✕' : flowIdx >= 4 ? '🎉' : '✓'}</div>
      <h1>${cancelled ? 'Order cancelled' : flowIdx >= 4 ? 'Order delivered!' : 'Order confirmed!'}</h1>
      <p>${cancelled ? 'Any reserved stock has been released.' : `Thanks ${esc(o.address.fullName.split(' ')[0])} — we'll keep you posted at every step.`}</p>
      <div class="o-id-big">#${esc(o.id)}</div>
      <div style="margin-top:14px">${pill(o.status)} ${pill(o.paymentStatus)}</div>
    </div>

    <div class="order-layout">
      <div>
        <div class="panel">
          <h2>Order progress</h2>
          <div class="timeline">${timeline}</div>
        </div>

        ${(() => {
          const ev = [...(o.tracking || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
          if (!ev.length) return '';
          return `<div class="panel">
            <h2>📦 Delivery tracking</h2>
            ${o.eta && !['delivered', 'cancelled'].includes(o.status) ? `<div class="track-eta"><small>Estimated arrival</small><b>${esc(fmtEta(o.eta))}</b></div>` : ''}
            <div class="track-now"><small>${o.status === 'delivered' ? 'Delivered to' : 'Package is now at'}</small>
              <b>${esc(ev[0].location || 'Location not updated yet')}</b><span>${fmtDate(ev[0].at)}</span></div>
            <ul class="track-list">${ev.map((t, i) => `<li class="${i === 0 ? 'now' : ''}"><b>${esc(t.note)}</b>${t.location ? `<div>${esc(t.location)}</div>` : ''}<small>${fmtDate(t.at)}</small></li>`).join('')}</ul>
          </div>`;
        })()}

        ${activePay && activePay.method === 'bank' && activePay.status !== 'failed' ? `
        <div class="panel">
          <h2>🏦 Awaiting bank transfer</h2>
          ${activePay.status === 'pending' ? `
            <div class="bank-box">
              Transfer <b>${money(activePay.amountUSD, activePay.exchangeRate)}</b> to:
              <div class="acc">Account name: <b>ZUPA Ltd</b><br>Bank: <b>Rokel Commercial Bank</b><br>Account no: <b>SL01 RCBL 0000 1234 5678</b><br>Reference: <b>${esc(o.id)}</b></div>
            </div>
            <div class="field"><label>Transfer reference / transaction ID</label><input id="ordRef" value="${esc(activePay.reference || '')}" placeholder="e.g. SL26 9001 4455 8890"></div>
            <button class="btn" id="ordRefBtn">Submit reference for verification</button>`
      : `<div class="ok-text">Reference <b>${esc(activePay.reference)}</b> submitted — our admin is verifying it. Your order moves to “Paid” once confirmed.</div>`}
        </div>` : ''}

        ${activePay && ['card', 'momo'].includes(activePay.method) ? `
        <div class="panel">
          <h2>Payment required</h2>
          <p style="color:var(--ink-2);font-size:14.5px;margin-bottom:12px">Complete your ${METHOD[activePay.method].label.toLowerCase()} of <b>${money(activePay.amountUSD, activePay.exchangeRate)}</b> to confirm the order.</p>
          <button class="btn lg" id="retryPay">Pay now →</button>
        </div>` : ''}

        ${activePay && activePay.status === 'failed' ? `
        <div class="panel"><h2>Payment failed</h2>
          <p style="color:var(--ink-2);font-size:14.5px;margin-bottom:12px">Your last attempt didn't go through. Try again with another method.</p>
          <button class="btn lg" id="retryPay">Try payment again →</button>
        </div>` : ''}

        <div class="panel">
          <h2>Items (${o.items.length})</h2>
          ${o.items.map(it => `
            <div class="item-line">
              <img src="${esc(it.image)}" alt="">
              <div class="m"><b>${esc(it.name)}</b><span>Qty ${it.qty} · ${money(it.priceUSD, o.exchangeRate)} each</span></div>
              <div class="amt">${money(round2(it.priceUSD * it.qty))}</div>
            </div>`).join('')}
        </div>

        <div class="panel">
          <h2>Delivery address</h2>
          <p style="font-size:14.5px;color:var(--ink-2);line-height:1.8">
            <b>${esc(o.address.fullName)}</b><br>${esc(o.address.line1)}<br>${esc(o.address.city)}${o.address.region ? ', ' + esc(o.address.region) : ''}<br>📞 ${esc(o.address.phone)}
            ${o.notes ? '<br>📝 ' + esc(o.notes) : ''}
          </p>
        </div>
      </div>

      <div>
        <div class="panel">
          <h2>Payment</h2>
          <div class="kv"><span>Method</span><b>${METHOD[o.paymentMethod] ? METHOD[o.paymentMethod].icon + ' ' + METHOD[o.paymentMethod].label : esc(o.paymentMethod)}</b></div>
          <div class="kv"><span>Status</span><b>${pill(o.paymentStatus)}</b></div>
          <div class="kv"><span>Exchange rate</span><b>1 $ = NLe ${state.settings.exchangeRate}</b></div>
          ${payments.map(p => `
            <div style="border-top:1px solid var(--line);margin-top:8px;padding-top:8px;font-size:13px;color:var(--muted)">
              <div style="display:flex;justify-content:space-between;gap:8px"><b style="color:var(--ink)">${esc(p.id)}</b> ${pill(p.status)}</div>
              <div>${esc(p.note || '')} ${p.reference ? '· Ref: <b>' + esc(p.reference) + '</b>' : ''}</div>
              <div>${esc(p.side)}-side · ${fmtDate(p.createdAt)}</div>
            </div>`).join('')}
        </div>
        <div class="panel">
          <h2>Order total</h2>
          <div class="kv"><span>Subtotal</span><b>${money(o.subtotalUSD, o.exchangeRate)}</b></div>
          ${o.discountUSD ? `<div class="kv"><span>Discount ${o.coupon ? '(' + esc(o.coupon) + ')' : ''}</span><b style="color:var(--ok)">−${money(o.discountUSD, o.exchangeRate)}</b></div>` : ''}
          <div class="kv"><span>Delivery</span><b>${o.shippingUSD === 0 ? 'FREE' : money(o.shippingUSD, o.exchangeRate)}</b></div>
          <div class="kv total"><span>Total</span><span>${money(o.totalUSD, o.exchangeRate)}</span></div>
          <div style="font-size:12.5px;color:var(--muted);text-align:right">≈ ${secondCurrency(o.totalUSD)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${canCancel ? '<button class="btn danger block" id="cancelBtn">Cancel order</button>' : ''}
          <a class="btn ghost block" href="#/orders">← All my orders</a>
        </div>
      </div>
    </div>
  </div>`;

  const refBtn = $('#ordRefBtn', app);
  if (refBtn) refBtn.addEventListener('click', async () => {
    refBtn.disabled = true; refBtn.textContent = 'Submitting…';
    try {
      await api('/api/payments/' + activePay.id + '/submit-reference', { method: 'POST', body: { reference: $('#ordRef', app).value } });
      toast('Reference submitted ⏳', 'warn'); renderOrder(app, id);
    } catch (e) { toast(e.message, 'err'); refBtn.disabled = false; refBtn.textContent = 'Submit reference for verification'; }
  });
  const retry = $('#retryPay', app);
  if (retry) retry.addEventListener('click', () => openGateway(activePay || payments[payments.length - 1], o));
  const cancelBtn = $('#cancelBtn', app);
  if (cancelBtn) cancelBtn.addEventListener('click', () => {
    confirmDialog('Cancel order?', 'Stock will be returned and the order will be closed. This cannot be undone.', async () => {
      await api('/api/orders/' + o.id + '/cancel', { method: 'POST' });
      await refreshProducts();
      toast('Order cancelled');
      renderOrder(app, id);
    }, true);
  });
  guardImages(app);
}

/* ----- Wishlist ----- */
async function renderWishlist(app) {
  await refreshProducts();
  const items = store.wishlist.map(id => state.products.find(p => p.id === id)).filter(Boolean);
  app.innerHTML = `
  <div class="container page">
    <h1 class="page-title">My wishlist</h1>
    <p class="page-sub">${items.length} saved item${items.length === 1 ? '' : 's'}</p>
    ${items.length ? `<div class="grid">${items.map(pCard).join('')}</div>`
      : `<div class="empty-state"><div class="big">♡</div><h3>Your wishlist is empty</h3><p>Tap the heart on any product to save it here.</p><a class="btn" href="#/shop">Browse products</a></div>`}
  </div>`;
  bindCards(app);
  guardImages(app);
}


/* ----- Auth helpers ----- */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function pwField(id, label, { auto = 'current-password', hint = '' } = {}) {
  return `<div class="field"><label for="${id}">${label}</label>
    <div class="pw-wrap"><input id="${id}" type="password" autocomplete="${auto}" placeholder="••••••••">
      <button type="button" class="pw-eye" data-eye="${id}" aria-label="Show password" title="Show / hide password">👁</button></div>
    ${hint}</div>`;
}
function wirePw(root) {
  $$('[data-eye]', root).forEach(b => b.addEventListener('click', () => {
    const i = $('#' + b.dataset.eye, root); const show = i.type === 'password';
    i.type = show ? 'text' : 'password'; b.textContent = show ? '🙈' : '👁'; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  }));
}
function pwScore(pw) {
  let n = 0;
  if (pw.length >= 8) n++; if (pw.length >= 12) n++;
  if (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw)) n++;
  if (/[^A-Za-z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) n++;
  return Math.min(n, 4);
}
function wireStrength(input, meter) {
  const names = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'];
  const upd = () => {
    const v = input.value, sc = v ? pwScore(v) : -1;
    meter.innerHTML = v ? `<div class="pw-bar"><i class="s${sc}" style="width:${Math.max(1, sc) * 25}%"></i></div><span>${names[sc]} · at least 8 characters with a letter and a number</span>` : '<span>At least 8 characters with a letter and a number</span>';
  };
  input.addEventListener('input', upd); upd();
}
function pwIssue(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use at least one letter and one number in your password.';
  return '';
}
function onEnter(root, fn) { root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); fn(); } }); }

function forgotPasswordDialog(prefill = '') {
  const m = openModal(`
    <div class="modal-head"><h3>Reset your password</h3><button class="modal-x">✕</button></div>
    <div class="modal-body" id="fpBody"></div>`);
  const body = $('#fpBody', m);
  function step1() {
    body.innerHTML = `
      <p style="color:var(--ink-2);margin-bottom:12px">Enter your account email and we'll send a 6-digit code.</p>
      <div id="fpErr"></div>
      <div class="field"><label>Email</label><input id="fpEmail" type="email" autocomplete="email" value="${esc(prefill)}"></div>
      <button class="btn block" id="fpSend">Send code</button>`;
    const send = async () => {
      const email = $('#fpEmail', body).value.trim();
      if (!EMAIL_RE.test(email)) { $('#fpErr', body).innerHTML = '<div class="error-text">Enter a valid email address.</div>'; return; }
      const btn = $('#fpSend', body); btn.disabled = true; btn.textContent = 'Sending…';
      try { await api('/api/auth/forgot', { method: 'POST', body: { email } }); step2(email); }
      catch (e) { $('#fpErr', body).innerHTML = `<div class="error-text">${esc(e.message)}</div>`; btn.disabled = false; btn.textContent = 'Send code'; }
    };
    $('#fpSend', body).addEventListener('click', send); onEnter(body, send);
  }
  function step2(email) {
    body.innerHTML = `
      <p style="color:var(--ink-2);margin-bottom:12px">If <b>${esc(email)}</b> has an account, a code was sent. It works for 15 minutes.</p>
      <div id="fpErr"></div>
      <div class="field"><label>6-digit code</label><input id="fpCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" style="letter-spacing:6px;font-size:20px;text-align:center"></div>
      ${pwField('fpPw', 'New password', { auto: 'new-password', hint: '<div class="pw-meter" id="fpMeter"></div>' })}
      <button class="btn block" id="fpSave">Set new password</button>
      <button class="btn ghost block" id="fpBack" style="margin-top:8px">Use a different email</button>`;
    wirePw(body); wireStrength($('#fpPw', body), $('#fpMeter', body));
    $('#fpBack', body).addEventListener('click', step1);
    const save = async () => {
      const err = $('#fpErr', body);
      const code = $('#fpCode', body).value.trim(), password = $('#fpPw', body).value;
      if (!/^\d{6}$/.test(code)) { err.innerHTML = '<div class="error-text">Enter the 6-digit code.</div>'; return; }
      const issue = pwIssue(password); if (issue) { err.innerHTML = `<div class="error-text">${issue}</div>`; return; }
      const btn = $('#fpSave', body); btn.disabled = true; btn.textContent = 'Saving…';
      try {
        await api('/api/auth/reset', { method: 'POST', body: { email, code, password } });
        closeModal(); toast('Password updated — please sign in ✅');
      } catch (e) { err.innerHTML = `<div class="error-text">${esc(e.message)}</div>`; btn.disabled = false; btn.textContent = 'Set new password'; }
    };
    $('#fpSave', body).addEventListener('click', save); onEnter(body, save);
  }
  step1();
}

/* ----- Auth ----- */
function renderLogin(app, params, tab = 'login') {
  const adminLogin = params.get('as') === 'admin';
  // Customers may open an admin sign-in in a second window; it stays in that window only.
  if (state.user && !(adminLogin && state.user.role !== 'admin')) { go('#/'); return; }
  const next = params.get('next') || '';
  app.innerHTML = `
  <div class="auth-wrap">
    <div class="auth-card">
      <div style="text-align:center;margin-bottom:16px">
        <div class="logo-text" style="font-size:28px">ZUPA</div>
        <div class="sub" style="color:var(--muted);font-size:14px">Your everyday shopping destination</div>
      </div>
      ${adminLogin ? '<div class="demo-box" style="margin:0 0 14px">🛡️ <b>Admin sign-in.</b> This only signs in <b>this window</b>. Your customer session in other windows stays as it is.</div>' : ''}
      <div class="auth-tabs">
        <button id="tabLogin" class="${tab === 'login' ? 'on' : ''}">Sign in</button>
        <button id="tabReg" class="${tab === 'register' ? 'on' : ''}">Create account</button>
      </div>
      <div id="authBody"></div>
      <div class="demo-box">
        <b>Demo accounts</b><br>
        Customer: <code>demo@zupa.sl</code> / <code>demo123</code><button class="fill" id="fillCust">Use</button>
      </div>
    </div>
  </div>`;

  const body = $('#authBody', app);
  function drawLogin() {
    body.innerHTML = `
      <div id="authErr" aria-live="polite"></div>
      <div class="field"><label for="lgEmail">Email</label><input id="lgEmail" type="email" placeholder="you@example.com" autocomplete="email" autocapitalize="off"></div>
      ${pwField('lgPass', 'Password')}
      <div style="text-align:right;margin:-4px 0 12px"><button type="button" class="link-btn" id="lgForgot">Forgot password?</button></div>
      <button class="btn block lg" id="lgBtn">Sign in →</button>`;
    wirePw(body);
    $('#lgForgot', body).addEventListener('click', () => forgotPasswordDialog($('#lgEmail', body).value.trim()));
    const submit = async () => {
      const email = $('#lgEmail', body).value.trim(), password = $('#lgPass', body).value;
      const err = $('#authErr', body);
      if (!EMAIL_RE.test(email)) { err.innerHTML = '<div class="error-text">Enter a valid email address.</div>'; $('#lgEmail', body).focus(); return; }
      if (!password) { err.innerHTML = '<div class="error-text">Enter your password.</div>'; $('#lgPass', body).focus(); return; }
      const btn = $('#lgBtn', body); btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        const { user, token } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        store.saveToken(token, user.role); state.user = user; syncHeader();
        toast('Welcome back, ' + user.name.split(' ')[0] + '!');
        go(next ? '#/' + next : (user.role === 'admin' ? '#/admin' : '#/'));
      } catch (e) {
        err.innerHTML = `<div class="error-text">${esc(e.message)}</div>`;
        $('#lgPass', body).value = '';
        btn.disabled = false; btn.textContent = 'Sign in →';
      }
    };
    $('#lgBtn', body).addEventListener('click', submit); onEnter(body, submit);
  }
  function drawRegister() {
    body.innerHTML = `
      <div id="authErr" aria-live="polite"></div>
      <div class="field"><label for="rgName">Full name</label><input id="rgName" placeholder="Your name" autocomplete="name"></div>
      <div class="field"><label for="rgEmail">Email</label><input id="rgEmail" type="email" placeholder="you@example.com" autocomplete="email" autocapitalize="off"></div>
      <div class="field"><label for="rgPhone">Phone <span style="color:var(--muted);font-weight:400">(optional)</span></label><input id="rgPhone" type="tel" placeholder="+232 77 123456" autocomplete="tel"></div>
      ${pwField('rgPass', 'Password', { auto: 'new-password', hint: '<div class="pw-meter" id="rgMeter"></div>' })}
      ${pwField('rgPass2', 'Confirm password', { auto: 'new-password' })}
      <button class="btn block lg" id="rgBtn">Create account →</button>
      <p style="font-size:12.5px;color:var(--muted);text-align:center;margin-top:10px">By creating an account you agree to ZUPA's terms and privacy policy.</p>`;
    wirePw(body); wireStrength($('#rgPass', body), $('#rgMeter', body));
    const submit = async () => {
      const v = (id) => $(id, body).value.trim();
      const err = $('#authErr', body);
      const fail = (msg, id) => { err.innerHTML = `<div class="error-text">${esc(msg)}</div>`; if (id) $(id, body).focus(); };
      if (v('#rgName').length < 2) return fail('Enter your full name.', '#rgName');
      if (!EMAIL_RE.test(v('#rgEmail'))) return fail('Enter a valid email address.', '#rgEmail');
      if (v('#rgPhone') && !/^\+?[0-9 ]{8,15}$/.test(v('#rgPhone'))) return fail('Enter a valid phone number, e.g. +232 77 123456.', '#rgPhone');
      const issue = pwIssue($('#rgPass', body).value); if (issue) return fail(issue, '#rgPass');
      if ($('#rgPass', body).value !== $('#rgPass2', body).value) return fail('The two passwords do not match.', '#rgPass2');
      const btn = $('#rgBtn', body); btn.disabled = true; btn.textContent = 'Creating…';
      try {
        const { user, token } = await api('/api/auth/register', {
          method: 'POST', body: { name: v('#rgName'), email: v('#rgEmail'), phone: v('#rgPhone'), password: $('#rgPass', body).value }
        });
        store.saveToken(token, user.role); state.user = user; syncHeader();
        toast('Account created — welcome to ZUPA! 🎉');
        go(next ? '#/' + next : '#/');
      } catch (e) {
        fail(e.message);
        btn.disabled = false; btn.textContent = 'Create account →';
      }
    };
    $('#rgBtn', body).addEventListener('click', submit); onEnter(body, submit);
  }
  $('#tabLogin', app).addEventListener('click', () => { $('#tabLogin', app).classList.add('on'); $('#tabReg', app).classList.remove('on'); drawLogin(); });
  $('#tabReg', app).addEventListener('click', () => { $('#tabReg', app).classList.add('on'); $('#tabLogin', app).classList.remove('on'); drawRegister(); });
  $('#fillCust', app).addEventListener('click', () => { drawLogin(); $('#lgEmail', body).value = 'demo@zupa.sl'; $('#lgPass', body).value = 'demo123'; });
  tab === 'register' ? drawRegister() : drawLogin();
}

/* ==================== ADMIN ==================== */
function adminGate(app) {
  app.innerHTML = `
  <div class="auth-wrap">
    <div class="auth-card" style="text-align:center">
      <div style="font-size:44px;margin-bottom:8px">🔐</div>
      <h1>Admin portal</h1>
      <p class="sub">Sign in with an administrator account to manage the store.</p>
      <a class="btn block lg" href="#/login?as=admin">Sign in as admin</a>
    </div>
  </div>`;
}
const ADMIN_TABS = [
  ['dashboard', '📊', 'Dashboard'], ['products', '📦', 'Products'], ['orders', '🧾', 'Orders'],
  ['payments', '💳', 'Payments'], ['customers', '👥', 'Customers'], ['coupons', '🏷️', 'Coupons'], ['admins', '🛡️', 'Admins'], ['settings', '⚙️', 'Settings']
];
async function renderAdmin(app, tab) {
  if (!state.user || state.user.role !== 'admin') { adminGate(app); return; }
  app.innerHTML = `
  <div class="container admin-layout">
    <aside class="admin-side">
      <div class="brand">ZUPA <span>ADMIN</span></div>
      ${ADMIN_TABS.map(([t, ic, lab]) => `<button data-tab="${t}" class="${tab === t ? 'on' : ''}">${ic} ${lab}</button>`).join('')}
      <div class="divider"></div>
      <a href="#/">🏪 View storefront</a>
      <a href="#/shop">🛍️ View shop</a>
    </aside>
    <div id="adminContent"><div class="loading-page"><div class="spinner"></div><p>Loading…</p></div></div>
  </div>`;
  $$('[data-tab]', app).forEach(b => b.addEventListener('click', () => go('#/admin/' + b.dataset.tab)));
  const c = $('#adminContent', app);
  try {
    if (tab === 'dashboard') await adminDashboard(c);
    else if (tab === 'products') await adminProducts(c);
    else if (tab === 'orders') await adminOrders(c);
    else if (tab === 'payments') await adminPayments(c);
    else if (tab === 'customers') await adminCustomers(c);
    else if (tab === 'coupons') await adminCoupons(c);
    else if (tab === 'admins') await adminAdmins(c);
    else if (tab === 'settings') adminSettings(c);
    else await adminDashboard(c);
  } catch (e) {
    c.innerHTML = `<div class="error-text">${esc(e.message)}</div>`;
  }
  guardImages(c);
}

async function adminDashboard(c) {
  const s = await api('/api/admin/stats');
  const max = Math.max(...s.days.map(d => d.total), 1);
  c.innerHTML = `
    <div class="section-head"><div><h2>Dashboard</h2><p>Store performance at a glance · ${s.products} products live</p></div></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="lab">Revenue</div><div class="val">${moneyCompact(s.revenueUSD)}</div><div class="sub">≈ ${secondCurrency(s.revenueUSD)} · all confirmed payments</div></div>
      <div class="stat-card gold"><div class="lab">Orders</div><div class="val">${s.orders}</div><div class="sub">${s.openOrders} open · ${s.paidOrders} paid</div></div>
      <div class="stat-card blue"><div class="lab">Customers</div><div class="val">${s.customers}</div><div class="sub">${s.pendingPayments} payment${s.pendingPayments === 1 ? '' : 's'} awaiting verification</div></div>
      <div class="stat-card purple"><div class="lab">Low stock</div><div class="val">${s.lowStock.length}</div><div class="sub">items with ≤ 5 units</div></div>
    </div>
    <div class="panel" id="ratePanel"></div>
    <div class="panel" id="bestPanel"></div>
    <div class="admin-grid-2">
      <div class="table-wrap">
        <h3>Recent orders</h3><div class="sub">Latest activity across the store</div>
        <table class="dtable">
          <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
          <tbody>
            ${s.recent.map(o => `<tr>
              <td><a href="#/order/${esc(o.id)}"><b>#${esc(o.id)}</b></a></td>
              <td>${esc(o.address.fullName)}</td>
              <td><b>${money(o.totalUSD, o.exchangeRate)}</b></td>
              <td>${pill(o.paymentStatus)}</td>
              <td>${pill(o.status)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div>
        <div class="panel">
          <h3 style="margin-bottom:6px">Revenue · last 7 days</h3>
          <div class="chart">
            ${s.days.map(d => `
              <div class="bar">
                <div class="col" style="height:${Math.max(4, (d.total / max) * 100)}%" title="${money(d.total)}">${d.total ? `<span class="amt">${moneyCompact(d.total)}</span>` : ''}</div>
                <div class="day">${d.label}</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="panel">
          <h3 style="margin-bottom:8px">⚠️ Low stock</h3>
          ${s.lowStock.length ? s.lowStock.map(p => `
            <div class="low-stock"><span>${esc(p.name)}</span><b style="color:var(--red)">${p.stock} left</b></div>`).join('')
      : '<p style="color:var(--muted);font-size:14px">All products have healthy stock 🎉</p>'}
        </div>
      </div>
    </div>`;
  renderRatePanel($('#ratePanel', c));
  loadBestSellers($('#bestPanel', c), 0);
}

async function renderRatePanel(box) {
  const hist = await api('/api/admin/rate-history').catch(() => []);
  const last = hist[0];
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div><h3 style="margin-bottom:2px">💱 Today's exchange rate</h3>
        <div style="color:var(--muted);font-size:13px">1 US dollar = <b style="color:var(--ink)">NLe ${state.settings.exchangeRate}</b>${last ? ` · set ${fmtDate(last.at)} by ${esc(last.by)}` : ''}</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <span style="font-weight:700">$1 = NLe</span>
        <input id="rateIn" type="number" step="0.01" min="0.01" value="${state.settings.exchangeRate}" style="width:110px;padding:9px 10px;border:1.5px solid var(--line);border-radius:10px;font:inherit">
        <button class="btn sm" id="rateSave">Update rate</button>
      </div>
    </div>
    <div id="rateMsg"></div>
    ${hist.length > 1 ? `<details style="margin-top:10px"><summary style="cursor:pointer;color:var(--muted);font-size:13px">Rate history</summary>
      <div style="margin-top:6px;font-size:13px">${hist.slice(0, 8).map(h => `<div class="kv"><span>${fmtDate(h.at)} · ${esc(h.by)}</span><b>NLe ${h.rate}</b></div>`).join('')}</div></details>` : ''}`;
  $('#rateSave', box).addEventListener('click', async () => {
    try {
      state.settings = await api('/api/admin/settings', { method: 'PUT', body: { exchangeRate: $('#rateIn', box).value } });
      await refreshProducts();
      toast('Exchange rate updated ✅');
      renderRatePanel(box);
    } catch (e) { $('#rateMsg', box).innerHTML = `<div class="error-text" style="margin-top:8px">${esc(e.message)}</div>`; }
  });
}

async function loadBestSellers(box, days) {
  const r = await api('/api/admin/best-sellers?days=' + days);
  const label = { 0: 'All time', 7: 'Last 7 days', 30: 'Last 30 days' };
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
      <div><h3 style="margin-bottom:2px">🏆 Best-selling products</h3>
        <div class="sub" style="color:var(--muted);font-size:13px">Paid orders only · updated ${fmtDate(r.generatedAt)}</div></div>
      <div class="seg">${[0, 7, 30].map(d => `<button data-bd="${d}" class="${d === days ? 'on' : ''}">${label[d]}</button>`).join('')}</div>
    </div>
    ${r.items.length ? `<div class="best-list">${r.items.map((i, n) => `
      <div class="best-row ${n === 0 ? 'top' : ''}">
        <div class="rank">${n + 1}</div>
        <img src="${esc(i.image)}" alt="">
        <div class="bi"><b>${esc(i.name)}</b><span>Last sold ${fmtDate(i.lastSoldAt)}</span></div>
        <div class="bn"><b>${i.units}</b><span>sold</span></div>
        <div class="bn"><b>${money(i.revenueUSD)}</b><span>revenue</span></div>
      </div>`).join('')}</div>`
      : '<p style="color:var(--muted);font-size:14px;margin-top:12px">No paid orders in this period yet.</p>'}`;
  $$('[data-bd]', box).forEach(b => b.addEventListener('click', () => loadBestSellers(box, parseInt(b.dataset.bd, 10))));
  guardImages(box);
}

async function adminProducts(c) {
  const list = await api('/api/admin/products');
  const cats = state.settings.categories;
  c.innerHTML = `
    <div class="section-head">
      <div><h2>Products</h2><p>${list.length} products in catalogue</p></div>
      <button class="btn" id="addProd">＋ Add product</button>
    </div>
    <div class="table-wrap">
      <table class="dtable">
        <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Featured</th><th>Active</th><th>Added by</th><th>Actions</th></tr></thead>
        <tbody>
          ${list.map(p => `<tr>
            <td><div class="mini"><img src="${esc(p.image)}" alt=""><div><b>${esc(p.name)}</b><span>${esc(p.id)}</span></div></div></td>
            <td>${esc(p.category)}</td>
            <td><b>${money(p.priceUSD)}</b><br><span style="font-size:12px;color:var(--muted)">${secondCurrency(p.priceUSD)}</span></td>
            <td>${p.stock <= 5 ? `<b style="color:var(--red)">${p.stock}</b>` : p.stock}</td>
            <td><label class="switch"><input type="checkbox" data-feat="${esc(p.id)}" ${p.featured ? 'checked' : ''}><span class="slider"></span></label></td>
            <td><label class="switch"><input type="checkbox" data-act="${esc(p.id)}" ${p.active ? 'checked' : ''}><span class="slider"></span></label></td>
            <td style="font-size:13px"><b>${esc(p.createdByName || '—')}</b><br><span style="color:var(--muted);font-size:11.5px" title="Admin ID">${esc(p.createdById || '')}</span></td>
            <td><div class="actions">
              <button class="btn ghost sm" data-edit="${esc(p.id)}">Edit</button>
              <button class="btn danger sm" data-delp="${esc(p.id)}">Delete</button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  const openForm = (p) => {
    const m = openModal(`
      <div class="modal-head"><h3>${p ? 'Edit' : 'Add'} product</h3><button class="modal-x">✕</button></div>
      <div class="modal-body">
        <div id="pfErr"></div>
        <div class="field"><label>Name *</label><input id="pfName" value="${p ? esc(p.name) : ''}" placeholder="Product name"></div>
        <div class="form-row">
          <div class="field"><label>Category</label><select id="pfCat">${cats.map(x => `<option ${p && p.category === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
          <div class="field"><label>Price (NLe) *</label><input id="pfPrice" type="number" step="0.01" min="0" value="${p ? Math.round(p.priceUSD * state.settings.exchangeRate * 100) / 100 : ''}">
            <div class="hint" id="pfUsd"></div></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Stock</label><input id="pfStock" type="number" min="0" value="${p ? p.stock : 10}"></div>
          <div class="field"><label>Product image</label>
            <div class="dropzone" id="pfDrop" tabindex="0" role="button" aria-label="Upload product image">
              <img id="pfPreview" src="${esc(p ? p.image : '')}" alt="" ${p ? '' : 'hidden'}>
              <div class="dz-text" id="pfDzText"><b>Drag &amp; drop</b> an image here<br>or <u>click to choose</u> from your device<small>PNG, JPG, WEBP or GIF · max 5 MB</small></div>
              <input type="file" id="pfFile" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
            </div>
            <input type="hidden" id="pfImage" value="${p ? esc(p.image) : ''}">
          </div>
        </div>
        <div class="field"><label>Description</label><textarea id="pfDesc">${p ? esc(p.description) : ''}</textarea></div>
        <div style="display:flex;gap:18px;margin-bottom:14px">
          <label style="display:flex;gap:8px;align-items:center;font-weight:600;font-size:14px"><input type="checkbox" id="pfFeat" ${p && p.featured ? 'checked' : ''}> Featured</label>
          <label style="display:flex;gap:8px;align-items:center;font-weight:600;font-size:14px"><input type="checkbox" id="pfActive" ${!p || p.active ? 'checked' : ''}> Active (visible in store)</label>
        </div>
        <button class="btn block" id="pfSave">${p ? 'Save changes' : 'Create product'}</button>
      </div>`, 'wide');
    const showUsd = () => { const v = parseFloat($('#pfPrice', m).value); $('#pfUsd', m).textContent = v > 0 ? `≈ $${(v / state.settings.exchangeRate).toFixed(2)} at $1 = NLe ${state.settings.exchangeRate}` : ''; };
    $('#pfPrice', m).addEventListener('input', showUsd); showUsd();
    const drop = $('#pfDrop', m), file = $('#pfFile', m);
    const setImg = async (f) => {
      const err = $('#pfErr', m);
      if (!f) return;
      if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { err.innerHTML = '<div class="error-text">Please choose a PNG, JPG, WEBP or GIF image.</div>'; return; }
      if (f.size > 5 * 1024 * 1024) { err.innerHTML = '<div class="error-text">Image is too large (maximum 5 MB).</div>'; return; }
      err.innerHTML = ''; drop.classList.add('busy'); $('#pfDzText', m).innerHTML = 'Uploading…';
      try {
        const dataUrl = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
        const up = await api('/api/admin/upload', { method: 'POST', body: { dataUrl } });
        $('#pfImage', m).value = up.path;
        const pv = $('#pfPreview', m); pv.src = up.path; pv.hidden = false;
        $('#pfDzText', m).innerHTML = '<b>Image ready ✓</b><br>Drop or click to replace';
      } catch (e) {
        err.innerHTML = `<div class="error-text">${esc(e.message)}</div>`;
        $('#pfDzText', m).innerHTML = '<b>Drag &amp; drop</b> an image here<br>or <u>click to choose</u>';
      } finally { drop.classList.remove('busy'); }
    };
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    file.addEventListener('change', () => setImg(file.files[0]));
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => setImg(e.dataTransfer.files[0]));
    if (p) $('#pfDzText', m).innerHTML = 'Current image<br><u>Click or drop to replace</u>';
    $('#pfSave', m).addEventListener('click', async () => {
      if (!$('#pfImage', m).value) { $('#pfErr', m).innerHTML = '<div class="error-text">Please add a product image.</div>'; return; }
      const btn = $('#pfSave', m); btn.disabled = true; btn.textContent = 'Saving…';
      const body = {
        name: $('#pfName', m).value.trim(), category: $('#pfCat', m).value,
        priceSLE: $('#pfPrice', m).value, stock: $('#pfStock', m).value,
        image: $('#pfImage', m).value.trim(), description: $('#pfDesc', m).value,
        featured: $('#pfFeat', m).checked, active: $('#pfActive', m).checked
      };
      try {
        if (p) await api('/api/admin/products/' + p.id, { method: 'PUT', body });
        else await api('/api/admin/products', { method: 'POST', body });
        await refreshProducts();
        closeModal(); toast(p ? 'Product updated' : 'Product created');
        adminProducts(c);
      } catch (e) {
        $('#pfErr', m).innerHTML = `<div class="error-text">${esc(e.message)}</div>`;
        btn.disabled = false; btn.textContent = 'Save';
      }
    });
  };

  $('#addProd', c).addEventListener('click', () => openForm(null));
  $$('[data-edit]', c).forEach(b => b.addEventListener('click', () => openForm(list.find(p => p.id === b.dataset.edit))));
  $$('[data-feat]', c).forEach(t => t.addEventListener('change', async () => {
    try { await api('/api/admin/products/' + t.dataset.feat, { method: 'PUT', body: { featured: t.checked } }); toast('Updated'); }
    catch (e) { toast(e.message, 'err'); t.checked = !t.checked; }
  }));
  $$('[data-act]', c).forEach(t => t.addEventListener('change', async () => {
    try { await api('/api/admin/products/' + t.dataset.act, { method: 'PUT', body: { active: t.checked } }); await refreshProducts(); toast(t.checked ? 'Product is live' : 'Product hidden'); }
    catch (e) { toast(e.message, 'err'); t.checked = !t.checked; }
  }));
  $$('[data-delp]', c).forEach(b => b.addEventListener('click', () => {
    confirmDialog('Delete product?', 'The product will be removed from the store. If it appears in past orders it will be soft-deleted instead.', async () => {
      await api('/api/admin/products/' + b.dataset.delp, { method: 'DELETE' });
      await refreshProducts(); toast('Product deleted'); adminProducts(c);
    }, true);
  }));
  guardImages(c);
}

let adminOrderFilter = 'all';
async function adminOrders(c) {
  const list = await api('/api/admin/orders');
  const filtered = adminOrderFilter === 'all' ? list : list.filter(o => o.status === adminOrderFilter);
  c.innerHTML = `
    <div class="section-head"><div><h2>Orders</h2><p>Fulfilment pipeline · ${list.length} total</p></div></div>
    <div class="filter-tabs">
      ${['all', ...ORDER_FLOW, 'cancelled'].map(s => `<button data-of="${s}" class="${adminOrderFilter === s ? 'on' : ''}">${s === 'all' ? 'All' : ORDER_LABELS[s]}${s !== 'all' ? ' (' + list.filter(o => o.status === s).length + ')' : ' (' + list.length + ')'}</button>`).join('')}
    </div>
    <div class="table-wrap">
      <table class="dtable">
        <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${filtered.length ? filtered.map(o => {
    const pending = (o.payments || []).find(p => ['pending', 'submitted'].includes(p.status));
    const next = NEXT_STATUS[o.status];
    const canRecord = o.paymentStatus !== 'paid' && o.status !== 'cancelled' && o.status !== 'delivered';
    return `<tr>
              <td><b>#${esc(o.id)}</b><br><span style="font-size:12px;color:var(--muted)">${fmtDate(o.createdAt)}</span></td>
              <td>${esc(o.customerName)}<br><span style="font-size:12px;color:var(--muted)">${esc(o.customerEmail)}</span></td>
              <td>${o.items.reduce((s, i) => s + i.qty, 0)}</td>
              <td><b>${money(o.totalUSD, o.exchangeRate)}</b></td>
              <td>${pill(o.paymentStatus)}<br><span style="font-size:12px;color:var(--muted)">${METHOD[o.paymentMethod] ? METHOD[o.paymentMethod].icon + ' ' + METHOD[o.paymentMethod].label : ''}</span></td>
              <td>${pill(o.status)}</td>
              <td><div class="actions">
                ${pending ? `<button class="btn gold sm" data-verify="${esc(o.id)}">Verify payment</button>` : ''}
                ${o.status === 'shipped' ? `<button class="btn ghost sm" data-eta="${esc(o.id)}">Update estimate</button>` : ''}
                ${next && (o.paymentStatus === 'paid' || next !== 'processing') ? `<button class="btn sm" data-adv="${esc(o.id)}" data-next="${next}">${next === 'processing' ? 'Start processing' : next === 'shipped' ? 'Mark shipped' : 'Mark delivered'}</button>` : ''}
                ${canRecord ? `<button class="btn ghost sm" data-record="${esc(o.id)}">Record payment</button>` : ''}
                ${!['delivered', 'cancelled'].includes(o.status) ? `<button class="btn danger sm" data-cancel="${esc(o.id)}">Cancel</button>` : ''}
              </div></td>
            </tr>`;
  }).join('') : '<tr><td colspan="7" style="text-align:center;padding:34px;color:var(--muted)">No orders in this state.</td></tr>'}
        </tbody>
      </table>
    </div>`;

  $$('[data-of]', c).forEach(b => b.addEventListener('click', () => { adminOrderFilter = b.dataset.of; adminOrders(c); }));
  $$('[data-verify]', c).forEach(b => b.addEventListener('click', () => go('#/admin/payments')));
  const advance = async (id, status, eta) => {
    await api('/api/admin/orders/' + id, { method: 'PUT', body: { status, eta } });
    toast('Order → ' + ORDER_LABELS[status]); adminOrders(c);
  };
  const etaDialog = (title, cta, onSave, o) => {
    const dflt = /freetown/i.test((o.address && o.address.city) || '') ? '1d' : '2-3d';
    const m = openModal(`
      <div class="modal-head"><h3>${title} · #${esc(o.id)}</h3><button class="modal-x">✕</button></div>
      <div class="modal-body">
        <p style="color:var(--ink-2);margin-bottom:12px">When should <b>${esc(o.address.fullName)}</b> expect the package in ${esc(o.address.city || 'their area')}? The customer sees this on their order.</p>
        <div id="etaErr"></div>
        <div class="field"><label>Estimated delivery time</label>
          <select id="etaSel">${ETA_OPTIONS.map(([k, l]) => `<option value="${k}" ${k === dflt ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <button class="btn block" id="etaGo">${cta}</button>
      </div>`);
    $('#etaGo', m).addEventListener('click', async () => {
      try { await onSave($('#etaSel', m).value); closeModal(); } catch (e) { $('#etaErr', m).innerHTML = `<div class="error-text">${esc(e.message)}</div>`; }
    });
  };
  $$('[data-adv]', c).forEach(b => b.addEventListener('click', async () => {
    const o = list.find(x => x.id === b.dataset.adv);
    if (b.dataset.next === 'shipped') {
      etaDialog('Mark as shipped', 'Mark shipped & send estimate', (preset) => advance(o.id, 'shipped', { preset }), o);
      return;
    }
    b.disabled = true;
    try { await advance(b.dataset.adv, b.dataset.next); }
    catch (e) { toast(e.message, 'err'); b.disabled = false; }
  }));
  $$('[data-eta]', c).forEach(b => b.addEventListener('click', () => {
    const o = list.find(x => x.id === b.dataset.eta);
    etaDialog('Update delivery estimate', 'Update estimate', async (preset) => { await api('/api/admin/orders/' + o.id + '/eta', { method: 'PUT', body: { preset } }); toast('Estimate updated'); adminOrders(c); }, o);
  }));
  $$('[data-record]', c).forEach(b => b.addEventListener('click', () => {
    const o = list.find(x => x.id === b.dataset.record);
    const m = openModal(`
      <div class="modal-head"><h3>Record payment · #${esc(o.id)}</h3><button class="modal-x">✕</button></div>
      <div class="modal-body">
        <p style="font-size:14px;color:var(--muted);margin-bottom:14px">Use this for cash collected, POS charges or bank transfers received — the <b>admin-side</b> payment flow.</p>
        <div id="rpErr"></div>
        <div class="field"><label>Amount (USD)</label><input id="rpAmt" type="number" step="0.01" value="${o.totalUSD}"></div>
        <div class="field"><label>Method</label><select id="rpMethod"><option value="cod">Cash on delivery</option><option value="bank">Bank transfer</option><option value="momo">Mobile money</option><option value="manual">POS / other</option></select></div>
        <div class="field"><label>Note</label><input id="rpNote" placeholder="e.g. Cash collected by rider"></div>
        <button class="btn block" id="rpSave">Record payment</button>
      </div>`);
    $('#rpSave', m).addEventListener('click', async () => {
      const btn = $('#rpSave', m); btn.disabled = true; btn.textContent = 'Saving…';
      try {
        await api('/api/admin/payments', { method: 'POST', body: { orderId: o.id, amountUSD: $('#rpAmt', m).value, method: $('#rpMethod', m).value, note: $('#rpNote', m).value } });
        closeModal(); toast('Payment recorded & order marked paid ✅'); adminOrders(c);
      } catch (e) { $('#rpErr', m).innerHTML = `<div class="error-text">${esc(e.message)}</div>`; btn.disabled = false; btn.textContent = 'Record payment'; }
    });
  }));
  $$('[data-cancel]', c).forEach(b => b.addEventListener('click', () => {
    confirmDialog('Cancel order?', 'Stock will be returned to inventory.', async () => {
      await api('/api/admin/orders/' + b.dataset.cancel, { method: 'PUT', body: { status: 'cancelled' } });
      await refreshProducts(); toast('Order cancelled'); adminOrders(c);
    }, true);
  }));
  guardImages(c);
}

let adminPayFilter = 'open';
async function adminPayments(c) {
  const list = await api('/api/admin/payments');
  const filtered = list.filter(p =>
    adminPayFilter === 'all' ? true :
      adminPayFilter === 'open' ? ['pending', 'submitted'].includes(p.status) : p.status === adminPayFilter);
  c.innerHTML = `
    <div class="section-head"><div><h2>Payments</h2><p>Both flows in one ledger — client-side gateway payments & admin-side verifications</p></div></div>
    <div class="filter-tabs">
      ${[['open', 'Needs action'], ['completed', 'Completed'], ['failed', 'Failed'], ['all', 'All']].map(([k, l]) =>
    `<button data-pf="${k}" class="${adminPayFilter === k ? 'on' : ''}">${l} (${k === 'open' ? list.filter(p => ['pending', 'submitted'].includes(p.status)).length : k === 'all' ? list.length : list.filter(p => p.status === k).length})</button>`).join('')}
    </div>
    <div class="table-wrap">
      <table class="dtable">
        <thead><tr><th>Payment</th><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Side</th><th>Status</th><th>Reference / note</th><th>Actions</th></tr></thead>
        <tbody>
          ${filtered.length ? filtered.map(p => `<tr>
            <td><b>${esc(p.id)}</b><br><span style="font-size:12px;color:var(--muted)">${fmtDate(p.createdAt)}</span></td>
            <td><a href="#/order/${esc(p.orderId)}">#${esc(p.orderId)}</a><br><span style="font-size:12px;color:var(--muted)">${money(p.orderTotalUSD)}</span></td>
            <td>${esc(p.customerName)}</td>
            <td>${METHOD[p.method] ? METHOD[p.method].icon + ' ' + METHOD[p.method].label : esc(p.method)}</td>
            <td><b>${money(p.amountUSD)}</b></td>
            <td>${pill(p.side)}</td>
            <td>${pill(p.status)}</td>
            <td style="max-width:230px"><span style="font-size:12.5px;color:var(--muted)">${esc(p.reference || '—')}${p.note ? '<br>' + esc(p.note) : ''}</span></td>
            <td><div class="actions">
              ${['pending', 'submitted'].includes(p.status) ? `
                <button class="btn sm" data-ok="${esc(p.id)}">✓ Complete</button>
                <button class="btn danger sm" data-no="${esc(p.id)}">✗ Reject</button>` : '<span style="font-size:12.5px;color:var(--muted)">—</span>'}
            </div></td>
          </tr>`).join('') : '<tr><td colspan="9" style="text-align:center;padding:34px;color:var(--muted)">Nothing here 🎉</td></tr>'}
        </tbody>
      </table>
    </div>`;

  $$('[data-pf]', c).forEach(b => b.addEventListener('click', () => { adminPayFilter = b.dataset.pf; adminPayments(c); }));
  $$('[data-ok]', c).forEach(b => b.addEventListener('click', () => {
    confirmDialog('Complete this payment?', 'The order will be marked as paid and move forward in the pipeline.', async () => {
      await api('/api/admin/payments/' + b.dataset.ok, { method: 'POST', body: { action: 'complete', note: 'Verified by admin — ZUPA' } });
      toast('Payment completed ✅'); adminPayments(c);
    });
  }));
  $$('[data-no]', c).forEach(b => b.addEventListener('click', () => {
    confirmDialog('Reject this payment?', 'The payment will be marked failed and the customer notified on the order page.', async () => {
      await api('/api/admin/payments/' + b.dataset.no, { method: 'POST', body: { action: 'fail', note: 'Rejected by admin — could not verify' } });
      toast('Payment rejected', 'warn'); adminPayments(c);
    }, true);
  }));
  guardImages(c);
}

async function adminCustomers(c) {
  const list = await api('/api/admin/users');
  c.innerHTML = `
    <div class="section-head"><div><h2>Customers & users</h2><p>${list.length} registered accounts</p></div></div>
    <div class="table-wrap">
      <table class="dtable">
        <thead><tr><th>Name</th><th>Contact</th><th>Role</th><th>Orders</th><th>Total spend</th><th>Joined</th></tr></thead>
        <tbody>
          ${list.map(u => `<tr>
            <td><b>${esc(u.name)}</b></td>
            <td>${esc(u.email)}<br><span style="font-size:12px;color:var(--muted)">${esc(u.phone || '—')}</span></td>
            <td>${u.role === 'admin' ? '<span class="tag gold">Admin</span>' : '<span class="tag">Customer</span>'}</td>
            <td>${u.orders}</td>
            <td><b>${money(u.spendUSD)}</b></td>
            <td>${fmtDay(u.createdAt)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function adminAdmins(c) {
  const list = await api('/api/admin/admins');
  const owner = state.user.adminRole === 'owner';
  const audit = owner ? await api('/api/admin/audit') : [];
  c.innerHTML = `
    <div class="section-head"><div><h2>Admins</h2><p>Every admin signs in with their own credentials; each product records who added it.</p></div>
      ${owner ? '<button class="btn" id="addAdmin">＋ Add admin</button>' : ''}</div>
    <div class="table-wrap"><table class="dtable">
      <thead><tr><th>Admin</th><th>Admin ID</th><th>Role</th><th>Products added</th><th>Status</th>${owner ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>${list.map(a => `<tr>
        <td><b>${esc(a.name)}</b><br><span style="font-size:12px;color:var(--muted)">${esc(a.email)}</span></td>
        <td style="font-size:12.5px">${esc(a.id)}</td>
        <td>${a.adminRole === 'owner' ? '<span class="tag gold">Owner</span>' : '<span class="tag">Admin</span>'}</td>
        <td>${a.products}</td>
        <td>${a.active ? '<span class="tag">Active</span>' : '<span class="tag" style="background:#fdecec;color:var(--red)">Deactivated</span>'}</td>
        ${owner ? `<td><div class="actions">${a.adminRole === 'owner' ? '' : `
          <button class="btn ghost sm" data-reset="${esc(a.id)}">Reset password</button>
          <button class="btn ${a.active ? 'danger' : 'ghost'} sm" data-toggle="${esc(a.id)}" data-active="${a.active ? 1 : 0}">${a.active ? 'Deactivate' : 'Reactivate'}</button>`}</div></td>` : ''}
      </tr>`).join('')}</tbody></table></div>
    ${owner ? `<div class="table-wrap" style="margin-top:18px"><h3>Recent admin activity</h3>
      <table class="dtable"><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Item</th></tr></thead><tbody>
      ${audit.slice(0, 30).map(a => `<tr><td>${fmtDate(a.at)}</td><td>${esc(a.adminName)}</td><td>${esc(a.action)}</td><td>${esc(a.target)}</td></tr>`).join('') || '<tr><td colspan="4" style="color:var(--muted)">No activity yet.</td></tr>'}
      </tbody></table></div>` : '<p style="color:var(--muted);margin-top:14px;font-size:14px">Only the store owner can add or deactivate admins.</p>'}`;
  if (!owner) return;
  $('#addAdmin', c).addEventListener('click', () => {
    const m = openModal(`
      <div class="modal-head"><h3>Add admin</h3><button class="modal-x">✕</button></div>
      <div class="modal-body"><div id="aaErr"></div>
        <div class="field"><label>Full name *</label><input id="aaName"></div>
        <div class="field"><label>Email *</label><input id="aaEmail" type="email"></div>
        <div class="field"><label>Temporary password *</label><input id="aaPw" type="text" autocomplete="off"><div class="hint">At least 8 characters. Share it privately; they can change it after signing in.</div></div>
        <button class="btn block" id="aaSave">Create admin</button>
      </div>`);
    $('#aaSave', m).addEventListener('click', async () => {
      try {
        await api('/api/admin/admins', { method: 'POST', body: { name: $('#aaName', m).value, email: $('#aaEmail', m).value, password: $('#aaPw', m).value } });
        closeModal(); toast('Admin created ✅'); adminAdmins(c);
      } catch (e) { $('#aaErr', m).innerHTML = `<div class="error-text">${esc(e.message)}</div>`; }
    });
  });
  $$('[data-toggle]', c).forEach(b => b.addEventListener('click', () => {
    const on = b.dataset.active === '1';
    confirmDialog(on ? 'Deactivate this admin?' : 'Reactivate this admin?', on ? 'They will be signed out and unable to sign in. Products they added stay in the store.' : 'They will be able to sign in again.', async () => {
      await api('/api/admin/admins/' + b.dataset.toggle, { method: 'PUT', body: { active: !on } });
      toast(on ? 'Admin deactivated' : 'Admin reactivated'); adminAdmins(c);
    }, on);
  }));
  $$('[data-reset]', c).forEach(b => b.addEventListener('click', () => {
    const m = openModal(`
      <div class="modal-head"><h3>Reset password</h3><button class="modal-x">✕</button></div>
      <div class="modal-body"><div id="rpErr"></div>
        <div class="field"><label>New temporary password</label><input id="rpPw" type="text" autocomplete="off"><div class="hint">They will be signed out everywhere.</div></div>
        <button class="btn block" id="rpSave">Reset password</button></div>`);
    $('#rpSave', m).addEventListener('click', async () => {
      try { await api('/api/admin/admins/' + b.dataset.reset, { method: 'PUT', body: { password: $('#rpPw', m).value } }); closeModal(); toast('Password reset'); }
      catch (e) { $('#rpErr', m).innerHTML = `<div class="error-text">${esc(e.message)}</div>`; }
    });
  }));
}

async function adminCoupons(c) {
  const list = await api('/api/admin/coupons');
  c.innerHTML = `
    <div class="section-head"><div><h2>Coupons</h2><p>Discount codes customers can apply at checkout</p></div></div>
    <div class="admin-grid-2">
      <div class="table-wrap">
        <table class="dtable">
          <thead><tr><th>Code</th><th>Discount</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>
            ${list.map(cp => `<tr>
              <td><b style="font-size:15.5px;letter-spacing:1px">${esc(cp.code)}</b></td>
              <td><b>−${cp.percent}%</b></td>
              <td>${cp.active ? '<span class="pill completed">active</span>' : '<span class="pill cancelled">inactive</span>'}</td>
              <td>${fmtDay(cp.createdAt)}</td>
              <td>${cp.active ? `<button class="btn danger sm" data-dc="${esc(cp.code)}">Deactivate</button>` : ''}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="panel">
        <h3>Create coupon</h3>
        <div id="cpErr"></div>
        <div class="field"><label>Code</label><input id="cpCode" placeholder="E.g. FREETOWN10" style="text-transform:uppercase"></div>
        <div class="field"><label>Discount percent</label><input id="cpPct" type="number" min="1" max="90" value="10"></div>
        <button class="btn block" id="cpAdd">Create coupon</button>
      </div>
    </div>`;
  $('#cpAdd', c).addEventListener('click', async () => {
    const btn = $('#cpAdd', c); btn.disabled = true; btn.textContent = 'Creating…';
    try {
      await api('/api/admin/coupons', { method: 'POST', body: { code: $('#cpCode', c).value, percent: $('#cpPct', c).value } });
      toast('Coupon created'); adminCoupons(c);
    } catch (e) { $('#cpErr', c).innerHTML = `<div class="error-text">${esc(e.message)}</div>`; btn.disabled = false; btn.textContent = 'Create coupon'; }
  });
  $$('[data-dc]', c).forEach(b => b.addEventListener('click', () => {
    confirmDialog('Deactivate coupon?', 'Customers will no longer be able to use ' + b.dataset.dc + '.', async () => {
      await api('/api/admin/coupons/' + b.dataset.dc, { method: 'DELETE' });
      toast('Coupon deactivated'); adminCoupons(c);
    }, true);
  }));
}

function adminSettings(c) {
  const s = state.settings;
  c.innerHTML = `
    <div class="section-head"><div><h2>Store settings</h2><p>Currency, delivery and merchandising configuration</p></div></div>
    <div class="admin-grid-2">
      <div class="panel">
        <h3>General</h3>
        <div class="field"><label>Store name</label><input id="stName" value="${esc(s.storeName)}"></div>
        <div class="form-row">
          <div class="field"><label>Exchange rate (NLe per $1)</label><input id="stRate" type="number" step="0.01" min="0.01" value="${s.exchangeRate}">
            <div class="hint">Update this whenever the dollar moves. NLe prices stay the same; dollar amounts follow this rate. Past orders keep the rate they were placed at.</div></div>
          <div class="field"><label>Shipping fee (NLe)</label><input id="stShip" type="number" step="0.01" min="0" value="${s.shippingFeeSLE}"></div>
        </div>
        <div class="field"><label>Free shipping over (NLe)</label><input id="stFree" type="number" step="0.01" min="0" value="${s.freeShippingOverSLE}"></div>
        <div class="field"><label>Categories (comma separated)</label><input id="stCats" value="${esc(s.categories.join(', '))}"></div>
        <button class="btn" id="stSave">Save settings</button>
        <div id="stMsg"></div>
      </div>
      <div class="panel">
        <h3>Currency preview</h3>
        <div class="kv"><span>Exchange rate</span><b>$1 = NLe ${s.exchangeRate}</b></div>
        <div class="kv"><span>$10.00 shows as</span><b>NLe ${(10 * s.exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2 })}</b></div>
        <div class="kv"><span>NLe 235.00 shows as</span><b>$${(235 / s.exchangeRate).toFixed(2)}</b></div>
        <div class="kv"><span>Current customer view</span><b>${store.currency === 'SLE' ? 'NLe' : 'Dollars ($)'}</b></div>
        <p style="font-size:13.5px;color:var(--muted);margin-top:10px">Customers toggle NLe/$ with the button in the header — both sides of the store always show the same value.</p>
        <div class="divider" style="border-top:1px solid var(--line);margin:16px 0"></div>
        <h3>Payment flows</h3>
        <p style="font-size:13.5px;color:var(--muted);line-height:1.7">
          <b style="color:var(--ink)">1 · Client side</b> — card & mobile money via the ZUPA Pay gateway; bank transfers submit a reference.<br>
          <b style="color:var(--ink)">2 · Admin side</b> — verify bank transfers, reject bad payments, record cash/POS receipts against any order.
        </p>
      </div>
    </div>`;
  $('#stSave', c).addEventListener('click', async () => {
    const btn = $('#stSave', c); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const updated = await api('/api/admin/settings', {
        method: 'PUT',
        body: {
          storeName: $('#stName', c).value, exchangeRate: $('#stRate', c).value,
          shippingFeeSLE: $('#stShip', c).value, freeShippingOverSLE: $('#stFree', c).value,
          categories: $('#stCats', c).value.split(',').map(x => x.trim()).filter(Boolean)
        }
      });
      state.settings = updated;
      await refreshProducts();
      $('#stMsg', c).innerHTML = '<div class="ok-text" style="margin-top:12px">Settings saved — storefront prices updated live.</div>';
      toast('Settings saved');
      btn.disabled = false; btn.textContent = 'Save settings';
    } catch (e) {
      $('#stMsg', c).innerHTML = `<div class="error-text" style="margin-top:12px">${esc(e.message)}</div>`;
      btn.disabled = false; btn.textContent = 'Save settings';
    }
  });
}

/* ==================== ROUTER ==================== */
async function route() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [pathPart, qs] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const params = new URLSearchParams(qs || '');
  const root = parts[0] || 'home';

  $$('#mainNav a').forEach(a => a.classList.toggle('active', a.dataset.nav === root || (root === 'home' && a.dataset.nav === '')));

  const app = $('#app');
  if (isAdmin() && ['cart', 'checkout', 'orders', 'wishlist'].includes(root)) { go('#/admin'); return; }
  try {
    if (root === 'home') await renderHome(app);
    else if (root === 'shop') await renderShop(app, params);
    else if (root === 'product') await renderProduct(app, parts[1]);
    else if (root === 'cart') renderCart(app);
    else if (root === 'checkout') await renderCheckout(app);
    else if (root === 'order') await renderOrder(app, parts[1]);
    else if (root === 'orders') await renderOrders(app);
    else if (root === 'wishlist') await renderWishlist(app);
    else if (root === 'login') renderLogin(app, params, 'login');
    else if (root === 'register') renderLogin(app, params, 'register');
    else if (root === 'admin') await renderAdmin(app, parts[1] || 'dashboard');
    else {
      app.innerHTML = `<div class="container page"><div class="empty-state"><div class="big">🧭</div><h3>Page not found</h3><p>The page you're looking for doesn't exist.</p><a class="btn" href="#/">Back home</a></div></div>`;
    }
  } catch (e) {
    app.innerHTML = `<div class="container page"><div class="empty-state"><div class="big">⚠️</div><h3>Something went wrong</h3><p>${esc(e.message)}</p><a class="btn" href="#/">Back home</a></div></div>`;
  }
  guardImages(app);
}

/* ==================== GLOBAL EVENTS + BOOT ==================== */
function changePasswordDialog() {
  const m = openModal(`
    <div class="modal-head"><h3>Change password</h3><button class="modal-x">✕</button></div>
    <div class="modal-body">
      <div id="cpErr"></div>
      ${pwField('cpCur', 'Current password')}
      ${pwField('cpNew', 'New password', { auto: 'new-password', hint: '<div class="pw-meter" id="cpMeter"></div>' })}
      <p style="font-size:12.5px;color:var(--muted);margin:-4px 0 12px">Other devices will be signed out.</p>
      <button class="btn block" id="cpSave">Update password</button>
    </div>`);
  wirePw(m); wireStrength($('#cpNew', m), $('#cpMeter', m));
  const save = async () => {
    const issue = pwIssue($('#cpNew', m).value);
    if (issue) { $('#cpErr', m).innerHTML = `<div class="error-text">${issue}</div>`; return; }
    try {
      await api('/api/auth/change-password', { method: 'POST', body: { current: $('#cpCur', m).value, next: $('#cpNew', m).value } });
      closeModal(); toast('Password updated ✅');
    } catch (e) { $('#cpErr', m).innerHTML = `<div class="error-text">${esc(e.message)}</div>`; }
  };
  $('#cpSave', m).addEventListener('click', save); onEnter(m, save);
}
function editProfileDialog() {
  const u = state.user;
  const m = openModal(`
    <div class="modal-head"><h3>Edit profile</h3><button class="modal-x">✕</button></div>
    <div class="modal-body">
      <div id="epErr"></div>
      <div class="field"><label>Full name</label><input id="epName" value="${esc(u.name)}" autocomplete="name"></div>
      <div class="field"><label>Email</label><input value="${esc(u.email)}" disabled><div class="hint">Email cannot be changed.</div></div>
      <div class="field"><label>Phone</label><input id="epPhone" type="tel" value="${esc(u.phone || '')}" autocomplete="tel"></div>
      <div class="field"><label>City</label><input id="epCity" value="${esc(u.city || '')}"></div>
      <button class="btn block" id="epSave">Save changes</button>
    </div>`);
  $('#epSave', m).addEventListener('click', async () => {
    try {
      const { user } = await api('/api/auth/profile', { method: 'PUT', body: { name: $('#epName', m).value, phone: $('#epPhone', m).value, city: $('#epCity', m).value } });
      state.user = user; syncHeader(); closeModal(); toast('Profile updated ✅');
    } catch (e) { $('#epErr', m).innerHTML = `<div class="error-text">${esc(e.message)}</div>`; }
  });
}
function deleteAccountDialog() {
  const m = openModal(`
    <div class="modal-head"><h3>Delete account</h3><button class="modal-x">✕</button></div>
    <div class="modal-body">
      <p style="color:var(--ink-2);margin-bottom:12px">This permanently removes your profile and sign-in. Past orders are kept by the store for its records without your personal details. This cannot be undone.</p>
      <div id="daErr"></div>
      ${pwField('daPw', 'Enter your password to confirm')}
      <button class="btn danger block" id="daGo">Delete my account</button>
    </div>`);
  wirePw(m);
  $('#daGo', m).addEventListener('click', async () => {
    try {
      await api('/api/auth/account', { method: 'DELETE', body: { password: $('#daPw', m).value } });
      try { if (sessionStorage.getItem('lm_token')) sessionStorage.removeItem('lm_token'); else localStorage.removeItem('lm_token'); } catch { /* ignore */ }
    state.user = null; syncHeader(); closeModal(); toast('Your account has been deleted'); go('#/');
    } catch (e) { $('#daErr', m).innerHTML = `<div class="error-text">${esc(e.message)}</div>`; }
  });
}
function accountMenu() {
  if (!state.user) { go('#/login'); return; }
  const u = state.user;
  const m = openModal(`
    <div class="modal-head"><h3>My account</h3><button class="modal-x">✕</button></div>
    <div class="modal-body">
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:18px">
        <div style="width:54px;height:54px;border-radius:50%;background:var(--brand-l);color:var(--brand-d);font-weight:800;font-size:22px;display:flex;align-items:center;justify-content:center">${esc(u.name[0].toUpperCase())}</div>
        <div><b style="font-size:16.5px">${esc(u.name)}</b><div style="font-size:13.5px;color:var(--muted)">${esc(u.email)}</div>
        <div>${u.role === 'admin' ? '<span class="tag gold">Administrator</span>' : '<span class="tag">Customer</span>'}</div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:9px">
        ${u.role === 'admin' ? '<a class="btn ghost block" href="#/admin" id="admin">📊 Admin dashboard</a>' : `<a class="btn ghost block" href="#/orders" id="amOrders">📦 My orders</a>
        <a class="btn ghost block" href="#/wishlist" id="amWish">♥ Wishlist</a>`}
        <button class="btn ghost block" id="amEdit">✏️ Edit profile</button>
        <button class="btn ghost block" id="amPw">🔑 Change password</button>
        <button class="btn ghost block" id="amAll">🔒 Sign out of all other devices</button>
        <button class="btn danger block" id="amOut">Sign out</button>
        ${u.role === 'admin' ? '' : '<button class="link-btn" id="amDel" style="margin-top:4px;color:var(--red)">Delete my account</button>'}
      </div>
    </div>`);
  $$('.modal a', m).forEach(a => a.addEventListener('click', () => m.remove()));
  $('#amPw', m).addEventListener('click', () => { m.remove(); changePasswordDialog(); });
  $('#amEdit', m).addEventListener('click', () => { m.remove(); editProfileDialog(); });
  $('#amAll', m).addEventListener('click', async () => { try { await api('/api/auth/logout-all', { method: 'POST' }); toast('Signed out of all other devices ✅'); } catch (e) { toast(e.message, 'warn'); } });
  if ($('#amDel', m)) $('#amDel', m).addEventListener('click', () => { m.remove(); deleteAccountDialog(); });
  $('#amOut', m).addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    try { if (sessionStorage.getItem('lm_token')) sessionStorage.removeItem('lm_token'); else localStorage.removeItem('lm_token'); } catch { /* ignore */ }
    state.user = null; syncHeader(); closeModal();
    toast('Signed out');
    go('#/');
  });
}

window.addEventListener('hashchange', route);
async function boot() {
  $('#year').textContent = new Date().getFullYear();

  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    shopState.q = $('#searchInput').value.trim();
    shopState.category = '';
    go(shopHash());
  });
  $('#currencyBtn').addEventListener('click', () => {
    store.currency = store.currency === 'USD' ? 'SLE' : 'USD';
    syncHeader();
    toast(store.currency === 'SLE' ? 'Prices now in NLe' : 'Prices now in Dollars ($)');
    route();
  });
  $('#hamburgerBtn').addEventListener('click', () => $('#mainNav').classList.toggle('open'));
  $('#userBtn').addEventListener('click', accountMenu);
  $('#mainNav').addEventListener('click', () => $('#mainNav').classList.remove('open'));

  if (!location.hash) location.hash = '#/';
  try {
    const st = await api('/api/settings');
    state.settings = st;
  } catch { /* defaults */ }
  try {
    const { user } = await api('/api/auth/me');
    state.user = user;
  } catch { state.user = null; }
  await refreshProducts();
  syncHeader();
  await route();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
