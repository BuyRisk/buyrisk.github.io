# Future work — ideas backlog

Potential tools and polish upgrades, logged 2026-08-18. North star: so
effective and polished that people are amazed it's free. Not a commitment
list — pull from it as tools progress.

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
