/**
 * Money helpers. All amounts in the database and in server code are INTEGER MINOR
 * UNITS (NLe 12.50 = 1250). Convert to a display string only at the very edge (UI).
 */

export type CurrencyInfo = { code: string; symbol: string; exponent: number };

// Mirrors the `currencies` table. Add a row there and here to support another currency.
export const CURRENCIES: Record<string, CurrencyInfo> = {
  SLE: { code: "SLE", symbol: "NLe", exponent: 2 },
  USD: { code: "USD", symbol: "$", exponent: 2 },
};

export const BASE_CURRENCY = "SLE";

export function formatMoney(minor: number, currencyCode: string = BASE_CURRENCY): string {
  const c = CURRENCIES[currencyCode];
  if (!c) throw new Error(`Unknown currency: ${currencyCode}`);
  const value = minor / 10 ** c.exponent;
  const digits = value.toLocaleString("en-US", {
    minimumFractionDigits: c.exponent,
    maximumFractionDigits: c.exponent,
  });
  return c.code === "USD" ? `${c.symbol}${digits}` : `${c.symbol} ${digits}`;
}

/** Parse a user-typed major-unit string ("1,250.50") into minor units. Returns null if invalid. */
export function parseMoney(input: string, currencyCode: string = BASE_CURRENCY): number | null {
  const c = CURRENCIES[currencyCode];
  if (!c) return null;
  const cleaned = input.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  if (frac.length > c.exponent) return null;
  return Number(whole) * 10 ** c.exponent + Number(frac.padEnd(c.exponent, "0"));
}
