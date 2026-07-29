# `ssa/` — U.S. Social Security Administration actuarial data

**Source:** SSA Office of the Chief Actuary — <https://www.ssa.gov/oact/>
**License:** Public domain (a work of the U.S. federal government) — free to use
and redistribute, so unlike jst/ and aqr/ the raw file is committed.
**Citation:** U.S. Social Security Administration, Office of the Chief Actuary,
*Period Life Table, 2023* (2026 Trustees Report).

## Files

| File | What it is |
|---|---|
| `2023 (2026 TR) SSA Period Life Table.xlsx` | Period life table, 2023 data year: by exact age (0–119), for male & female — death probability (qₓ), number of survivors (lₓ), and life expectancy (eₓ). |

## Powers

The **When to Claim Social Security** tool. The survivor column gives the survival
curve needed to weight the early-vs-delayed claiming breakeven by the actual
probability of being alive at each age — turning "the breakeven is 80" into "here's
your chance of living past it."

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
