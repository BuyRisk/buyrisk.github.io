"""Stage 4: aggregate across start dates, bootstrap intervals, tables, charts.

Two start-date samples, because a 1,000-stock draw needs >= 3,000 stocks alive:
  modern  quarter-end starts from 1973-03 (after Nasdaq joins CRSP), all N
  full    quarter-end starts from 1926-06, N <= 150 (drawable at every date)
Every statistic is the average over start dates of the within-date value.
Intervals are a moving-block bootstrap over start dates (block = max(H years,
2 years) of starts, 2,000 reps): overlapping windows share returns, so start
dates are not independent.
"""
import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.ticker import PercentFormatter  # noqa: E402

import common as C

REPS = 2000
COLORS = {1: "#2a78d6", 5: "#eb6834", 10: "#1baf7a", 20: "#eda100"}
MARKERS = {1: "o", 5: "s", 10: "^", 20: "D"}
INK, INK2, GRID, SURF = "#0b0b0b", "#52514e", "#e4e3df", "#fcfcfb"
STATS = ["p_under_ew", "p_under_vw", "rel_ew_p50", "rel_ew_p5", "rel_ew_p95", "rel_vw_p50",
         "top1_hit", "top1_hit_theory", "mean_wealth_ratio_ew"]
BOOT = ("p_under_ew", "p_under_vw", "rel_ew_p50")


def samples(d):
    return {"modern": d[d.start >= "1973-03"], "full": d[d.N <= 150]}


def block_boot(T, H, rng, step_months):
    """Index matrix (REPS, T) of a circular block bootstrap over ordered starts.

    Circular, because with 20-year blocks in a 33-year sample a plain moving
    block under-samples both ends and can put the point estimate outside its
    own interval (it did, for the H = 20 cap-weighted rows).
    """
    L = min(max(int(round(12 * max(H, 2) / step_months)), 1), T)
    nb = int(np.ceil(T / L))
    b0 = rng.integers(0, T, size=(REPS, nb))
    return ((b0[:, :, None] + np.arange(L)[None, None, :]) % T).reshape(REPS, -1)[:, :T]


def crossing(Ns, p, level):
    below = np.flatnonzero(p < level)
    return float(Ns[below[0]]) if len(below) else np.nan


def aggregate(d, step_months=3, seed=7):
    """Point estimates and bootstrap CIs per (H, N) for one variant and sample."""
    rng = np.random.default_rng(seed)
    out, cross = [], []
    for H, g in d.groupby("H"):
        piv = {s: g.pivot(index="t", columns="N", values=s).sort_index() for s in STATS if s in g}
        keep = piv["p_under_ew"].notna().all().values          # N drawable at every start in the sample
        Ns = piv["p_under_ew"].columns.values[keep]
        X = {s: v[Ns].values for s, v in piv.items()}
        T = len(piv["p_under_ew"])
        idx = block_boot(T, H, rng, step_months)
        # with one block as long as the sample, every rep is a rotation of the same starts and the
        # interval collapses to the point estimate; report no interval rather than a false zero-width one
        degenerate = min(max(int(round(12 * max(H, 2) / step_months)), 1), T) >= T
        boot = {s: np.stack([X[s][i].mean(0) for i in idx]) for s in BOOT if s in X}
        if degenerate:
            boot = {s: np.full_like(b, np.nan) for s, b in boot.items()}
        no = np.arange(0, T, max(1, 12 * H // step_months))     # non-overlapping starts
        res = pd.DataFrame({"H": H, "N": Ns, "n_starts": T,
                            "first_start": C.month_label(piv["p_under_ew"].index.min()),
                            "last_start": C.month_label(piv["p_under_ew"].index.max()),
                            "n_nonoverlap": len(no)})
        for s, v in X.items():
            res[s] = v.mean(0)
        for s, b in boot.items():
            res[s + "_lo"] = np.percentile(b, 2.5, axis=0)
            res[s + "_hi"] = np.percentile(b, 97.5, axis=0)
        res["p_under_ew_nonoverlap"] = X["p_under_ew"][no].mean(0)
        res["rel_ew_p50_nonoverlap"] = X["rel_ew_p50"][no].mean(0)
        out.append(res)
        for lvl in (0.5, 0.4, 0.3):
            for bench in ("ew", "vw"):
                key = f"p_under_{bench}"
                if key not in boot:
                    continue
                bs = np.array([crossing(Ns, b, lvl) for b in boot[key]])
                hit = ~np.isnan(bs)
                cross.append({"H": H, "benchmark": bench, "level": lvl,
                              "smallest_N": crossing(Ns, X[key].mean(0), lvl),
                              "share_reps_reached": np.nan if degenerate else hit.mean(),
                              "ci_lo": np.percentile(bs[hit], 2.5) if hit.any() else np.nan,
                              "ci_hi": np.percentile(bs[hit], 97.5) if hit.any() else np.nan,
                              "N_max_in_sample": int(Ns.max())})
    return pd.concat(out, ignore_index=True), pd.DataFrame(cross)


def style(ax, ylabel, decimals=0):
    ax.set_xscale("log")
    ticks = [1, 2, 5, 10, 20, 50, 100, 250, 500, 1000]
    ax.set_xticks(ticks)
    ax.set_xticklabels([str(t) for t in ticks])
    ax.minorticks_off()
    ax.grid(True, color=GRID, lw=0.8)
    ax.set_axisbelow(True)
    for sp in ("top", "right"):
        ax.spines[sp].set_visible(False)
    for sp in ("left", "bottom"):
        ax.spines[sp].set_color(INK2)
    ax.tick_params(colors=INK2, labelsize=9)
    ax.set_xlabel("Stocks in the portfolio (N, log scale)", color=INK2, fontsize=9)
    ax.set_ylabel(ylabel, color=INK2, fontsize=9)
    ax.yaxis.set_major_formatter(PercentFormatter(1.0, decimals=decimals))
    ax.set_facecolor(SURF)


CRSP_NOTE = ("Calculated from CRSP data, (c) Center for Research in Security Prices, LLC, via WRDS. "
             "NOT FOR PUBLICATION pending the library ruling.")


def charts(agg, path, title, years, note=CRSP_NOTE):
    fig, axes = plt.subplots(2, 2, figsize=(11, 8), dpi=160)
    fig.patch.set_facecolor(SURF)
    a1, a2, a3, a4 = axes.ravel()
    for H, g in agg.groupby("H"):
        c, mk = COLORS[H], MARKERS[H]
        me = max(1, len(g) // 8)
        kw = dict(color=c, lw=2, marker=mk, ms=4, markevery=me)
        a1.fill_between(g.N, g.p_under_ew_lo, g.p_under_ew_hi, color=c, alpha=0.15, lw=0)
        a1.plot(g.N, g.p_under_ew, label=f"H = {H} years", **kw)
        a2.fill_between(g.N, g.rel_ew_p50_lo, g.rel_ew_p50_hi, color=c, alpha=0.15, lw=0)
        a2.plot(g.N, g.rel_ew_p50, label=f"H = {H} years", **kw)
        a3.plot(g.N, g.rel_ew_p5, label=f"H = {H} years", **kw)
        a3.plot(g.N, g.rel_ew_p95, **kw)
        a4.plot(g.N, g.top1_hit, **kw)
    for ax, y in ((a1, 0.5), (a2, 0.0), (a3, 0.0)):
        ax.axhline(y, color=INK2, lw=1, ls="--")
    style(a1, "P(terminal wealth < equal-weighted benchmark)")
    style(a2, "Median annualized return vs benchmark", decimals=1)
    style(a3, "5th and 95th percentile, annualized vs benchmark")
    a3.set_yscale("symlog", linthresh=0.02)
    a3.yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    style(a4, "Share of portfolios holding at least one top-1% stock")
    for ax, t in zip((a1, a2, a3, a4), ("A. How often a random portfolio trails the market",
                                         "B. The typical (median) shortfall",
                                         "C. The range of outcomes (5th and 95th percentiles)",
                                         "D. Odds of owning a top-1% stock (same for every H)")):
        ax.set_title(t, loc="left", fontsize=10, color=INK)
    for ax in (a1, a2, a3):
        ax.legend(frameon=False, fontsize=8, loc="best")
    fig.suptitle(title, x=0.01, ha="left", fontsize=12, color=INK)
    fig.text(0.01, 0.005, f"Buy-and-hold, equal dollar amounts, quarterly start dates {years}; shaded bands are 95% "
             f"block-bootstrap intervals over start dates.\n{note}", fontsize=6.5, color=INK2)
    fig.tight_layout(rect=(0, 0.035, 1, 0.96))
    fig.savefig(path, facecolor=fig.get_facecolor())
    plt.close(fig)


def fmt_table(agg, Ns=C.N_TABLE):
    t = agg[agg.N.isin(Ns)].copy()
    t["P(under EW) %"] = t.apply(lambda r: f"{100 * r.p_under_ew:4.1f} [{100 * r.p_under_ew_lo:4.1f},{100 * r.p_under_ew_hi:4.1f}]", axis=1)
    t["median rel %/yr"] = t.apply(lambda r: f"{100 * r.rel_ew_p50:+.2f} [{100 * r.rel_ew_p50_lo:+.2f},{100 * r.rel_ew_p50_hi:+.2f}]", axis=1)
    t["p5 / p95 %/yr"] = t.apply(lambda r: f"{100 * r.rel_ew_p5:+5.1f} / {100 * r.rel_ew_p95:+5.1f}", axis=1)
    t["P(under VW) %"] = t.apply(lambda r: f"{100 * r.p_under_vw:4.1f} [{100 * r.p_under_vw_lo:4.1f},{100 * r.p_under_vw_hi:4.1f}]", axis=1)
    t["median vs VW %/yr"] = (100 * t.rel_vw_p50).map("{:+.2f}".format)
    t["top1% hit %"] = (100 * t.top1_hit).map("{:4.1f}".format)
    t["mean W/bench"] = t.mean_wealth_ratio_ew.map("{:.3f}".format)
    cols = ["H", "N", "P(under EW) %", "median rel %/yr", "p5 / p95 %/yr", "P(under VW) %", "median vs VW %/yr",
            "top1% hit %", "mean W/bench"]
    return t[cols].to_string(index=False)


def by_period(b, label_fn):
    rows = []
    for lab, s in label_fn(b):
        g = s[s.N.isin((1, 10, 30, 100, 1000))].groupby(["H", "N"])
        x = pd.DataFrame({"P_ew": 100 * g.p_under_ew.mean(), "med_rel": 100 * g.rel_ew_p50.mean(),
                          "P_vw": 100 * g.p_under_vw.mean() if "p_under_vw" in s else np.nan,
                          "starts": g.t.nunique()})
        x["period"] = lab
        rows.append(x.reset_index())
    return pd.concat(rows).pivot_table(index=["H", "N"], columns="period",
                                       values=["P_ew", "med_rel", "P_vw", "starts"]).round(2)


def periods(b):
    return (("1926-1972", b[(b.start < "1973") & (b.N <= 150)]),
            ("1973-1999", b[(b.start >= "1973") & (b.start < "2000")]),
            ("2000-", b[b.start >= "2000"]))


def main():
    d = pd.read_parquet(C.OUTPUT / "bh_stats.parquet")
    L = ["HOW MANY STOCKS: buy-and-hold Monte Carlo, US common stocks (CRSP), aggregates only",
         "Calculated from CRSP data, (c) Center for Research in Security Prices, LLC, via WRDS.",
         "NOT FOR PUBLICATION until the Northwestern library rules on academic use.",
         "Statistics are averages over start dates of the within-date value; [ ] = 95% block-bootstrap CI.", ""]
    aggs = {}
    for v in d.variant.unique():
        for sname, s in samples(d[d.variant == v]).items():
            aggs[(v, sname)] = aggregate(s)
            aggs[(v, sname)][0].to_csv(C.OUTPUT / f"agg_{v}_{sname}.csv", index=False)
            aggs[(v, sname)][1].to_csv(C.OUTPUT / f"cross_{v}_{sname}.csv", index=False)
    base_m, cross_m = aggs[("base", "modern")]
    base_f, cross_f = aggs[("base", "full")]
    L += ["== Outputs 1, 2, 3, 5, 6: base case, modern sample (quarterly starts 1973-03 on), all N",
          fmt_table(base_m), "",
          "== Same, full history (starts 1926-06 on), N <= 150", fmt_table(base_f, (1, 10, 30, 100)), ""]
    L += ["== Output 4: smallest N with P(underperform) below each level",
          "   (NaN = not reached within the sample's N range; share_reps_reached = bootstrap reps where it is)",
          "modern:", cross_m.round(3).to_string(index=False), "",
          "full history (N <= 150):", cross_f.round(3).to_string(index=False), ""]
    L += ["== Checks built into the design",
          f"mean terminal wealth / EW benchmark (should be 1): modern {base_m.mean_wealth_ratio_ew.min():.4f}"
          f"..{base_m.mean_wealth_ratio_ew.max():.4f}, full {base_f.mean_wealth_ratio_ew.min():.4f}"
          f"..{base_f.mean_wealth_ratio_ew.max():.4f}",
          f"top-1% capture vs hypergeometric 1-C(n-k,N)/C(n,N): max abs gap "
          f"{np.abs(base_m.top1_hit - base_m.top1_hit_theory).max():.4f}", ""]

    L.append("== Sensitivity: P(under EW) %, by variant (modern sample; full history for N <= 100)")
    L.append("   base = Shumway imputation + T-bill parking; m30/m100 = -30%/-100% imputation everywhere;")
    L.append("   park_mkt = proceeds into the VW market; liquid = price >= $1 and cap above the cohort 5th pct")
    rows = []
    for v in ("base", "m30", "m100", "park_mkt", "liquid"):
        for sname in ("modern", "full"):
            a = aggs[(v, sname)][0]
            for H in C.HORIZONS:
                for N in (1, 10, 30, 100, 1000):
                    r = a[(a.H == H) & (a.N == N)]
                    if len(r):
                        rows.append({"sample": sname, "H": H, "N": N, "variant": v,
                                     "P": 100 * r.p_under_ew.iloc[0], "med": 100 * r.rel_ew_p50.iloc[0]})
    s = pd.DataFrame(rows)
    L += [s.pivot_table(index=["sample", "H", "N"], columns="variant", values="P").round(1).to_string(), "",
          "median rel %/yr by variant:",
          s.pivot_table(index=["sample", "H", "N"], columns="variant", values="med").round(2).to_string(), ""]

    L += ["== Period split by start date (base): P_ew %, med_rel %/yr, P_vw %",
          by_period(d[d.variant == "base"], periods).to_string(), ""]

    t = base_m[base_m.N.isin(C.N_TABLE)][["H", "N", "n_starts", "n_nonoverlap", "p_under_ew",
                                           "p_under_ew_nonoverlap", "rel_ew_p50", "rel_ew_p50_nonoverlap"]].copy()
    t.iloc[:, 4:] *= 100
    L += ["== Overlapping vs non-overlapping start dates (base, modern)", t.round(2).to_string(index=False), ""]

    try:
        r = pd.read_parquet(C.OUTPUT / "rebal_stats.parquet")
        L += ["== Robustness: monthly-rebalanced EW portfolios vs the rebalanced EW cohort (annual December starts)",
              by_period(r, lambda b: (("full 1926- (N<=150)", b[b.N <= 150]), ("modern 1973-", b[b.start >= "1973"]))).to_string(), ""]
        rb = r[r.start >= "1973"].groupby(["H", "N"])[["p_under_ew", "rel_ew_p5", "rel_ew_p50", "rel_ew_p95"]].mean()
        L += ["rebalanced, modern, percentiles of annualized relative return (%/yr):", (100 * rb).round(2).to_string(), ""]
    except FileNotFoundError:
        L.append("(rebalanced results not yet available)")

    C.write_text(C.OUTPUT / "summary_report.txt", "\n".join(L))
    charts(base_m, C.OUTPUT / "fig_us_base_vs_ew.png",
           "US common stocks: N random stocks held H years vs the equal-weighted market", "1973-2025")
    charts(aggs[("liquid", "modern")][0], C.OUTPUT / "fig_us_liquid_vs_ew.png",
           "US common stocks, liquidity-filtered (price >= $1, cap above the 5th percentile)", "1973-2025")
    charts(base_f, C.OUTPUT / "fig_us_fullhistory_vs_ew.png",
           "US common stocks, full history (N <= 150)", "1926-2025")


if __name__ == "__main__":
    main()
