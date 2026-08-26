# Buy Risk

Plain-language, evidence-based investing education with interactive tools —
[buyrisk.org](https://buyrisk.org).

The name is the thesis: every real investment return is compensation for
bearing risk. The site teaches the durable, well-supported findings of finance
(risk and return, compounding, diversification, fees, inflation, behaviour) in
plain language, paired with tools that let a reader manipulate the variables
themselves. Everything is educational only — never personalised financial
advice.

## Status

A living project, not a finished textbook. Tools are added and revised often,
and the newest have had the least wear. If you are citing or teaching from
something here, confirm it still says what you expect. Corrections are welcome
and take priority over new features: **buyriskHQ@gmail.com**.

## How it's written

The tools and much of the writing are produced with heavy use of AI
assistance, directed, reviewed, and verified by a human. That is why the
verification below exists and why this source is public. The claim isn't
"trust us", it's "check us".

## Stack

[Astro 5](https://astro.build) (static, islands, zero JS by default) ·
TypeScript in strict mode · React 19 for interactive islands only · plain CSS
with custom properties, no framework · hand-rolled SVG charts, no charting
library.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # astro check (typecheck) + production build to dist/
npm run preview  # serve the production build
```

## Where the numbers come from

Every simulation runs on real data. Sources are pulled, then reduced to the
small aggregates the site needs by scripts in `scripts/`, whose committed
outputs live in `src/data/generated/`. Any figure on the site traces back to a
published dataset.

| Source | Used for |
|---|---|
| Aswath Damodaran (NYU Stern) | long-run US stock/bond/bill returns and inflation |
| Kenneth R. French data library | daily market returns, factor premia |
| Robert Shiller | CAPE, long monthly series |
| CRSP (licensed) | fund survivorship, fees, concentration, behaviour gap |
| Thomson/Refinitiv s12 (licensed) | fund holdings overlap |
| SSA, IRS, FRED, ICI, SPIVA | benefit formulas, tax parameters, yields, fees |

Two-layer data model: small redistributable sources are committed under
`data/sources/`; large or licensed raw pulls live in a shared local library
outside the repo, located via the `DATA_LIB` environment variable. Reducers
need it; building the site does not, because generated outputs are committed.

## Verification

Where an authoritative reference exists, the engines are tested against it.

```bash
node scripts/verify-ssa-pia.mjs      # vs SSA's published benefit examples
node scripts/verify-tax-engine.mjs   # hand-computed cases + continuity fuzz
```

- **Social Security** — `src/lib/ssaPia.ts` reproduces the SSA's own published
  Case A and Case B worked examples exactly (AIME, bend points, PIA, and the
  final benefit, to the dime).
- **Federal tax** — `src/lib/usTax.ts` is checked against hand-computed cases
  covering every mechanism it models, plus a seeded continuity fuzz proving no
  discontinuity escapes the cliff detector. It was additionally cross-examined
  against an independent spreadsheet implementation of the same law, which is
  how a bug in the senior-deduction phase-out was found and fixed.
- Simpler illustrative tools are ordinary arithmetic, readable in place.

## Licensing

- **Source code** — MIT, see [LICENSE](LICENSE). The grant covers the code in
  this repository only, not the content or data below.
- **Written content** (prose, blog posts, tool copy) — © Buy Risk, all rights
  reserved for now; ask if you'd like to reuse it.
- **Data** — third-party data retains its provider's terms and is *not*
  relicensed here. Licensed sources (CRSP, Thomson) are used under licence and
  only ever appear as derived aggregates, never as redistributable raw records;
  see `data/sources/crsp/README.md` for the firewall this project follows.

## Contributing

Issues and corrections are welcome, especially from classroom use. If a number
looks wrong, please say which tool and what you expected — that is the most
useful bug report this project can get.
