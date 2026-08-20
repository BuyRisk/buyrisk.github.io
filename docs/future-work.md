# Future work — ideas backlog

Potential tools and polish upgrades, logged 2026-08-18. North star: so
effective and polished that people are amazed it's free. Not a commitment
list — pull from it as tools progress.

## Active builds — Mind-the-Gap batch (started 2026-08-19)

Cross-workstation note: generated `src/data/generated/*.ts` are committed, so the
site builds on either machine without re-running reducers. To RE-RUN a reducer
(e.g. after changing it), set the shared data library first:
`$env:DATA_LIB = "E:\Finance\data\sources"` (per-machine path) then `npm run data:<name>`.
Keep adding heavy viz libs per-flagship, not site-wide (see strategy note below).

**DONE (this batch):**
- ✅ **Behavior-gap ↔ Morningstar citation.** Added `morningstarMindTheGap2026` to
  `src/data/citations.ts` + the behavioral-finance Sources; the "In real funds" tab now
  notes our CRSP US-equity gap (~0.5pp) matches Mind the Gap 2026 (~1.2pp across all types).
- ✅ **Native "gap by fund type" chart.** `reduce-behavior-gap.mjs` now tags each fund by
  CRSP objective code (ED[YC]=US equity, EDS=sector, EF=international, I=bond) and emits
  `byCategory` (median per-fund gap per group). `GapByTypeChart` in `BehavioralLab.tsx` renders
  it under "The gap depends on what you own." Verified: Bond 0.14 < US equity 0.33 <
  International 0.95 < Sector equity 1.14 pp/yr. Headline stats unchanged (equity-only subset).

**NEXT — three advanced-viz flagships (build-ready specs):**

1. ✅ **Concentration treemap** — SHIPPED. `TREEMAP_SNAPSHOTS` in the reducer (99 year-ends
   1928→2026, top-30 + "other"; blank early-era tickers backfilled from each permno's
   latest-known symbol — 1950 shows GM 13.6%, XOM 9.3%). `ConcentrationTreemap.tsx`: hand-rolled
   squarified layout (no dep), HTML tiles with CSS transitions, year scrubber + play button,
   hover, color-mix() tint off theme tokens (dark-mode verified). Third view ("Treemap") inside
   IndexConcentrationLab.

2. ✅ **Bessembinder dot-canvas** — SHIPPED. `SuperstockDots.tsx` (canvas, no dep) replaces the
   universe bar-histogram in SuperstockLab: each of the 3,000 inverse-CDF-sampled stocks is a dot
   (red lost money / grey trailed T-bills / green beat / gold glow ≥200× superstocks), stacked into
   a dot-mountain on the log axis with break-even/T-bill/market-avg reference lines. New "🎲 Draw n
   stocks again" lottery rings the reader's picks and gives a basket verdict ("no superstocks — the
   market's 650× average is carried by gold dots you missed"). Theme-aware via CSS tokens read at
   draw time + a data-theme MutationObserver. The ensemble MC histogram below is unchanged.

3. ✅ **Retirement MC fan chart** — SHIPPED. The stress-test FanChart (both fixed and guardrails
   views) now carries an animated canvas "spaghetti" overlay: ~140 sampled histories (strided
   across the sorted-by-ending spectrum) draw in left-to-right over ~2.6s, failures turning red
   as they die at $0; "▶ Replay 140 lives" button. rAF with a setTimeout fallback so hidden tabs
   still get the finished frame. `StressResult.samplePaths` feeds it (balances under fixed,
   spending under guardrails).

**Mind-the-Gap batch complete (2026-08-19):** all three flagships + the two behavior-gap
extensions shipped.

4. ✅ **Survivorship + persistence** — SHIPPED 2026-08-19. SpivaLab now has three modes:
   "The scorecard" (SPIVA, unchanged) / "The graveyard" / "Do winners repeat?".
   `reduce-fund-survivorship.mjs` (`data:fund-survivorship`) streams crsp_mf: **54% of 39k
   equity share classes since 1991 are dead**; survivors 8.8%/yr vs all 5.8%/yr = **+3.0pp
   survivorship mirage**; survival curve 76/56/45/35% at 5/10/15/20y. Persistence (SPIVA
   Persistence method, 6 five-year window pairs, 41,670 fund-windows, non-index only):
   top-quartile repeats **29%** (chance 25%), falls to the bottom 24%, bottom-quartile
   disappears 39%. Survival staircase + 4×5 transition heat-grid.

5. ✅ **Loads & 12b-1** — SHIPPED 2026-08-19. FeesLab's third mode "The fees you don't see":
   `reduce-fund-loads.mjs` (`data:fund-loads`) streams crsp_mf Fund Summary (actual_12b1,
   unit-normalized fraction/percent/bps) + Rear Loads schedules (types C/D, worst first-year
   CDSC). Findings (US equity share classes, 1992–2022): 12b-1 peaked 2005 at **62% of classes
   (median 0.65%/yr)** → 33% (0.25%) by 2022; back-end loads 30%→6%. Series trimmed to
   1992–2022 (12b-1 reporting starts ~1992; 2023+ panel/schedule truncation artifacts).
   **⚠ Front Loads.csv in the library is a 2004–2012 PARTIAL pull (12k rows)** — front-load
   time series deferred until re-pulled (Rear Loads is complete, 1961→2026); the front load
   appears as the canonical $10,000→$9,425 worked example meanwhile.

6. ✅ **Fund overlap X-ray** — SHIPPED 2026-08-19. ClosetIndexingLab now has two modes:
   "The fee X-ray" (existing Petajisto fee-on-active-share math) / "The overlap X-ray".
   `reduce-fund-overlap.mjs` (`data:fund-overlap`) pipelines Thomson s12: type1 picks the 12
   largest active US equity funds at the latest rdate (2025-12-31; index vehicles excluded by
   name incl. Thomson truncations "…IND"/"…IN"), type3 (9GB streamed) their holdings, type2
   quarter-end prices → weights; CRSP S&P 500 constituent caps same day → index weights
   (CUSIP-8 join). Overlap(i,j)=Σmin(wᵢ,wⱼ). Findings: **median pairwise overlap 34%, max
   65%; S&P overlap 17–55%**. UI: fund dropdown → bar list vs the other 11 + pinned S&P row;
   copy: "one bet wearing two names", averaging managers = an expensive index fund. Only
   names + summary stats ship (Thomson licence).

Next candidates: front-load series once Front Loads.csv is re-pulled; the s34 13F data
(institutional-ownership angles) and N-PORT once parsed; or polish-stack items below.
**The original 10-idea data-tool backlog is now fully built or resolved.**

## New tools — from datasets already pulled (in the shared library)

| Idea | Data | Why |
|---|---|---|
| **Fund X-ray** — what a fund *actually* holds; overlap between "different" funds | thomson_s12 + mflinks | Strongest unbuilt tool; nobody offers it free |
| Liquidity factor lens for Factor Lab | pastor-stambaugh | Cost of trading illiquid assets |
| 12b-1 fee archaeology — where hidden fund fees go | nsar (SEC filings) | Deepens Fees tool |
| Index reconstitution effects (adds/drops, front-running) | Russell | Why indexing quietly leaks |
| Dow vs S&P: price-weighting distortions | djia | Small explainer |
| Extend Closet Indexing with fuller Notre Dame panel | activeshare_nd | Easy win |

## New tools — no new data needed

| Idea | Data | Why |
|---|---|---|
| **Sequence-of-returns risk** — same avg return, different order, wildly different retirements | Shiller/French (have) | Core curriculum gap; flagship candidate |
| Monte Carlo "twin lives" — identical savers, different start decades | Shiller (have) | Visceral luck-vs-skill lesson |
| Correlation breakdown — diversification failing in 2008/2020 | French daily (have) | Honest caveat to diversification story |
| Leverage / volatility drag — why 2x funds don't 2x returns | French daily (have) | Common real-world trap |
| "What's a fair price?" — DCF slider, tiny assumption changes swing value | none | Pairs with CAPE tool |

## Candidate flagship — Workplace plan simulator ("Sort by Fees, Not Performance")

Logged 2026-08-20. From the in-progress research paper of the same name
(capitulation project). Lets someone experience the choice their 401(k)/403(b)
screen actually presents, then shows what each sorting rule would have done over
a career. Educational only, never personalized advice.

**⚠️ LICENSING — non-negotiable.** All evidence derives from **CRSP** (licensed,
local-only). Ship **derived aggregates only** — quantiles, win rates, decay-curve
tables, dispersion series. Never fund-level rows, never anything from which a
fund's CRSP record could be reconstructed. Same rule the existing labs follow
(reducers read DATA_LIB → `src/data/generated/*.ts`). See [[data-lib-path-this-machine]]
convention and the CRSP firewall in `data/sources/crsp/README.md`.

**Evidence (research repo, NOT in this repo):**
- `E:\Finance\Capitulation\pilot\output\` — `s41_A_fee_dispersion.csv`,
  `s41_B_fee_decile_gradient.csv`, `s47_ties_and_skewness.csv` (win rates, ties,
  mean/median/skew, quartiles by menu size & horizon), `s48_breakeven.csv`
  (gross edge vs fee penalty), `s49_decay_curve.csv` (decay to 20y, two reinvest
  rules). Sim draws: `pilot\cache\s45_menu_draws.parquet`, `s49_long_horizon.parquet`.
- Plan menu specimen: `E:\Finance\research-agenda\plan_menu_2026-08-19.csv`
  (a real US university 403(b) equity lineup).
- Paper docs live in the claude.ai project "Active share/closet indexing/
  capitulation study".

**Provisional findings (do NOT publish numbers until caveats clear):**
Simulated ~125k realistic menus from the survivor-bias-free CRSP mutual-fund
universe (1990–2025), 3/5/10 funds/category asset-weighted; rules = pick cheapest
vs pick best trailing-12m return.
1. Sorting by recent return raises the *mean* outcome but lowers the *typical*
   one — fee rule is higher at every quantile (menu 10, 5y: p25 +14.7/med +50.8/
   p75 +91.8 vs +11.6/+48.6/+89.3), means near-identical (58.9 vs 58.6). The
   return rule is a lottery: its mean lives past the 75th percentile.
2. The hot fund's edge decays (~51bp/yr at 1y in a 3-fund menu → ~14bp at 5y →
   ~0/negative in big menus); the fee penalty (49–65bp) is forever.
3. Coin flip: hot pick beats cheapest *before fees* in only 51.5–53.6%.
4. Bigger menus make chasing worse (hottest-of-ten is a more extreme/noisier draw).
5. Fee dispersion has NOT compressed: within-category p90–p10 was 84bp (1990),
   93bp (2025), even as median fee fell ~150→~90bp; specimen shows 55–77bp in 2026.
6. In ~10–35% of menus both rules pick the SAME fund (more in small menus) — show
   it honestly; it's why the difference isn't universal.

**Caveats blocking publication:** raw (not risk-adjusted) returns — hot pick is
high-beta/momentum, CAPM adjustment pending; Stage 49 (20y horizons) unread;
mixed aggregation conventions (use **year-weighted**); 7.3% of forward windows
incomplete (fix pending, helps the conclusion).

**Design — three screens:**
1. *"Your plan."* Reproduce the real interface incl. its tab order (Avg Annual
   Total Returns | Cumulative | Daily Quotes | **Fees** | Restrictions — fees
   fourth, behind daily NAV). Load the shipped specimen or type your own funds.
   Let them choose without nagging.
2. *"What you would have chosen."* Re-sort by fee; show what changes; report the
   tie case honestly.
3. *"Twenty years later."* Outcome distribution per rule (fan/histogram) with
   p25/median/p75 marked and the **mean marked separately** so the divergence
   shows — the mean belongs to someone else. Then the decay curve: gross edge
   falling to the axis, fee line flat, area between shaded.

**Build notes:** Astro 5 + React island, hand-rolled SVG. Ship precomputed
aggregate tables; the browser interpolates, it does not simulate. Reuse the
retirement Monte Carlo fan chart if it fits. Tone: no scolding — the screen is
the problem, not the reader. Add standing disclaimer + link to the paper once it
exists.

## Polish stack (memorability / "how is this free?")

**Motion & feel (biggest wow-per-hour)**
- Framer Motion — springy tabs, count-up numbers, charts that draw themselves.
- Scroll-driven storytelling (Scrollama / CSS scroll-timeline) — NYT/Pudding
  style: chart transforms as you scroll a narrative.

**Chart depth**
- D3 for flagship charts — drag a frontier point, scrub a recession, brush a century.
- Canvas/WebGL (regl) — 20k hoverable fund dots; SVG chokes past ~2k elements.

**Delight details**
- Lottie / fine SVG micro-illustrations that react to inputs.
- canvas-confetti on "your plan works" moments.
- Subtle optional sound (Howler) — slider ticks, insight chimes.

**Amazement infrastructure**
- Web Workers — sims off the main thread; instant sliders at any size. Cheapest big win.
- Shareable state in URLs — "look at MY scenario" links.
- html-to-image — "download this chart" button.
- WASM — only if Workers aren't enough for CRSP-scale in-browser sims.

## Strategy note

Pick ONE flagship lesson (sequence-of-returns fits) and build it scroll-driven
with D3 + Motion as the showcase. One jaw-dropper defines the site's
reputation; polishing all ~50 labs equally has diminishing returns.

Current baseline worth preserving: hand-rolled SVG = tiny bundles, no
dependency churn. Add libraries per-flagship, not site-wide.
