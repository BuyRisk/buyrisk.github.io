# `shiller/` — Robert Shiller's long-run market data

**Source:** <http://www.econ.yale.edu/~shiller/data.htm> (Yale University).
**Terms:** published free for public use; see the page above. Attribute any
derived figure.
**Citation:** Shiller, R. J. *Irrational Exuberance*, Princeton University Press
(3rd ed.), online data appendix. The housing series is the Case-Shiller index as
distributed in `chapt26.xlsx`.

## Why it's here

The longest continuous series the site uses: **monthly US stock prices,
dividends, earnings, and the CPI back to 1871**, plus the long interest-rate
series. It is the only source here that reaches before 1900, and it is where the
**CAPE ratio** comes from — the cyclically adjusted price-to-earnings measure on
the market-valuations page.

## Files

| File | Contents |
|---|---|
| `ie_data.xls` | *Irrational Exuberance* dataset: monthly S&P composite price, dividend, earnings, CPI, long rate, and the computed CAPE, 1871–present |
| `chapt26.xlsx` | Long-run real US home price index (Case-Shiller historical extension) |

## Format & parsing

Legacy Excel, read by [`scripts/lib/read-xlsx.mjs`](../../../scripts/lib/read-xlsx.mjs).
Two traps worth knowing:

- The date column is a **decimal year** where the fractional part encodes the
  month as hundredths — `1871.10` is October 1871, not "early 1871". Parsing it
  as a float and multiplying by 12 gives the wrong month.
- The site does **not** compute CAPE itself — it reads Shiller's own
  precomputed `Cyclically Adjusted PE Ratio` column (index 12). The most recent
  rows often carry a current price with that column left blank, because the
  trailing earnings aren't in yet, so the reducer skips any row whose CAPE is
  not a positive finite number. Don't "fix" those blanks by carrying the last
  value forward.

Consumed by [`reduce-cape.mjs`](../../../scripts/reduce-cape.mjs),
[`reduce-shiller-monthly.mjs`](../../../scripts/reduce-shiller-monthly.mjs), and
[`reduce-housing.mjs`](../../../scripts/reduce-housing.mjs).

## Committed

Both files are committed; the dataset is updated by its author irregularly, so
refresh by re-downloading and overwriting in place.
