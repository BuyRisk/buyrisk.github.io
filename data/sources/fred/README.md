# `fred/` — Federal Reserve Economic Data (St. Louis Fed)

**Source:** <https://fred.stlouisfed.org/> — one CSV per series, downloaded via
the series page.
**Terms:** most series here originate with US federal agencies (BLS, Treasury,
Federal Reserve Board) and carry no copyright; a few are third-party. FRED asks
that the source be cited. See <https://fred.stlouisfed.org/legal/> and the
"Notes" block on each series page for that series' own attribution line.

## Why it's here

The site's macro backdrop: inflation, interest rates, and the recession/credit
context the tools plot against. Everything is a plain, freely re-downloadable
public series, so any figure derived from it can be checked independently.

## Files, by group

| Group | Series | Used for |
|---|---|---|
| Headline inflation | `CPIAUCSL`, `CPIAUCNS` | Real-vs-nominal conversion site-wide |
| Inflation by category | `CPIAPPSL`, `CPIENGSL`, `CPIFABSL`, `CPIMEDSL`, `CUSR0000SAH1`, `CUUR0000SEEB`, `CUUR0000SERE01`, `CUUR0000SETA01` | "Inflation isn't one number" — the dispersion behind the average |
| Treasury yields | `GS1`, `GS2`, `GS5`, `GS10`, `GS20`, `GS30`, `TB3MS`, `FEDFUNDS` | Yield curve, risk-free rate, live rates |
| Real yields & breakevens | `DFII10`, `T10YIE` | Inflation expectations |
| Corporate credit | `AAA`, `BAA` | Credit spreads |
| Consumer borrowing | `MORTGAGE30US`, `TERMCBAUTO48NS`, `TERMCBCCALLNS` | The cost-of-debt tool |
| Housing | `CSUSHPINSA` | Rent-vs-buy, housing returns |
| Context | `USREC`, `VIXCLS` | Recession shading, volatility |

## Format & parsing

Standard FRED CSV: a date column plus one value column named after the series.
Missing observations appear as `.` and must not be coerced to zero — see
[`scripts/lib/parse-fred.mjs`](../../../scripts/lib/parse-fred.mjs), which is the
only thing that should read these files.

Note the `SL` vs `NS` suffix distinction: `CPIAUCSL` is seasonally adjusted,
`CPIAUCNS` is not. Year-over-year inflation should come from the **NS** series;
month-over-month comparisons want **SL**.

Consumed by [`reduce-inflation.mjs`](../../../scripts/reduce-inflation.mjs),
[`reduce-fred-yields.mjs`](../../../scripts/reduce-fred-yields.mjs),
[`reduce-debt.mjs`](../../../scripts/reduce-debt.mjs), and
[`reduce-housing.mjs`](../../../scripts/reduce-housing.mjs).

## Committed

All 28 files are small text CSVs and are committed, so a clean clone reproduces
every derived figure without network access. To refresh, re-download the same
series IDs from FRED and overwrite in place.
