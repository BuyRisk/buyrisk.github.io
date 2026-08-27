# Buy Risk

Plain-language, evidence-based investing education with interactive tools —
[buyrisk.org](https://buyrisk.org).

The name is the thesis: every real investment return is compensation for
bearing risk. The site teaches the durable, well-supported findings of finance
(risk and return, compounding, diversification, fees, inflation, behavior) in
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
| CRSP (licensed) | fund survivorship, fees, concentration, behavior gap |
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

Public so it can be audited; not licensed for commercial reuse. Three layers,
each with its own file:

| What | Licence |
|---|---|
| **Source code** — components, libs, reducers, build tooling | [PolyForm Noncommercial 1.0.0](LICENSE) |
| **Written content** — prose, curriculum, tool copy, blog posts | [CC BY-NC-SA 4.0](CONTENT-LICENSE.md) |
| **Generated datasets** — `src/data/generated/` | [Not redistributable](src/data/generated/LICENSE) |

In practice: read it, run it, fork it, teach from it, check our arithmetic —
all fine, and the reason the repo is public at all. Educational institutions
are explicitly covered by both licences. Selling it, running it with ads, or
putting it behind a paywall is not.

The generated datasets are the one hard stop. They are aggregates derived from
data held under licence (CRSP, Thomson/Refinitiv, Petajisto), which permits
publishing derived summaries but not sublicensing them onward — so that right
is not ours to grant. Read them and reproduce them from your own licensed
pull; don't redistribute them. A fork should delete that directory and
regenerate it.

Third-party data always retains its provider's terms and is never relicensed
here; licensed sources appear only as derived aggregates, never as raw records
(see `data/sources/crsp/README.md` for the firewall).

The name **Buy Risk**, the domain, and the visual identity are reserved and not
licensed. A fork must not present itself as Buy Risk.

Commercial licensing or anything the above doesn't cover: **buyriskHQ@gmail.com**.

Repository releases made before 2026-08-26 were published under MIT; that grant
is not revoked for the commits it covered.

## Contributing

Issues and corrections are welcome, especially from classroom use. If a number
looks wrong, please say which tool and what you expected — that is the most
useful bug report this project can get.
