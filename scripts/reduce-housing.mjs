/**
 * Reduce FRED housing series → src/data/generated/housing.ts
 *
 * The data behind "Rent or Buy?": the 30-year mortgage rate (for a realistic
 * default and historical context) and the S&P/Case-Shiller U.S. National Home
 * Price Index (for a realistic appreciation default AND the crucial lesson that
 * home prices are NOT a one-way bet — they fell ~27% nationally in 2007–2012).
 *
 * We emit annual series plus a few headline stats: the long-run nominal home-price
 * CAGR, the worst peak-to-trough drawdown, and the spread of rolling 10-year
 * appreciation — so the tool can show that the single assumption a rent-vs-buy
 * result hinges on most (future appreciation) is also the most uncertain.
 *
 * Run:  npm run data:housing
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseFred } from "./lib/parse-fred.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FRED = join(root, "data", "sources", "fred");
const OUT = join(root, "src", "data", "generated", "housing.ts");

const round = (x, dp) => Math.round(x * 10 ** dp) / 10 ** dp;
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Monthly rows → { year: annual mean } (years with ≥6 observed months). */
function annualMean(rows) {
  const byYear = new Map();
  for (const r of rows) {
    if (r.value === null) continue;
    const y = +r.date.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(r.value);
  }
  const out = [];
  for (const [year, vals] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    if (vals.length >= 6) out.push({ year, value: vals.reduce((s, v) => s + v, 0) / vals.length });
  }
  return out;
}

function main() {
  // --- Mortgage rate (30-yr fixed) --------------------------------------
  const mtg = parseFred(join(FRED, "MORTGAGE30US.csv"));
  const mtgObs = mtg.rows.filter((r) => r.value !== null);
  const latestRate = mtgObs[mtgObs.length - 1];
  const mtgAnnual = annualMean(mtg.rows).map((p) => ({ year: p.year, rate: round(p.value, 2) }));
  const lo = mtgObs.reduce((a, b) => (b.value < a.value ? b : a));
  const hi = mtgObs.reduce((a, b) => (b.value > a.value ? b : a));

  // --- Case-Shiller national home price index ---------------------------
  const cs = parseFred(join(FRED, "CSUSHPINSA.csv"));
  const csObs = cs.rows.filter((r) => r.value !== null);
  const first = csObs[0], last = csObs[csObs.length - 1];
  const years = (new Date(last.date) - new Date(first.date)) / (365.25 * 864e5);
  const cagr = Math.pow(last.value / first.value, 1 / years) - 1;

  // Worst peak-to-trough drawdown (monthly).
  let peak = -Infinity, peakDate = null, worst = { pct: 0, peakDate: null, troughDate: null };
  for (const r of csObs) {
    if (r.value > peak) { peak = r.value; peakDate = r.date; }
    const dd = r.value / peak - 1;
    if (dd < worst.pct) worst = { pct: dd, peakDate, troughDate: r.date };
  }

  // Spread of rolling 10-year annualized appreciation.
  const W = 120;
  const roll = [];
  for (let i = 0; i + W < csObs.length; i++) {
    roll.push(Math.pow(csObs[i + W].value / csObs[i].value, 12 / W) - 1);
  }

  const csAnnual = annualMean(cs.rows).map((p) => ({ year: p.year, index: round(p.value, 1) }));

  const out = {
    asOf: last.date,
    mortgage: {
      latest: latestRate.value,
      latestDate: latestRate.date,
      min: lo.value, minYear: +lo.date.slice(0, 4),
      max: hi.value, maxYear: +hi.date.slice(0, 4),
      series: mtgAnnual,
    },
    homePrices: {
      startYear: +first.date.slice(0, 4),
      endYear: +last.date.slice(0, 4),
      cagr: round(cagr, 4),
      worstDrawdown: {
        pct: round(worst.pct, 4),
        peakYear: +worst.peakDate.slice(0, 4),
        troughYear: +worst.troughDate.slice(0, 4),
      },
      rolling10yr: { min: round(Math.min(...roll), 4), median: round(median(roll), 4), max: round(Math.max(...roll), 4) },
      // The annual index levels themselves are NOT emitted: FRED tags
      // CSUSHPINSA "Copyrighted: Pre-Approval Required" (S&P DJI). Only the
      // headline statistics above ship; nothing on the site needs the series.
    },
  };
  writeFileSync(OUT, render(out));

  console.log(
    `housing: mortgage latest ${latestRate.value}% (${latestRate.date}); range ${lo.value}–${hi.value}%\n` +
      `  home prices ${out.homePrices.startYear}–${out.homePrices.endYear}: ${round(cagr * 100, 2)}%/yr nominal\n` +
      `  worst drawdown ${round(worst.pct * 100, 1)}% (${worst.peakDate.slice(0, 7)} → ${worst.troughDate.slice(0, 7)})\n` +
      `  rolling 10-yr appreciation: ${round(out.homePrices.rolling10yr.min * 100, 1)}% … ${round(out.homePrices.rolling10yr.max * 100, 1)}%/yr\n  → ${OUT}`
  );
}

function render(o) {
  const mtgSeries = o.mortgage.series.map((p) => `{ year: ${p.year}, rate: ${p.rate} }`).join(", ");
  return `// AUTO-GENERATED by scripts/reduce-housing.mjs — DO NOT EDIT.
// Re-run: npm run data:housing
//
// 30-year mortgage rate and the S&P/Case-Shiller U.S. National Home Price Index
// (U.S. BLS/Freddie Mac/S&P via FRED). Used for realistic defaults and to show
// that home-price appreciation is uncertain (worst drawdown, rolling-return range).

export interface RatePoint { year: number; rate: number; }
export interface IndexPoint { year: number; index: number; }

export interface HousingData {
  asOf: string;
  mortgage: {
    /** Latest weekly 30-yr fixed rate (%). */
    latest: number;
    latestDate: string;
    min: number; minYear: number;
    max: number; maxYear: number;
    /** Annual-average 30-yr fixed rate (%). */
    series: RatePoint[];
  };
  homePrices: {
    startYear: number;
    endYear: number;
    /** Long-run nominal home-price CAGR (fraction, e.g. 0.043). */
    cagr: number;
    /** Worst peak-to-trough national decline (negative fraction). */
    worstDrawdown: { pct: number; peakYear: number; troughYear: number };
    /** Spread of rolling 10-year annualized appreciation (fractions). */
    rolling10yr: { min: number; median: number; max: number };
  };
}

export const housing: HousingData = {
  asOf: ${JSON.stringify(o.asOf)},
  mortgage: {
    latest: ${o.mortgage.latest},
    latestDate: ${JSON.stringify(o.mortgage.latestDate)},
    min: ${o.mortgage.min}, minYear: ${o.mortgage.minYear},
    max: ${o.mortgage.max}, maxYear: ${o.mortgage.maxYear},
    series: [${mtgSeries}],
  },
  homePrices: {
    startYear: ${o.homePrices.startYear},
    endYear: ${o.homePrices.endYear},
    cagr: ${o.homePrices.cagr},
    worstDrawdown: { pct: ${o.homePrices.worstDrawdown.pct}, peakYear: ${o.homePrices.worstDrawdown.peakYear}, troughYear: ${o.homePrices.worstDrawdown.troughYear} },
    rolling10yr: { min: ${o.homePrices.rolling10yr.min}, median: ${o.homePrices.rolling10yr.median}, max: ${o.homePrices.rolling10yr.max} },
  },
};
`;
}

main();
