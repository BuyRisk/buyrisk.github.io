import { useSyncExternalStore } from "react";

/**
 * Site-wide currency selection, shared across every React island.
 *
 * Switching currency swaps the SYMBOL and formatting, keeping the same numeric
 * values. That only stays honest for currencies close to the US dollar in
 * magnitude, so the defaults (a $50k salary, a $1M portfolio) still read
 * sensibly without FX conversion. Every currency offered here trades within
 * roughly 2× of the dollar. Currencies with very different scale (e.g. JPY at
 * ~150/USD, or HKD at ~7.8/USD) would additionally need every slider range and
 * default rescaled — deliberately out of scope, so they're not offered.
 *
 * The source of truth is localStorage (so it survives navigation and syncs
 * across islands and tabs). A plain formatter reads the current currency each
 * call; islands call `useCurrencyCode()` once so they re-render on a change.
 *
 * To add a currency: extend CURRENCIES below (and mirror the option list in
 * CurrencySelect.astro). Keep it near dollar parity, or the ranges will lie.
 */

export const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD" },
  { code: "EUR", symbol: "€", label: "EUR" },
  { code: "GBP", symbol: "£", label: "GBP" },
  { code: "CAD", symbol: "CA$", label: "CAD" },
  { code: "AUD", symbol: "A$", label: "AUD" },
  { code: "NZD", symbol: "NZ$", label: "NZD" },
  { code: "CHF", symbol: "Fr", label: "CHF" },
  { code: "SGD", symbol: "S$", label: "SGD" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

const SYMBOL = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.symbol]),
) as Record<CurrencyCode, string>;

const CODES = new Set<string>(CURRENCIES.map((c) => c.code));
const KEY = "buy-risk-currency";
const EVENT = "buy-risk-currency-change";
const DEFAULT: CurrencyCode = "USD";

const isCode = (c: unknown): c is CurrencyCode =>
  typeof c === "string" && CODES.has(c);

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

/**
 * Format in US dollars regardless of the header picker. For tools whose
 * numbers are creatures of US law — SSA benefits, IRS brackets and credits,
 * US account types — showing them in £ or € would imply the framework
 * transfers across borders. It doesn't; those labs pin to $.
 */
export function formatUsd(n: number, opts: { compact?: boolean } = {}): string {
  const abs = Math.abs(n);
  const notation = abs >= 1e15 ? "scientific" : opts.compact || abs >= 1e9 ? "compact" : "standard";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
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
