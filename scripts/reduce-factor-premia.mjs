/**
 * Reduce multi-factor data → src/data/generated/factor-premia.ts
 *
 * Extends the Fama-French factor lab beyond FF5 with four curated, well-known
 * "extended" factors, and builds the alpha-decay ladder that is the tool's
 * centrepiece.
 *
 *  New factors (US long-short, monthly):
 *   • Momentum   — Ken French UMD          (data/sources/french, in-repo)
 *   • Quality    — AQR QMJ (US)            (aqr, licensed → git-ignored)
 *   • Defensive  — AQR BAB (US)            (aqr, licensed → git-ignored)
 *   • Liquidity  — Pastor-Stambaugh ps_vwf (traded liquidity factor)
 *
 *  Per factor we ship annualized premium = mean(monthly)×12, vol = sd×√12, and
 *  its correlation with the market factor.
 *
 *  ALPHA_LADDER: for a handful of REAL Fama-French test portfolios, regress each
 *  portfolio's monthly excess return on the NESTED factor sets
 *    CAPM → +Size,Value (FF3) → +Profit,Investment (FF5)
 *         → +Momentum → +Quality → +Defensive → +Liquidity
 *  and ship, per rung, the annualized intercept (alpha), its t-stat, and R².
 *  All series are inner-joined on YYYYMM so every rung of a portfolio's ladder
 *  is fit on the same months — only the model changes, so the alpha melting is
 *  real, not a sample artifact. OLS is done by hand (normal equations); k ≤ 9.
 *
 * Only the reduced numbers commit; the licensed AQR workbooks never do.
 *
 * Run:  npm run data:factor-premia
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseFrench, pickBlock, toColumns } from "./lib/parse-french.mjs";
import { readWorkbook } from "./lib/read-xlsx.mjs";
import { srcDir } from "./lib/data-paths.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FR = join(root, "data", "sources", "french");
const AQR = srcDir("aqr");
const PS = srcDir("pastor-stambaugh");
const OUT = join(root, "src", "data", "generated", "factor-premia.ts");

const round = (x, dp) => Math.round(x * 10 ** dp) / 10 ** dp;

// ---------------------------------------------------------------- readers ----

/** French block → Map<YYYYMM, number(decimal)> for one column (percent → /100). */
function frenchSeries(file, pick, column) {
  const blocks = parseFrench(readFileSync(join(FR, file), "utf8"));
  const block = pickBlock(blocks, pick);
  if (!block) throw new Error(`no block ${JSON.stringify(pick)} in ${file}`);
  const cols = toColumns(block);
  if (!cols.series[column]) throw new Error(`no column ${column} in ${file}`);
  const m = new Map();
  cols.period.forEach((p, i) => {
    const v = cols.series[column][i];
    if (v !== null) m.set(p, v / 100);
  });
  return m;
}

/** AQR workbook USA column → Map<YYYYMM, number(decimal, already)>. */
function aqrUsaSeries(file, sheet) {
  const wb = readWorkbook(join(AQR, file));
  const rows = wb.sheet(sheet);
  let hr = -1;
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    if ((rows[i] || []).some((c) => String(c ?? "").trim().toUpperCase() === "DATE")) { hr = i; break; }
  }
  if (hr < 0) throw new Error(`no DATE header in ${file}/${sheet}`);
  const header = rows[hr].map((c) => String(c ?? "").trim().toUpperCase());
  const usa = header.indexOf("USA");
  if (usa < 0) throw new Error(`no USA column in ${file}/${sheet}`);
  const m = new Map();
  for (let i = hr + 1; i < rows.length; i++) {
    const d = String(rows[i][0] ?? "").trim(); // MM/DD/YYYY
    const v = rows[i][usa];
    if (!d || v === null || v === "" || v === undefined) continue;
    const [mm, , yyyy] = d.split("/");
    if (!yyyy || !mm) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    m.set(`${yyyy}${mm.padStart(2, "0")}`, n);
  }
  return m;
}

/** Pastor-Stambaugh traded liquidity factor ps_vwf → Map<YYYYMM, number>. */
function psLiquiditySeries() {
  const lines = readFileSync(join(PS, "pastor-stambaugh.csv"), "utf8").trim().split(/\r?\n/);
  const head = lines[0].split(",");
  const di = head.indexOf("date");
  const vi = head.indexOf("ps_vwf");
  const m = new Map();
  for (const line of lines.slice(1)) {
    const c = line.split(",");
    const v = Number(c[vi]);
    if (!Number.isFinite(v) || v === -99) continue; // -99 = pre-1968 missing sentinel
    const [yyyy, mm] = c[di].split("-"); // YYYY-MM-DD
    m.set(`${yyyy}${mm}`, v);
  }
  return m;
}

// ------------------------------------------------------------------ stats ----

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};
function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < a.length; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  }
  return cov / Math.sqrt(va * vb);
}

/** Overlapping (aligned) value pairs for two Maps keyed by YYYYMM. */
function alignPair(mapA, mapB) {
  const a = [], b = [];
  for (const [k, va] of mapA) {
    const vb = mapB.get(k);
    if (vb !== undefined) { a.push(va); b.push(vb); }
  }
  return [a, b];
}

// -------------------------------------------------------------- OLS by hand --

/** Invert a small square matrix via Gauss-Jordan. */
function invert(M) {
  const n = M.length;
  const A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-14) throw new Error("singular matrix");
    [A[col], A[piv]] = [A[piv], A[col]];
    const d = A[col][col];
    for (let j = 0; j < 2 * n; j++) A[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[col][j];
    }
  }
  return A.map((r) => r.slice(n));
}

/**
 * OLS of y on columns X (each a number[]), with an intercept prepended.
 * Returns { intercept, tStat (of intercept), r2 }, all monthly units.
 */
function ols(y, X) {
  const n = y.length;
  const p = X.length + 1; // + intercept
  // Design matrix rows: [1, x1, x2, ...]
  const cols = [Array.from({ length: n }, () => 1), ...X];
  // X'X and X'y
  const XtX = Array.from({ length: p }, () => Array(p).fill(0));
  const Xty = Array(p).fill(0);
  for (let a = 0; a < p; a++) {
    for (let b = a; b < p; b++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += cols[a][i] * cols[b][i];
      XtX[a][b] = s; XtX[b][a] = s;
    }
    let sy = 0;
    for (let i = 0; i < n; i++) sy += cols[a][i] * y[i];
    Xty[a] = sy;
  }
  const XtXinv = invert(XtX);
  const beta = XtXinv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
  // Residuals, RSS, TSS
  const my = mean(y);
  let rss = 0, tss = 0;
  for (let i = 0; i < n; i++) {
    let fit = 0;
    for (let a = 0; a < p; a++) fit += beta[a] * cols[a][i];
    rss += (y[i] - fit) ** 2;
    tss += (y[i] - my) ** 2;
  }
  const sigma2 = rss / (n - p);
  const seIntercept = Math.sqrt(sigma2 * XtXinv[0][0]);
  const tStat = beta[0] / seIntercept;
  const r2 = 1 - rss / tss;
  return { intercept: beta[0], tStat, r2 };
}

// ------------------------------------------------------------------- build ---

function main() {
  // --- Fama-French core factors (percent → decimal) ---
  const mkt = frenchSeries("F-F_Research_Data_5_Factors_2x3.csv", { frequency: "monthly" }, "Mkt-RF");
  const smb = frenchSeries("F-F_Research_Data_5_Factors_2x3.csv", { frequency: "monthly" }, "SMB");
  const hml = frenchSeries("F-F_Research_Data_5_Factors_2x3.csv", { frequency: "monthly" }, "HML");
  const rmw = frenchSeries("F-F_Research_Data_5_Factors_2x3.csv", { frequency: "monthly" }, "RMW");
  const cma = frenchSeries("F-F_Research_Data_5_Factors_2x3.csv", { frequency: "monthly" }, "CMA");
  const rf = frenchSeries("F-F_Research_Data_5_Factors_2x3.csv", { frequency: "monthly" }, "RF");
  const umd = frenchSeries("F-F_Momentum_Factor.csv", { frequency: "monthly" }, "Mom");

  // --- Extended factors ---
  const qmj = aqrUsaSeries("Quality Minus Junk Factors Monthly.xlsx", "QMJ Factors");
  const bab = aqrUsaSeries("Betting Against Beta Equity Factors Monthly.xlsx", "BAB Factors");
  const liq = psLiquiditySeries();

  const FKEY = { mkt, smb, hml, rmw, cma, umd, qmj, bab, liq };

  // --- Per-factor premia (over each factor's own native monthly sample) ---
  const factorMeta = [
    { key: "umd", src: umd },
    { key: "qmj", src: qmj },
    { key: "bab", src: bab },
    { key: "liq", src: liq },
  ];
  const premia = factorMeta.map(({ key, src }) => {
    const vals = [...src.values()];
    const keys = [...src.keys()].sort();
    const [fa, ma] = alignPair(src, mkt);
    return {
      key,
      premium: round(mean(vals) * 12, 4),
      vol: round(sd(vals) * Math.sqrt(12), 4),
      corrMkt: round(corr(fa, ma), 3),
      span: [keys[0], keys[keys.length - 1]],
    };
  });

  // --- Test portfolios (real Fama-French value-weighted monthly returns) ---
  const sixVW = toColumns(pickBlock(parseFrench(readFileSync(join(FR, "6_Portfolios_2x3.csv"), "utf8")), { title: "Value Weighted", frequency: "monthly" }));
  const indVW = toColumns(pickBlock(parseFrench(readFileSync(join(FR, "12_Industry_Portfolios.csv"), "utf8")), { title: "Value Weighted", frequency: "monthly" }));

  const portMap = (cols, column) => {
    const m = new Map();
    cols.period.forEach((p, i) => {
      const v = cols.series[column][i];
      if (v !== null) m.set(p, v / 100);
    });
    return m;
  };

  const PORTFOLIOS = [
    { key: "smallValue", name: "Small-cap value", group: "Size & value", blurb: "Small, cheap stocks — the classic high-expected-return corner.", src: portMap(sixVW, "SMALL HiBM") },
    { key: "smallGrowth", name: "Small-cap growth", group: "Size & value", blurb: "Small, expensive stocks — historically the weakest corner, with a negative five-factor alpha.", src: portMap(sixVW, "SMALL LoBM") },
    { key: "largeGrowth", name: "Large-cap growth", group: "Size & value", blurb: "Big, expensive stocks — the megacap-growth corner.", src: portMap(sixVW, "BIG LoBM") },
    { key: "largeValue", name: "Large-cap value", group: "Size & value", blurb: "Big, cheap stocks.", src: portMap(sixVW, "BIG HiBM") },
    { key: "tech", name: "Tech & business equipment", group: "Industry", blurb: "A high-beta, growth-leaning industry.", src: portMap(indVW, "BusEq") },
    { key: "utilities", name: "Utilities", group: "Industry", blurb: "The classic low-beta, defensive industry — heavy betting-against-beta exposure.", src: portMap(indVW, "Utils") },
    { key: "healthcare", name: "Healthcare", group: "Industry", blurb: "A defensive, high-quality industry.", src: portMap(indVW, "Hlth") },
    { key: "energy", name: "Energy", group: "Industry", blurb: "A cyclical, value-leaning industry.", src: portMap(indVW, "Enrgy") },
  ];

  // Nested factor sets (rungs of the ladder).
  const RUNGS = [
    { model: "capm", add: "CAPM (market only)", keys: ["mkt"] },
    { model: "ff3", add: "+ Size & Value", keys: ["mkt", "smb", "hml"] },
    { model: "ff5", add: "+ Profitability & Investment", keys: ["mkt", "smb", "hml", "rmw", "cma"] },
    { model: "mom", add: "+ Momentum", keys: ["mkt", "smb", "hml", "rmw", "cma", "umd"] },
    { model: "qual", add: "+ Quality", keys: ["mkt", "smb", "hml", "rmw", "cma", "umd", "qmj"] },
    { model: "def", add: "+ Defensive", keys: ["mkt", "smb", "hml", "rmw", "cma", "umd", "qmj", "bab"] },
    { model: "liq", add: "+ Liquidity", keys: ["mkt", "smb", "hml", "rmw", "cma", "umd", "qmj", "bab", "liq"] },
  ];

  // Common sample: months present in every factor + rf (so all rungs share it).
  const commonKeys = [...rf.keys()].filter((k) =>
    Object.values(FKEY).every((m) => m.has(k)),
  ).sort();
  const span = [commonKeys[0], commonKeys[commonKeys.length - 1]];

  const ladder = PORTFOLIOS.map((port) => {
    // Months where the portfolio AND every factor AND rf exist.
    const keys = commonKeys.filter((k) => port.src.has(k));
    const excess = keys.map((k) => port.src.get(k) - rf.get(k));
    const factorCols = Object.fromEntries(
      Object.entries(FKEY).map(([name, m]) => [name, keys.map((k) => m.get(k))]),
    );
    const rungs = RUNGS.map((r) => {
      const X = r.keys.map((name) => factorCols[name]);
      const { intercept, tStat, r2 } = ols(excess, X);
      return { add: r.add, model: r.model, alpha: round(intercept * 12, 4), tStat: round(tStat, 2), r2: round(r2, 3) };
    });
    return {
      key: port.key,
      name: port.name,
      group: port.group,
      blurb: port.blurb,
      rawExcess: round(mean(excess) * 12, 4),
      rungs,
    };
  });

  const out = {
    source: "Ken French Data Library (market, size, value, profitability, investment, momentum) · AQR (Quality-Minus-Junk, Betting-Against-Beta, US) · Pastor-Stambaugh traded liquidity factor.",
    span,
    nMonths: commonKeys.length,
    premia,
    ladder,
  };
  writeFileSync(OUT, render(out));

  console.log(
    `factor-premia: sample ${span[0]}–${span[1]} (${commonKeys.length} months)\n` +
      premia.map((p) => `  ${p.key}: premium ${(p.premium * 100).toFixed(1)}%/yr, vol ${(p.vol * 100).toFixed(1)}%, corr(mkt) ${p.corrMkt}`).join("\n") +
      `\n  ${ladder.length} test portfolios × ${RUNGS.length} rungs. e.g. Small value alpha ` +
      ladder[0].rungs.map((r) => `${(r.alpha * 100).toFixed(1)}`).join("→") + "%\n" +
      `  Utilities defensive rung Δ: ${((ladder[5].rungs[4].alpha - ladder[5].rungs[5].alpha) * 100).toFixed(1)}pp\n  → ${OUT}`,
  );
}

function render(o) {
  const premia = o.premia
    .map((p) => `  { key: ${JSON.stringify(p.key)}, premium: ${p.premium}, vol: ${p.vol}, corrMkt: ${p.corrMkt}, span: [${JSON.stringify(p.span[0])}, ${JSON.stringify(p.span[1])}] },`)
    .join("\n");
  const ladder = o.ladder
    .map((port) => {
      const rungs = port.rungs
        .map((r) => `      { add: ${JSON.stringify(r.add)}, model: ${JSON.stringify(r.model)}, alpha: ${r.alpha}, tStat: ${r.tStat}, r2: ${r.r2} },`)
        .join("\n");
      return `  {
    key: ${JSON.stringify(port.key)},
    name: ${JSON.stringify(port.name)},
    group: ${JSON.stringify(port.group)},
    blurb: ${JSON.stringify(port.blurb)},
    rawExcess: ${port.rawExcess},
    rungs: [
${rungs}
    ],
  },`;
    })
    .join("\n");

  return `// AUTO-GENERATED by scripts/reduce-factor-premia.mjs — DO NOT EDIT.
// Re-run: npm run data:factor-premia
//
// Extended factor premia + the alpha-decay ladder for the Factor Lab.
// Premia are annualized decimals; ladder alphas are annualized regression
// intercepts (decimals) with the intercept's t-stat and the regression R².

export interface FactorPremium {
  /** Matches the extended-factor keys in src/data/factors.ts. */
  key: "umd" | "qmj" | "bab" | "liq";
  /** Annualized premium = mean(monthly) × 12 (decimal). */
  premium: number;
  /** Annualized volatility = sd(monthly) × √12 (decimal). */
  vol: number;
  /** Correlation with the market factor over the overlapping sample. */
  corrMkt: number;
  span: [string, string];
}

export interface LadderRung {
  /** Human label for what this rung adds, e.g. "+ Momentum". */
  add: string;
  model: string;
  /** Annualized regression intercept = "alpha" (decimal). */
  alpha: number;
  /** t-statistic of the intercept. |t| ≥ 2 ≈ statistically distinguishable from luck. */
  tStat: number;
  /** Regression R². */
  r2: number;
}

export interface LadderPortfolio {
  key: string;
  name: string;
  group: string;
  blurb: string;
  /** Annualized average excess return over T-bills (decimal). */
  rawExcess: number;
  rungs: LadderRung[];
}

export interface FactorPremia {
  source: string;
  /** Common monthly sample [start, end] used for every ladder regression. */
  span: [string, string];
  nMonths: number;
  premia: FactorPremium[];
  ladder: LadderPortfolio[];
}

export const factorPremia: FactorPremia = {
  source: ${JSON.stringify(o.source)},
  span: [${JSON.stringify(o.span[0])}, ${JSON.stringify(o.span[1])}],
  nMonths: ${o.nMonths},
  premia: [
${premia}
  ],
  ladder: [
${ladder}
  ],
};
`;
}

main();
