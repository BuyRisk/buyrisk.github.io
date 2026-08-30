# `french/` — Kenneth R. French Data Library

**Source:** <https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html>
(Tuck School of Business, Dartmouth). Downloaded as the library's zipped CSVs.
**Terms:** provided free by the author for research and educational use; the
library page carries the governing statement and asks that the source be
credited. Attribute any derived figure.
**Citation:** Fama, E. F., & French, K. R., data via the Kenneth R. French Data
Library. Cite the underlying paper for the model itself — Fama & French (1993)
for the three-factor model, (2015) for the five-factor.

## Why it's here

Every factor number on the site. These are the canonical, academically standard
return series for the market, size, value, profitability, investment, and
momentum factors — the raw material for the CAPM tool, the factor premium
tables, and the alpha-decay ladder.

## Files

| File | Contents |
|---|---|
| `F-F_Research_Data_Factors.csv` (+ `_daily`, `_weekly`) | Three factors: Mkt-RF, SMB, HML, plus RF |
| `F-F_Research_Data_5_Factors_2x3.csv` (+ `_daily`) | Five factors: adds RMW, CMA |
| `F-F_Momentum_Factor.csv` (+ `_daily`) | Momentum (UMD/MOM) |
| `6_Portfolios_2x3.csv` (+ `_Daily`, `_weekly`) | Size × value sorted portfolios |
| `25_Portfolios_5x5.csv` | Finer size × value grid |
| `12_Industry_Portfolios.csv`, `49_Industry_Portfolios.csv` (+ `_Daily`) | Industry returns |
| `Developed_ex_US_5_Factors.csv`, `Emerging_5_Factors.csv` | International factors, for the global tools |

## Format & parsing

These CSVs are **not** clean tables. Each file contains one or more titled
blocks separated by blank lines (annual data typically follows monthly in the
same file), a multi-line text header, and copyright/footnote lines at the end.
Dates are bare integers: `YYYYMM` for monthly, `YYYYMMDD` for daily, `YYYY` for
annual. Values are in **percent, not decimals**, and missing observations are
coded `-99.99` or `-999` — coercing those to zero silently fabricates returns.

[`scripts/lib/parse-french.mjs`](../../../scripts/lib/parse-french.mjs) handles
all of the above and is the only thing that should read these files directly.

Consumed by [`reduce-factor-premia.mjs`](../../../scripts/reduce-factor-premia.mjs),
[`reduce-capm.mjs`](../../../scripts/reduce-capm.mjs),
[`reduce-french-daily.mjs`](../../../scripts/reduce-french-daily.mjs),
[`reduce-global-equity.mjs`](../../../scripts/reduce-global-equity.mjs), and
[`reduce-crsp-superstock.mjs`](../../../scripts/reduce-crsp-superstock.mjs).

## Committed

Committed despite the daily files being multi-MB, because they are the single
most re-derived input on the site and a clean clone should reproduce the factor
numbers without a download step.
