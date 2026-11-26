import { DEFAULT_API_URL } from './config';

// Mutable module state, kept in sync by AppContext
let baseUrl = DEFAULT_API_URL;
let token = '';
let onUnauthorized = null;

export const setBaseUrl = (u) => { baseUrl = (u || DEFAULT_API_URL).replace(/\/+$/, ''); };
export const getBaseUrl = () => baseUrl;
export const setToken = (t) => { token = t || ''; };
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

/** Turn a stored relative path ("images/coffee.png") into a full URL. */
export const imageUrl = (p) => {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  return baseUrl + '/' + String(p).replace(/^\/+/, '');
};

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = 'Bearer ' + token;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res;
  try {
    res = await fetch(baseUrl + path, {
      method, headers, signal: ctrl.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    throw new Error(
      e.name === 'AbortError'
        ? 'The server took too long to respond.'
        : `Can't reach the store server at ${baseUrl}. Check your connection or server address.`
    );
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
