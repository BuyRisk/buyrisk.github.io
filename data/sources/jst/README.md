# `jst/` — The Jordà-Schularick-Taylor Macrohistory Database

**Source:** <https://www.macrohistory.net/database/> (Release 6, file
`JSTdatasetR6.dta`).
**License:** Creative Commons **CC BY-NC-SA 4.0** — free to use with attribution,
non-commercial, share-alike.
**Citation for any figure derived from it:**
Jordà, Ò., Knoll, K., Kuvshinov, D., Schularick, M., & Taylor, A. M. (2019).
"The Rate of Return on Everything, 1870–2015." *The Quarterly Journal of
Economics* 134(3): 1225–1298. Data via the Jordà-Schularick-Taylor Macrohistory
Database, macrohistory.net.

## Why it's here

The single best **long-run, cross-country** return series on the site: annual
real and nominal returns on **equities, housing, bonds, and bills** across **18
advanced economies, 1870–2020** — plus macro context (CPI, GDP, debt, crises).
It de-US-centers the story (US returns were exceptional, not guaranteed) and adds
**housing** as an asset class whose risk-adjusted returns rival equities.

## Format & parsing

The download is a **Stata `.dta` (format 118)** file — 59 variables × 2,718
observations. It is read by [`scripts/lib/parse-dta.mjs`](../../../scripts/lib/parse-dta.mjs),
a minimal `.dta` reader (formats 117/118); Stata missing values become `null`.
Run `npm run data:inspect` to confirm it parses and to see the catalogue.

Key return columns (all annual, per country): `eq_tr` (equity total return),
`housing_tr`, `bond_tr`, `bill_rate`, plus `_interp`/`_ipolated` interpolated
variants, `cpi`, `rgdpmad` (real GDP), and `crisisJST` (systemic-crisis flag).

## The raw file is git-ignored

Unlike the other free providers, the raw `.dta` is **not committed** — see
[`.gitignore`](.gitignore). It is freely re-downloadable from the link above, so
anyone can reproduce the derived numbers; keeping it out of the repo avoids the
CC BY-NC-SA share-alike clause attaching to the codebase. Only the reduced,
attributed aggregates in `src/data/generated/` ship.
