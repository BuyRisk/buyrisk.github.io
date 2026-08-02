import { useSyncExternalStore } from "react";

/**
 * Site-wide currency selection, shared across every React island.
 *
 * Feasibility spike (USD / EUR / GBP): switching currency swaps the SYMBOL and
 * formatting, keeping the same numeric values. Those three are close enough in
 * magnitude that the defaults stay sensible without FX conversion. Currencies
 * with very different scale (e.g. JPY) would additionally need the slider
 * ranges and defaults rescaled — deliberately out of scope here.
 *
 * The source of truth is localStorage (so it survives navigation and syncs
 * across islands and tabs). A plain formatter reads the current currency each
 * call; islands call `useCurrencyCode()` once so they re-render on a change.
 */

export type CurrencyCode = "USD" | "EUR" | "GBP";

export const CURRENCIES: { code: CurrencyCode; symbol: string; label: string }[] = [
  { code: "USD", symbol: "$", label: "USD" },
  { code: "EUR", symbol: "€", label: "EUR" },
  { code: "GBP", symbol: "£", label: "GBP" },
];

const SYMBOL: Record<CurrencyCode, string> = { USD: "$", EUR: "€", GBP: "£" };
const KEY = "buy-risk-currency";
const EVENT = "buy-risk-currency-change";
const DEFAULT: CurrencyCode = "USD";

const isCode = (c: unknown): c is CurrencyCode => c === "USD" || c === "EUR" || c === "GBP";

export function getCurrency(): CurrencyCode {
  if (typeof localStorage === "undefined") return DEFAULT;
  const s = localStorage.getItem(KEY);
  return isCode(s) ? s : DEFAULT;
}

export function setCurrency(code: CurrencyCode): void {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* private mode, etc. */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function currencySymbol(code: CurrencyCode = getCurrency()): string {
  return SYMBOL[code];
}

/**
 * Format a number as money in the current currency, matching the site's
 * dynamic-range rules (full figures, then compact …B/…T, then scientific).
 */
export function formatMoney(n: number, opts: { compact?: boolean } = {}): string {
  const code = getCurrency();
  const abs = Math.abs(n);
  const notation = abs >= 1e15 ? "scientific" : opts.compact || abs >= 1e9 ? "compact" : "standard";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: code,
    notation,
    maximumFractionDigits: notation === "standard" ? 0 : 1,
  });
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // cross-tab
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** React hook: the current currency code, re-rendering when it changes anywhere. */
export function useCurrencyCode(): CurrencyCode {
  return useSyncExternalStore(subscribe, getCurrency, () => DEFAULT);
}
