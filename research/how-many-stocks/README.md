# How many stocks? A Monte Carlo on CRSP

Research code for a planned post: how often does a portfolio of N randomly
chosen US stocks, bought and held for H years, trail the market?

**Status: not for publication.** The outputs are calculated from CRSP data
(licensed through WRDS). No WRDS-derived figure goes on buyrisk.org until the
Northwestern library rules on academic use. So this folder holds code only,
and every script writes to `NSTOCKS_OUT` (default
`E:\Finance\data\derived\how-many-stocks`), which is outside every repo. The
`cache\` there is stock-level and stays licensed even after a ruling.

## Pipeline

| script | does |
|---|---|
| `build_panel.py` | wide stock-by-month arrays; splices delisting returns from `delist.csv` |
| `simulate_bh.py` | buy-and-hold draws, quarterly starts, 5,000 orderings per start, all N from the same orderings |
| `simulate_rebal.py` | monthly-rebalanced robustness, annual starts, 1,000 draws |
| `summarize.py` | averages over start dates, block-bootstrap CIs, tables, charts |

Python env `capit`. Run in order. Total about 30 minutes on the laptop.

### Global extension (Datastream via WRDS Cloud)

| script | does |
|---|---|
| `ds_profile.py` | profiles the month-end pull (aggregates only) and caches it as parquet |
| `build_global.py` | screens Datastream and writes one panel per universe and currency (developed ex-US, all-country, and a US panel used only to check Datastream against CRSP) |
| `simulate_bh.py --panel panel_<name> --from 1990-03` | the same simulation on a Datastream panel |
| `summarize_global.py` | starts from 1990-09, CRSP on the same starts, the US check, tables, charts |

Screens: major security, home-country listing, name keywords, no OTC, trailing
zero-return padding, the Ince-Porter reversal, a +300% monthly cap and a
1,000-fold 60-month run-up screen. The last two are calibrated on the US:
Datastream US against CRSP, linked by CUSIP. Neither materially moves CRSP's
answer, and together they bring Datastream US close to it. The figures stay in
the private study notes until the library rules.
Datastream carries no delisting returns, so the base case uses the last price,
with -30% and -100% on non-merger deaths as sensitivities. All-country results
are in USD: in local currency the equal-weighted benchmark mostly measures
inflation differences.

## Design choices that decide the answer

- **Benchmark:** equal-weighted *buy-and-hold* of every stock alive at the
  start (primary) and the cap-weighted equivalent (secondary). A monthly
  rebalanced EW index earns a rebalancing return no buy-and-hold portfolio can
  earn, so it is used only against rebalanced portfolios.
- **Delisting proceeds** are parked in one-month T-bills to the horizon. With a
  common parking asset the expected terminal wealth of a random portfolio
  equals the EW benchmark exactly, so the mean shortfall is zero by
  construction and the skew shows up in the median and in P(underperform).
- **Missing delisting returns** on performance delistings: -30% NYSE/AMEX,
  -55% Nasdaq (Shumway 1997; Shumway and Warther 1999), with -30% and -100%
  everywhere as sensitivities.
- **Drawable N:** a start date contributes to N only if at least 3N stocks are
  alive, so N = 1,000 uses starts from 1973 on.
