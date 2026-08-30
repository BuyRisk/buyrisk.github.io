# `crsp/` — CRSP US Stock Database (via WRDS) — **LICENSED, DO NOT SHIP**

> ⚠️ **This is the one provider whose raw data is not free to redistribute.**
> CRSP is a paid subscription accessed through WRDS. The WRDS license lets *you*
> compute with the data; it does **not** let you republish row-level CRSP data on
> a public website. So this folder breaks the project's usual "commit the raw
> source" rule on purpose.

**Source:** CRSP US Stock Database, via WRDS — <https://wrds-www.wharton.upenn.edu/>
(Northwestern faculty access.)
**Citation for any figure derived from it:** "Calculated from CRSP data, © Center
for Research in Security Prices, LLC, via WRDS."

## The license firewall (how this stays legal *and* reproducible)

```
scripts/pull/crsp-monthly.py      ← committed (the query; no data)
        │  run on a WRDS machine
        ▼
data/sources/crsp/crsp_monthly.csv       ← GIT-IGNORED (raw licensed rows — local only)
data/sources/crsp/crsp_monthly.manifest.json  ← committed (provenance: dates, counts, filters)
        │  scripts/reduce-crsp-*.mjs (build-time)
        ▼
src/data/generated/crsp-*.ts      ← committed & shipped (a few dozen AGGREGATE numbers)
```

`.gitignore` in this folder enforces it: everything is ignored except the README,
the manifest, and the gitignore itself. **Anyone with WRDS access can reproduce
every CRSP-derived number** by re-running the pull + reducer; nobody without it
ever receives licensed rows. That satisfies both the license and the site's
evidence-based, reproducible-from-source ethos.

**Rule of thumb for what may ship:** highly aggregated statistics computed *across*
the universe (percentiles, counts per bucket, an average correlation, a
volatility-vs-N curve). **Never** a per-`permno` series, a per-stock return, or
anything that reconstructs an identifiable security's history.

## Pulling the data

```bash
pip install wrds pandas pyarrow
python scripts/pull/crsp-monthly.py --user <your_wrds_netid>
```

The script pulls a deliberately narrow slice — monthly total returns for **US
common stock** (share codes 10/11) on **NYSE/AMEX/NASDAQ** (exchange codes 1/2/3),
**delisting-adjusted**, plus **market equity** — keyed only by `permno` and date.
That is the exact universe behind the two CRSP-dependent tools below. It writes
`crsp_monthly.csv` (local) and `crsp_monthly.manifest.json` (committed).

### Two query paths — CIZ is primary, SIZ is the legacy fallback

CRSP has migrated from its classic **SIZ** format to a new flat **CIZ**
("Version 2") format. On the current WRDS vendor page the SIZ Stock/Index data
sits under **"Legacy … no longer updated"**, while the Annual/Monthly Updates
now ship **"Stock - Version 2 (CIZ)"**. So CIZ is the one to build on; SIZ stays
only as a cross-check. The pull script carries both:

| Flag | Tables | Notes |
|---|---|---|
| `--format ciz` (default) | `crsp.msf_v2` | The maintained format. `mthret` already includes the delisting adjustment, and common-stock filtering uses descriptor fields (`sharetype`/`securitytype`/`securitysubtype`/`issuertype`/`usincflg`/`primaryexch`) instead of `shrcd`/`exchcd`. Returns are **decimal** (0.0289), not percent. |
| `--format siz` | `crsp.msf` + `crsp.msenames` + `crsp.msedelist` | Legacy but rock-solid and universally documented — a good sanity check. Delisting return joined from `msedelist`; filter on `shrcd IN (10,11)` + `exchcd IN (1,2,3)`. |

Both emit the **same four output columns** (`permno, date, ret_adj, me_musd`), so
the reducers downstream don't care which you used — handy for verifying CIZ
reproduces the SIZ numbers within rounding.

**Confirm the columns first.** CIZ field names have shifted between releases, so
before the real pull run:

```bash
python scripts/pull/crsp-monthly.py --user <netid> --describe
```

That prints the live columns of `msf_v2` (and the SIZ tables) on your vintage;
adjust the `SELECT` if any name differs, then pull.

### Delisting returns (the subtle, load-bearing detail)

Survivorship bias is the whole point of the Superstock tool, so the pull is
delisting-adjusted: `adjret = (1+ret)(1+dlret) − 1` in the delist month. A known
refinement (Shumway 1997) sets a −30% return for performance-related delistings
with a missing `dlret`; it's included in the script, commented out, so you can
toggle it and show students how much survivorship correction moves the result.

### Refreshing / pinning a vintage

CRSP updates annually (plus WRDS monthly current-edge updates). Re-run the pull to
refresh; the manifest records the pull date, row/permno counts, date span, and the
exact query, so every shipped figure is pinned to a reproducible vintage. The
generated `.ts` files should copy `asOf` from the manifest into their header.

## What the tools consume (the aggregates to ship)

Neither tool needs raw returns in the browser — each needs a short vector of
summary numbers. Reducers (`scripts/reduce-crsp-*.mjs`) compute these and emit
`src/data/generated/crsp-*.ts`. Rebuild both with **`npm run data:crsp`** after
a fresh pull:

| Tool | Generated file | Aggregates (all universe-level, license-safe) |
|---|---|---|
| **The Superstock Problem** (`/tools/superstocks`) | `crsp-superstock.ts` | share of stocks whose lifetime buy-&-hold **beat one-month T-bills**; share that **lost money**; **mean vs median** lifetime return (the skew); a **bucketed histogram** (counts per return bucket) of lifetime returns; share of **aggregate net wealth creation** from the top 1%/5%/10% of stocks. |
| **How Many Stocks Is Enough?** (`/tools/how-many-stocks`) | `crsp-diversification.ts` | **average single-stock volatility**, **average pairwise correlation**, and the empirical **portfolio-volatility-vs-N curve** (equal-weight, N = 1…~500) with its **systematic floor**. |

Both currently run on parametric/illustrative models. The CRSP aggregates become
the *real-data anchor* those tools cite ("across all US common stocks since 1926,
X% failed to beat T-bills"), while the interactive model stays the thing students
play with. Everything shipped is a few dozen numbers — no licensed rows leave the
machine.
