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

3. **Retirement Monte-Carlo fan chart** — in `BurnRateLab` (fixed-strategy stress test). No new
   data: BurnRateLab already runs the survival MC. New `McFanChart.tsx`: percentile bands
   (10/25/50/75/90) of wealth paths per year as shaded SVG polygons over a canvas path underlay;
   scrubber highlights one path; a "play" button draws paths in via requestAnimationFrame. Teaches
   sequence-of-returns risk. Lib: native Canvas, no dep. (Pairs with the "sequence-of-returns"
   flagship idea below.)

Each ~1 day. Order by wow: treemap and dot-canvas are the biggest "how is this free?" moments.

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
