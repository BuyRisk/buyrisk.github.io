# Generated data (build output)

Files here are **produced by the reducers in [`/scripts`](../../../scripts)** from
the raw sources in [`data/sources/`](../../../data/sources), not written by hand.
They are small, typed `.ts` modules that the interactive tools import — and,
unlike the raw multi-MB source files, they are the only dataset code that ships
to the browser.

Do not edit these by hand: re-run the matching reducer instead. Each generated
file carries a header comment naming the reducer that produced it and the exact
`npm` command to regenerate it, so its provenance is traceable back to the
primary source.

## Files

| File | Reducer | Regenerate | Powers |
|---|---|---|---|
| `crsp-superstock.ts` | `scripts/reduce-crsp-superstock.mjs` | `npm run data:crsp:superstock` | `/tools/superstocks` |
| `crsp-diversification.ts` | `scripts/reduce-crsp-diversification.mjs` | `npm run data:crsp:diversification` | `/tools/how-many-stocks` |

Both derive from the **licensed** CRSP pull (`data/sources/crsp/`, git-ignored):
they contain only universe-level AGGREGATES (shares, mean/median, bucket counts,
a correlation, a volatility-vs-N curve), never a per-stock row, so they are safe
to ship. Run `npm run data:crsp` to rebuild both at once. See
[`data/sources/crsp/README.md`](../../../data/sources/crsp/README.md) for the
licence firewall.

## Licence

These files are **not redistributable** — see [`LICENSE`](LICENSE) in this
directory. They are derived from data held under licence, which permits
publishing derived aggregates but not sublicensing them onward, so that right
is not this project's to grant. Read them, audit the reducers, reproduce them
from your own licensed pull — but a fork must delete this directory and
regenerate it.
