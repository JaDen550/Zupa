const fix2 = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

// All helpers take the display currency ('USD' | 'SLE') and exchange rate explicitly.
export function money(usd, currency, rate = 23.5) {
  const n = Number(usd) || 0;
  if (currency === 'SLE') return 'NLe ' + (n * rate).toLocaleString('en-US', fix2);
  return '$' + n.toLocaleString('en-US', fix2);
}
export function moneyCompact(usd, currency, rate = 23.5) {
  const n = Number(usd) || 0;
  if (currency === 'SLE') {
    const v = n * rate;
    return v >= 1000 ? 'NLe ' + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : 'NLe ' + Math.round(v);
  }
  return n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + Math.round(n);
}
export function secondCurrency(usd, currency, rate = 23.5) {
  const n = Number(usd) || 0;
  return currency === 'SLE'
    ? '$' + n.toLocaleString('en-US', fix2)
    : 'NLe ' + (n * rate).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');
export function fmtDay(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtDate(iso) {
  const d = new Date(iso);
  return `${fmtDay(iso)}, ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
export const stars = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
