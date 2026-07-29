# `ssa/` — U.S. Social Security Administration actuarial data

**Source:** SSA Office of the Chief Actuary — <https://www.ssa.gov/oact/>
**License:** Public domain (a work of the U.S. federal government) — free to use
and redistribute, so unlike jst/ and aqr/ the raw file is committed.
**Citation:** U.S. Social Security Administration, Office of the Chief Actuary,
*Period Life Table, 2023* (2026 Trustees Report).

## Files

| File | What it is |
|---|---|
| `2023 (2026 TR) SSA Period Life Table.xlsx` | Period life table, 2023: by exact age (0–119), male & female — death probability (qₓ), survivors (lₓ), life expectancy (eₓ). |
| `SSA National Average Wage Index.xlsx` | AWI by year (from 1951) — used to index a worker's past earnings to today's wage levels. |
| `SSA Benefit Formula Bend Points.xlsx` | The two PIA-formula bend points by year (from 1979) — the dollar breakpoints in the 90%/32%/15% benefit formula. |
| `SSA COLA.xlsx` | Annual cost-of-living adjustments since 1975 — how benefits grow with inflation. |

## Powers

The **Social Security** tool(s). Together these support the full picture:

- **Life table** → the survival curve that weights the early-vs-delayed claiming
  breakeven by the real probability of being alive at each age.
- **AWI + bend points** → compute an actual **Primary Insurance Amount** from a
  worker's earnings history (index earnings by AWI, apply the bend-point formula).
- **COLA** → grow the benefit with realized inflation.

So the tool can move beyond "when to claim" to "here's your *estimated benefit*,
and here's how claiming age × longevity × COLA change its lifetime value."

## Format & parsing

Standard `.xlsx` (read by `scripts/lib/read-xlsx.mjs`). Layout: ~7 preamble/title
rows, a two-line header (`Exact age | Male {qₓ, lₓ, eₓ} | Female {qₓ, lₓ, eₓ}`),
then one row per age 0–119. A reducer should skip the preamble and stop at the
last numeric age row (the sheet ends with an "Ask AI Assistant" website footer
artifact to drop).

## Optional upgrade

This is a **period** table (mortality at one point in time). For a person retiring
now, **cohort** life tables (which project future mortality improvement, adding
~2–3 years of life expectancy) are more accurate. They live under
<https://www.ssa.gov/oact/Downloadables/CY/> — grab one representative recent
birth-year cohort if you want that precision; the period table is a solid v1.
