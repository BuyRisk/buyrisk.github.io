# Dataset library — raw sources

This directory holds **primary-source research datasets**, verbatim, exactly as
downloaded from their publishers. Nothing here is edited by hand. The site never
imports these files directly; instead, build-time scripts in [`/scripts`](../../scripts)
parse and *reduce* them into small, typed `.ts` files under
[`src/data/generated/`](../../src/data/generated) that the interactive tools import.

```
data/sources/<provider>/   raw files, never shipped to the browser
        │
   scripts/lib/*.mjs        provider-specific parsers
   scripts/reduce-*.mjs     per-tool reducers (build-time, Node)
        │
 src/data/generated/*.ts    small typed outputs the site imports & ships
```

Keeping the raw files in the repo is deliberate: it makes every number on the
site reproducible from its primary source, which is the whole point of an
evidence-based teaching site.

## Providers

| Folder | Provider | Status |
|---|---|---|
| `french/` | Kenneth R. French Data Library (Tuck / Dartmouth) | ✅ ingested |
| `damodaran/` | Aswath Damodaran historical returns (NYU Stern) | ✅ ingested |
| `shiller/` | Robert Shiller long-run US data (Yale) | ✅ ingested |
| `fred/` | Federal Reserve Economic Data (FRED) | ✅ ingested |
| `crsp/` | CRSP individual-stock returns (via WRDS) | ⬜ planned |

**File formats:** French files are CSV (parsed by `scripts/lib/parse-french.mjs`).
Damodaran and Shiller ship legacy binary `.xls` workbooks (parsed by
`scripts/lib/read-xlsx.mjs`, a thin SheetJS wrapper). `xlsx` is a **devDependency
used only at build time** — it never ships to the browser.

Run `npm run data:inspect` at any time to re-catalog every file here and confirm
it parses. That command is the ingestion smoke-test: **if a newly downloaded
file shows up correctly in its output, it's ready to reduce.**

---

## `french/` — Kenneth R. French Data Library

**Source:** <https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html>
**License / citation:** © Eugene F. Fama & Kenneth R. French. Free to use; the
library asks to be cited. Every chart driven by this data must show a
**"Data: Kenneth R. French Data Library"** credit line.

### Files in this folder

| File | Freq | Span | Powers |
|---|---|---|---|
| `F-F_Research_Data_Factors.csv` | monthly | 1926–2026 | 3-factor / CAPM market series |
| `F-F_Research_Data_Factors_daily.csv` | daily | 1926–2026 | "Missing the best days", tail-risk |
| `F-F_Research_Data_Factors_weekly.csv` | weekly | 1926–2026 | (reserve) |
| `F-F_Research_Data_5_Factors_2x3.csv` | monthly | 1963–2026 | Factor Models tool |
| `F-F_Research_Data_5_Factors_2x3_daily.csv` | daily | 1963–2026 | Factor daily analyses |
| `F-F_Momentum_Factor.csv` | monthly | 1927–2026 | Momentum (optional 6th factor) |
| `F-F_Momentum_Factor_daily.csv` | daily | 1927–2026 | Momentum daily (note: trailing-comma format) |
| `6_Portfolios_2x3.csv` | monthly | 1926–2026 | CAPM security market line (real betas) |
| `6_Portfolios_2x3_weekly.csv` | weekly | 1926–2026 | (reserve) |
| `6_Portfolios_2x3_Daily.csv` | daily | 1926–2026 | (reserve) |
| `12_Industry_Portfolios.csv` | monthly | 1926–2026 | Portfolio Lab correlations, CAPM scatter |
| `12_Industry_Portfolios_Daily.csv` | daily | 1926–2026 | (reserve) |
| `49_Industry_Portfolios.csv` | monthly | 1926–2026 | (reserve — fine-grained industries) |
| `49_Industry_Portfolios_Daily.csv` | daily | 1926–2026 | (reserve — 20 MB, least load-bearing) |

"(reserve)" = kept for future/optional use, not required by a current tool.

### File format (what the parser handles for you)

All French CSVs share one grammar; [`scripts/lib/parse-french.mjs`](../../scripts/lib/parse-french.mjs)
decodes it. You do **not** need to pre-clean these files.

- **Preamble** — a few prose lines of description at the top; ignored.
- **Blocks** — each file contains one or more stacked tables. Factor files have
  a monthly/daily table plus an appended *annual* block. Portfolio and industry
  files stack 6–10 blocks: value-weighted returns, equal-weighted returns, the
  annual variants of each, number of firms, average firm size, and (for the
  6-portfolio file) BE/ME, profitability, and investment characteristics.
- **Block header** — the first cell is empty, then the column names, e.g.
  `,Mkt-RF,SMB,HML,RMW,CMA,RF` or `,NoDur,Durbl,Manuf,…`.
- **Period keys** — `YYYY` (annual), `YYYYMM` (monthly), `YYYYMMDD` (daily/weekly).
- **Units** — every return is **percent for that period** (e.g. `2.89` = +2.89%).
- **Missing data** — flagged `-99.99` or `-999`; the parser converts these to
  `null`. Common in early decades of the 49-industry file, where some industries
  had no listed firms yet.
- **Footer** — a `Copyright …` line; ignored.

### Refreshing

French republishes monthly. To update, re-download the same filenames from the
link above, drop them here (overwrite), and run `npm run data:inspect`, then the
relevant reducer. Filenames are stable, so the pipeline just picks up the new data.

---

## `damodaran/` — Aswath Damodaran (NYU Stern)

**Source:** <https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datacurrent.html>
**Format:** multi-sheet binary `.xls`. Many sheets are chart helpers or FRED
metadata dumps; the load-bearing sheets are named below.

| File | Key sheet | Columns that matter | Span |
|---|---|---|---|
| `histretSP.xls` | **`Nominal vs Real Data`** | Year, S&P 500 (incl. div), 3-mo T.Bill, 10-yr T.Bond, Inflation, + real versions | 1928–2025 |
| `histretSP.xls` | `Gold Prices`, `Home Prices`, `Small Cap`, `S&P 500 & Raw Data` | extra asset classes (gold, real estate, small cap, Aaa/Baa corporate) | 1927–2025 |
| `histimpl.xls` | **`Historical Impl Premiums`** | Year, Earnings Yield, Dividend Yield, S&P 500, implied ERP | 1960–present |

`histretSP.xls` is the flagship: the `Nominal vs Real Data` sheet is the single
best annual asset-class return series for calibrating the asset presets in
`src/data/assets.ts` and grounding the Compound Growth and inflation tools.

## `shiller/` — Robert Shiller (Yale)

**Source:** <https://shillerdata.com/> (the old `econ.yale.edu/~shiller` links are
dead — he migrated the site).
**Format:** multi-sheet `.xls`/`.xlsx`.

| File | Key sheet | Columns that matter | Span |
|---|---|---|---|
| `ie_data.xls` (**primary**) | **`Data`** | Date, S&P price (P), Dividend (D), Earnings (E), CPI, 10-yr rate (GS10), Real Price/Dividend, CAPE | monthly, 1871–present |
| `chapt26.xlsx` (reference) | `Data` | annual P/D/E, short + long rates, CPI, **per-capita real consumption** | annual, 1871–2009 |

Note Shiller's date convention on the `Data` sheet: `1871.01 … 1871.12` encodes
the month in the two decimal digits (so `1871.10` = October). The `chapt26.xlsx`
file is an older annual companion — kept only for its unique consumption series;
`ie_data.xls` is the one to use for returns, inflation, and valuation.

## `fred/` — Federal Reserve Economic Data

**Source:** <https://fred.stlouisfed.org> (each file is a series export)
**Format:** two columns, `observation_date,<SERIES_ID>`, parsed by
`scripts/lib/parse-fred.mjs`. Blank cells → `null`.

FRED's role is the current, monthly, auto-updatable macro backbone (long-run
history is also covered by Shiller/Damodaran; FRED adds monthly granularity and
kept-current values).

| Series | Meaning | Freq | Span | Powers |
|---|---|---|---|---|
| `CPIAUCSL` | CPI-U, seasonally adjusted | monthly | 1947– | Inflation (Burn-Rate, Compound Growth) |
| `CPIAUCNS` | CPI-U, not seasonally adjusted | monthly | 1913– | Inflation matched to Damodaran/Shiller |
| `TB3MS` | 3-month T-bill rate | monthly | 1934– | Cash / risk-free rate |
| `GS10` | 10-year Treasury yield | monthly | 1953– | Bond yield / risk-free for CAPM |
| `FEDFUNDS` | Effective federal funds rate | monthly | 1954– | Current cash rate |
| `GS1/GS2/GS5/GS20/GS30` | Constant-maturity yields | monthly | 1953–77– | Yield-curve tool (reserve) |
| `T10YIE` | 10-year breakeven inflation | daily | 2003– | Expected vs. realized inflation (reserve) |
| `DFII10` | 10-year TIPS real yield | daily | 2003– | Real risk-free rate (reserve) |

Known non-error gaps: `GS20` has no data 1987–1993 (Treasury suspended the
20-year bond — inherent, not a download error); CPI may lag by a month at the
current edge. Daily series (`T10YIE`, `DFII10`) carry ~11 blank market-holiday
rows per year, which the parser nulls. All series span their full available
history (the daily TIPS/breakeven series begin in 2003).
