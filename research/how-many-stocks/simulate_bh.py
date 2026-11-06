"""Stage 2: buy-and-hold Monte Carlo, one row of statistics per (start, H, N, variant).

At each quarter-end start date t, the cohort is every stock with a row and a
market cap at t. Each draw is a random ordering of the cohort; the first N
names of that ordering are the N-stock portfolio, so every N comes from the
same 5,000 orderings (common random numbers, nested portfolios). Equal dollar
amounts are bought at t and never traded. A delisted holding's proceeds are
parked (T-bills by default) until t + H.

With proceeds parked in an asset common to all stocks, a random portfolio's
expected terminal wealth equals the cohort's equal-weighted buy-and-hold
terminal wealth exactly. So the mean shortfall against that benchmark is zero
by construction (a check), and any systematic shortfall shows up only in the
median and in P(underperform).

Variants share the draws within a start date:
  base      Shumway imputation, T-bill parking, all stocks
  m30/m100  imputation -30% / -100% on every exchange
  park_mkt  proceeds parked in the value-weighted universe
  liquid    price >= $1 and cap >= the cohort's 5th percentile at t (own draws)
"""
import sys
import time

import numpy as np
import pandas as pd
from scipy.special import gammaln

import common as C

VARIANTS = (("base", "shumway", "tbill", "all"), ("m30", "m30", "tbill", "all"),
            ("m100", "m100", "tbill", "all"), ("park_mkt", "shumway", "mkt", "all"),
            ("liquid", "shumway", "tbill", "liquid"))


def p_any_top(n, k, N):
    """P(at least one of k marked names among N drawn from n without replacement)."""
    N = np.asarray(N, float)
    out = np.where(N > n - k, 1.0, 0.0)
    ok = N <= n - k
    lg = gammaln(n - k + 1) - gammaln(n - k - N[ok] + 1) - gammaln(n + 1) + gammaln(n - N[ok] + 1)
    out[ok] = 1 - np.exp(lg)
    return out


def arg(flag, default):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


def main(quick=False):
    """Options: --panel NAME (CACHE/NAME.npz, default panel), --from / --to YYYY-MM (start-date
    range), --every K (every K-th start), --draws D, --out NAME (OUTPUT/NAME.parquet)."""
    pname = arg("--panel", "panel")
    z = np.load(C.CACHE / f"{pname}.npz")
    CL, cap, listed, death = z["CL"], z["cap"], z["listed"], z["death"]
    prc = z["prc"] if "prc" in z.files else None      # Datastream panels: no price test in "liquid"
    imp_flag, imp_exch = z["imp_flag"], z["imp_exch"]
    m0 = int(z["m0"]) if "m0" in z.files else 0
    base_imp = str(z["base_impute"]) if "base_impute" in z.files else "shumway"
    variants = [(v, base_imp if imp == "shumway" else imp, pk, un) for v, imp, pk, un in VARIANTS]
    lab = lambda t: C.month_label(t + m0)  # noqa: E731
    M = CL.shape[1]
    park = {"tbill": np.r_[0.0, np.cumsum(np.log1p(z["rf"][1:]))],
            "mkt": np.r_[0.0, np.cumsum(np.log1p(z["mkt"][1:]))]}
    imp_lg = {k: np.log(np.maximum(1 + np.array([v[e] for e in imp_exch]), C.LOG_FLOOR)) * imp_flag
              for k, v in C.IMPUTE.items()}
    rng = np.random.default_rng(C.SEED)
    lo, hi = arg("--from", "0000-00"), arg("--to", "9999-99")
    starts = [t for t in range(6, M - 12) if lab(t)[5:] in ("03", "06", "09", "12") and lo <= lab(t) <= hi]
    starts = starts[::int(arg("--every", 20 if quick else 1))]
    draws = int(arg("--draws", 1000 if quick else C.DRAWS))
    rows = []
    tic = time.time()
    for j, t in enumerate(starts):
        alive = listed[:, t] & (cap[:, t] > 0) & (death > t)
        coh = {"all": np.flatnonzero(alive)}
        c_all = cap[coh["all"], t]
        liq = c_all >= np.percentile(c_all, 5)
        if prc is not None:
            liq &= prc[coh["all"], t] >= 1
        coh["liquid"] = coh["all"][liq]
        for uname, idx in coh.items():
            n = len(idx)
            grid = C.N_GRID[C.N_GRID <= n // C.UNIVERSE_FRACTION]
            nmax = int(grid.max())
            # random ordering, truncated at nmax: argpartition on uniform keys then sort
            sel = np.empty((draws, nmax), np.int32)
            for c0 in range(0, draws, C.CHUNK):
                keys = rng.random((min(C.CHUNK, draws - c0), n), dtype=np.float32)
                part = np.argpartition(keys, nmax - 1, axis=1)[:, :nmax]
                order = np.argsort(np.take_along_axis(keys, part, 1), axis=1)
                sel[c0:c0 + len(keys)] = np.take_along_axis(part, order, 1)
            vw = cap[idx, t] / cap[idx, t].sum()
            for vname, imp, pk, un in variants:
                if un != uname:
                    continue
                for H in C.HORIZONS:
                    e = t + 12 * H
                    if e > M - 1:
                        continue
                    d = death[idx]
                    died = (d > t) & (d <= e)
                    lw = CL[idx, e] - CL[idx, t]
                    lw = lw + np.where(died, imp_lg[imp][idx] + park[pk][e] - park[pk][np.minimum(d, e)], 0)
                    W = np.exp(lw)
                    b_ew, b_vw = W.mean(), (vw * W).sum()
                    k = max(1, int(np.ceil(0.01 * n)))
                    top = np.zeros(n, bool)
                    top[np.argpartition(-W, k - 1)[:k]] = True
                    G = W[sel]
                    Wp = np.cumsum(G, axis=1)[:, grid - 1] / grid
                    hit = np.maximum.accumulate(top[sel], axis=1)[:, grid - 1]
                    rel = (Wp / b_ew) ** (1 / H) - 1
                    q = np.percentile(rel, C.PCTS, axis=0)
                    rows.append(pd.DataFrame({
                        "t": t + m0, "start": lab(t), "H": H, "variant": vname, "n_alive": n, "N": grid,
                        "p_under_ew": (Wp < b_ew).mean(0), "p_under_vw": (Wp < b_vw).mean(0),
                        "mean_wealth_ratio_ew": Wp.mean(0) / b_ew,
                        **{f"rel_ew_p{p}": q[i] for i, p in enumerate(C.PCTS)},
                        "rel_vw_p50": np.percentile((Wp / b_vw) ** (1 / H) - 1, 50, axis=0),
                        "top1_hit": hit.mean(0), "top1_hit_theory": p_any_top(n, k, grid),
                        "bench_ew_ann": b_ew ** (1 / H) - 1, "bench_vw_ann": b_vw ** (1 / H) - 1,
                        "share_delisted": died.mean(),
                    }))
        if j % 20 == 0:
            print(f"{lab(t)}  n={len(coh['all'])}  {time.time() - tic:.0f}s", flush=True)
    out = pd.concat(rows, ignore_index=True)
    default = "bh_stats" if pname == "panel" else f"bh_stats_{pname.removeprefix('panel_')}"
    name = arg("--out", default + ("_quick" if quick else "")) + ".parquet"
    out.to_parquet(C.OUTPUT / name)
    print(f"wrote {name}: {len(out):,} rows, {len(starts)} start dates, {time.time() - tic:.0f}s")


if __name__ == "__main__":
    main(quick="--quick" in sys.argv)
