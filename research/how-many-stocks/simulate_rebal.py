"""Stage 3 (robustness): monthly-rebalanced equal-weight portfolios.

Annual starts (each December), 1,000 draws, the reporting N grid. A
portfolio is reset to equal weights across its surviving holdings every
month; a delisted name drops out after its final (delisting) return, and a
portfolio with no survivors earns T-bills. The benchmark is the cohort
rebalanced the same way, so like is compared with like: measuring a
buy-and-hold portfolio against a rebalanced index would credit the
rebalancing return to skewness.
"""
import time

import numpy as np
import pandas as pd

import common as C

DRAWS = 1000
CH = 50


def main():
    z = np.load(C.CACHE / "panel.npz")
    ret, cap, listed, death, rf = z["ret"], z["cap"], z["listed"], z["death"], z["rf"]
    imp_flag, imp_exch = z["imp_flag"], z["imp_exch"]
    M = ret.shape[1]
    imp = np.array([C.IMPUTE["shumway"][e] for e in imp_exch]) * imp_flag
    rng = np.random.default_rng(C.SEED + 1)
    starts = [t for t in range(12, M - 12) if C.month_label(t).endswith("-12")]
    rows, tic = [], time.time()
    for t in starts:
        idx = np.flatnonzero(listed[:, t] & (cap[:, t] > 0) & (death > t))
        n = len(idx)
        grid = np.array([g for g in C.N_REPORT if g <= n // C.UNIVERSE_FRACTION])
        Hs = [H for H in C.HORIZONS if t + 12 * H <= M - 1]
        T = 12 * max(Hs)
        mon = np.arange(t + 1, t + T + 1)
        d = death[idx][:, None]
        a = (mon[None, :] <= d)
        r = np.nan_to_num(ret[idx][:, mon].astype(np.float64), nan=0.0)
        last = (mon[None, :] == d)
        r = np.where(last, (1 + r) * (1 + imp[idx][:, None]) - 1, r)
        r = np.where(a, r, 0.0).astype(np.float32)
        a = a.astype(np.float32)
        bench = np.where(a.sum(0) > 0, r.sum(0) / np.maximum(a.sum(0), 1), rf[mon])
        lb = np.cumsum(np.log1p(bench))
        Wp = np.empty((DRAWS, len(grid), len(Hs)))
        for c0 in range(0, DRAWS, CH):
            keys = rng.random((CH, n), dtype=np.float32)
            nmax = grid.max()
            part = np.argpartition(keys, nmax - 1, axis=1)[:, :nmax]
            sel = np.take_along_axis(part, np.argsort(np.take_along_axis(keys, part, 1), 1), 1)
            sr = np.cumsum(r[sel], axis=1)[:, grid - 1]          # (CH, ng, T)
            sa = np.cumsum(a[sel], axis=1)[:, grid - 1]
            pr = np.where(sa > 0, sr / np.maximum(sa, 1), rf[mon][None, None, :])
            lp = np.cumsum(np.log1p(np.maximum(pr, -1 + C.LOG_FLOOR)), axis=2)
            Wp[c0:c0 + CH] = np.exp(lp[:, :, [12 * H - 1 for H in Hs]])
        for h, H in enumerate(Hs):
            wb = np.exp(lb[12 * H - 1])
            rel = (Wp[:, :, h] / wb) ** (1 / H) - 1
            q = np.percentile(rel, C.PCTS, axis=0)
            rows.append(pd.DataFrame({"t": t, "start": C.month_label(t), "H": H, "n_alive": n, "N": grid,
                                      "p_under_ew": (Wp[:, :, h] < wb).mean(0),
                                      **{f"rel_ew_p{p}": q[i] for i, p in enumerate(C.PCTS)},
                                      "bench_ew_ann": wb ** (1 / H) - 1}))
        if t % 120 == 0:
            print(C.month_label(t), n, f"{time.time() - tic:.0f}s", flush=True)
    out = pd.concat(rows, ignore_index=True)
    out.to_parquet(C.OUTPUT / "rebal_stats.parquet")
    print(f"wrote rebal_stats.parquet: {len(out):,} rows, {len(starts)} starts, {time.time() - tic:.0f}s")


if __name__ == "__main__":
    main()
