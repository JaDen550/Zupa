import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { api, setBaseUrl, setToken, setUnauthorizedHandler } from '../lib/api';
import { DEFAULT_API_URL } from '../lib/config';
import { getJSON, getToken, setJSON, setTokenStored } from '../lib/storage';
import { money, moneyCompact, secondCurrency } from '../lib/format';
import { C, R } from '../lib/theme';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const DEFAULT_SETTINGS = {
  storeName: 'ZUPA', exchangeRate: 23.5, shippingFeeUSD: 7.5, freeShippingOverUSD: 75, categories: []
};

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [currency, setCurrencyState] = useState('USD');
  const [cart, setCartState] = useState([]); // [{productId, size?, qty}]
  const [wishlist, setWishlistState] = useState([]);
  const [serverUrl, setServerUrlState] = useState(DEFAULT_API_URL);
  const [toastMsg, setToastMsg] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    Animated.timing(toastAnim, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }, 1800);
  }, [toastAnim]);

  const refreshSettings = useCallback(async () => {
    try { setSettings(await api('/api/settings', { auth: false })); } catch { /* offline: keep last */ }
  }, []);

  const signOutLocal = useCallback(async () => {
    setToken(''); setUser(null);
    await setTokenStored('');
  }, []);

  // ---- boot: restore everything from storage ----
  useEffect(() => {
    (async () => {
      const [url, cur, cartS, wish, tok, cachedSettings] = await Promise.all([
        getJSON('lm_server', DEFAULT_API_URL), getJSON('lm_currency', 'USD'),
        getJSON('lm_cart', []), getJSON('lm_wishlist', []), getToken(), getJSON('lm_settings', null)
      ]);
      setBaseUrl(url); setServerUrlState(url);
      setCurrencyState(cur); setCartState(cartS); setWishlistState(wish);
      if (cachedSettings) setSettings(cachedSettings);
      setUnauthorizedHandler(signOutLocal);
      if (tok) {
        setToken(tok);
        try { const r = await api('/api/auth/me'); setUser(r.user); } catch (e) { if (e.status === 401) await signOutLocal(); }
      }
      await refreshSettings();
      setReady(true);
    })();
  }, [refreshSettings, signOutLocal]);

  useEffect(() => { if (ready) setJSON('lm_settings', settings); }, [settings, ready]);

  // ---- auth ----
  const finishAuth = async ({ user: u, token }) => {
    setToken(token); await setTokenStored(token); setUser(u);
    return u;
  };
  const login = async (email, password) =>
    finishAuth(await api('/api/auth/login', { method: 'POST', body: { email, password }, auth: false }));
  const register = async (fields) =>
    finishAuth(await api('/api/auth/register', { method: 'POST', body: fields, auth: false }));
  const logout = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    await signOutLocal();
  };

  // ---- prefs ----
  const setCurrency = (c) => { setCurrencyState(c); setJSON('lm_currency', c); };
  const setServerUrl = async (u) => {
    const clean = (u || DEFAULT_API_URL).trim().replace(/\/+$/, '');
    setBaseUrl(clean); setServerUrlState(clean); await setJSON('lm_server', clean);
    await refreshSettings();
  };

  // ---- cart ----
  const saveCart = (c) => { setCartState(c); setJSON('lm_cart', c); };
  // a cart line is a product + (optional) size, e.g. the same T-shirt in M and in L are two lines
  const same = (i, productId, size) => i.productId === productId && (i.size || '') === (size || '');
  const addToCart = (productId, qty = 1, size = '') => {
    const found = cart.find((i) => same(i, productId, size));
    saveCart(found
      ? cart.map((i) => (same(i, productId, size) ? { ...i, qty: i.qty + qty } : i))
      : [...cart, size ? { productId, size, qty } : { productId, qty }]);
    toast('Added to cart');
  };
  const setQty = (productId, qty, size = '') =>
    saveCart(qty < 1 ? cart.filter((i) => !same(i, productId, size))
      : cart.map((i) => (same(i, productId, size) ? { ...i, qty } : i)));
  const removeFromCart = (productId, size = '') => saveCart(cart.filter((i) => !same(i, productId, size)));
  const clearCart = () => saveCart([]);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // ---- wishlist ----
  const toggleWish = (id) => {
    const on = wishlist.includes(id);
    const next = on ? wishlist.filter((x) => x !== id) : [...wishlist, id];
    setWishlistState(next); setJSON('lm_wishlist', next);
    toast(on ? 'Removed from wishlist' : 'Saved to wishlist ♥');
  };

  // ---- money, bound to current currency/rate ----
  const rate = settings.exchangeRate || 23.5;
  const fmt = useCallback((usd, frozenRate) => money(usd, currency, frozenRate || rate), [currency, rate]);
  const fmtCompact = useCallback((usd) => moneyCompact(usd, currency, rate), [currency, rate]);
  const fmt2 = useCallback((usd) => secondCurrency(usd, currency, rate), [currency, rate]);

  const value = useMemo(() => ({
    ready, user, setUser, settings, refreshSettings, currency, setCurrency, serverUrl, setServerUrl,
    login, register, logout, cart, addToCart, setQty, removeFromCart, clearCart, cartCount,
    wishlist, toggleWish, fmt, fmtCompact, fmt2, toast, isAdmin: user?.role === 'admin'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ready, user, settings, currency, serverUrl, cart, wishlist, fmt, fmtCompact, fmt2]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', bottom: 96, alignSelf: 'center', opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }]
        }}>
        <View style={{ backgroundColor: C.ink, borderRadius: R.l, paddingHorizontal: 18, paddingVertical: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>{toastMsg}</Text>
        </View>
      </Animated.View>
    </Ctx.Provider>
  );
}
