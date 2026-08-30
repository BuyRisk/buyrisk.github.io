# `aqr/` — AQR Capital Management data sets

**Source:** <https://www.aqr.com/Insights/Datasets>
**Terms:** Free for research/educational use **with attribution**; AQR's
disclosures restrict redistribution and commercial use. So the raw workbooks are
**git-ignored** (see [`.gitignore`](.gitignore)) and only reduced, attributed
aggregates ship — anyone can re-download the originals to reproduce.

## Files kept (monthly factor series)

| File | Powers / topic | Primary citation |
|---|---|---|
| `Betting Against Beta Equity Factors Monthly.xlsx` | Low-beta anomaly — a critique of CAPM (also bundles MKT/SMB/HML/UMD/RF) | Frazzini & Pedersen (2014), *JFE* 111(1): 1–25 |
| `Quality Minus Junk Factors Monthly.xlsx` | The quality factor | Asness, Frazzini & Pedersen (2019), *Review of Accounting Studies* 24: 34–112 |
| `The Devil in HMLs Details Factors Monthly.xlsx` | A timelier value (HML) construction | Asness & Frazzini (2013), *JPM* 39(4): 49–68 |
| `Value and Momentum Everywhere Factors Monthly.xlsx` | Value + momentum across 8 asset classes/markets | Asness, Moskowitz & Pedersen (2013), *JF* 68(3): 929–985 |
| `Time Series Momentum Factors Monthly.xlsx` | Trend-following / time-series momentum | Moskowitz, Ooi & Pedersen (2012), *JFE* 104(2): 228–250 |
| `Century of Factor Premia Monthly.xlsx` | Factor premia across asset classes since 1926 — the long-run evidence | Ilmanen, Israel, Moskowitz, Thapar & Wang (2021) |

Skipped from the download (reserve/off-theme): the multi-MB **Daily** files, the
**Portfolios** breakdowns, the **Original Paper Data** replication packages, and
the **Commodities**, **Credit Risk Premium**, and **ESG** sets.

## Format & parsing

Each workbook is a normal `.xlsx` read by [`scripts/lib/read-xlsx.mjs`](../../../scripts/lib/read-xlsx.mjs)
(SheetJS). AQR's layout: ~10 preamble rows (title, description, copyright), then a
header row whose first cell is **`Date`**, then monthly rows keyed by an
`MM/DD/YYYY` end-of-month date with **decimal** returns. Each file has several
sheets — the factor series plus `Definition(s)`, `Data Sources`, and
`Disclosures`. A reducer should target the named factor sheet (e.g. `BAB Factors`,
`VME Factors`), find the `Date` header row, and skip trailing blanks.

> Note: these files require the **maintained SheetJS build** (`xlsx` from
> cdn.sheetjs.com ≥ 0.20). The old npm `xlsx@0.18.5` fails to inflate them.
