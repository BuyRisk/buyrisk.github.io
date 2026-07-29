# `ici/` — Investment Company Institute research data

**Source:** Investment Company Institute — <https://www.ici.org/research>
**Terms:** Free for public/educational use **with attribution**; ICI restricts
redistribution of the files, so — like aqr/ and jst/ — raw files are git-ignored
and only reduced, attributed aggregates ship.
**Citation:** Investment Company Institute, *[report title], [year]*, ici.org.

## Why it's here (future "cost of fees" tool)

The evidence behind **the real, declining cost of fund ownership** — average
expense ratios and fee trends — so a tool can show a reader the actual drag fees
put on long-run wealth, using real industry data rather than a made-up number.

## Files (ICI report data workbooks; figure-per-sheet)

| File | Report |
|---|---|
| `per32-08-data.xlsx` (+ supplemental) | *The Economics of Providing 401(k) Plans* (2026) — 401(k) fee trends |
| `per32-01-data.xlsx` | ICI Perspective / fee research (2026) |
| `per31-10-data.xlsx` | ICI Perspective (2025) |
| `25-ira-fees-data.xlsx`, `26-ira-fees-data.xlsx` | IRA fee data (2025, 2026) |

Each workbook is a `.xlsx` read by `scripts/lib/read-xlsx.mjs`; figures live on
`figN` / numbered sheets with a title/units preamble then a `Year | …` table. The
specific **average-expense-ratio-over-time** series (the flagship declining-fee
chart) will be pinpointed and reduced when the fees tool is built.

> Requires the maintained SheetJS build (`xlsx` ≥ 0.20), like the AQR files.
