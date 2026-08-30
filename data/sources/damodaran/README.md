# `damodaran/` — Aswath Damodaran's historical return dataset

**Source:** <https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datacurrent.html>
(NYU Stern, updated annually each January).
**Terms:** published free for public use; see the page above for the author's own
statement. Attribute any derived figure.
**Citation:** Damodaran, A. *Annual Returns on Stock, T.Bonds and T.Bills: 1928 –
Current.* NYU Stern School of Business.

## Why it's here

The site's long-run US backbone. `histretSP.xls` gives annual total returns for
**US large-cap stocks, 10-year Treasury bonds, and 3-month T-bills from 1928**,
alongside inflation — the series behind the risk ladder on the homepage, the
historical-returns reference page, and every simulation that needs "what has an
asset class actually paid."

`histimpl.xls` holds Damodaran's **implied equity risk premium** series, the
forward-looking counterpart to the backward-looking returns.

## Files

| File | Contents |
|---|---|
| `histretSP.xls` | Annual returns, 1928–present: S&P 500, T-bonds, T-bills, plus inflation and index levels |
| `histimpl.xls` | Implied equity risk premium by year |

## Format & parsing

Legacy **`.xls`** (BIFF8), read by [`scripts/lib/read-xlsx.mjs`](../../../scripts/lib/read-xlsx.mjs).
The sheets carry several header and footnote rows around the data block, so the
reducers locate the table by label rather than by fixed offset — do not assume a
row index survives next year's update.

Consumed by [`reduce-damodaran-returns.mjs`](../../../scripts/reduce-damodaran-returns.mjs)
and [`reduce-asset-stats.mjs`](../../../scripts/reduce-asset-stats.mjs).

## Committed

Small enough to live in the repo, so the reducers are reproducible from a clean
clone with no external download.
