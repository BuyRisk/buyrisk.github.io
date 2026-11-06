"""Stage 4g: aggregate the Datastream runs, compare with CRSP, tables and charts.

Sample: quarterly starts from 1990-09, the first quarter-end at which
Datastream's FX and USD market-cap fields cover the non-US markets (before
mid-1990 most non-US stocks lack them, so the cohorts are a fraction of their
later size). All N up to 1,000 are drawable at every start in every
universe. CRSP rows come from bh_stats.parquet restricted to the same starts.
"""
import numpy as np
import pandas as pd

import common as C
import summarize as S

FROM = "1990-09"
PANELS = {"dev_exus_local": "Developed ex-US, local currency",
          "dev_exus_usd": "Developed ex-US, USD",
          "acwi_usd": "All-country (MSCI ACWI countries), USD",
          "acwi_local": "All-country, local currency (inflation-mixed; not a headline)",
          "us_ds_usd": "US from Datastream (calibration against CRSP)"}
NOTE = "Source: LSEG Datastream via WRDS. NOT FOR PUBLICATION pending the library ruling."
NS = (1, 10, 30, 100, 1000)


def load(name):
    d = pd.read_parquet(C.OUTPUT / f"{name}.parquet")
    return d[d.start >= FROM]


def main():
    L = ["HOW MANY STOCKS, global: buy-and-hold Monte Carlo on Datastream, aggregates only",
         NOTE, f"Quarterly starts from {FROM}. Statistics average the within-date value over start dates; "
         "[ ] = 95% circular block-bootstrap CI.",
         "Screens and the US check: build_global_report.txt. Base = last price as exit value, T-bill parking.", ""]
    aggs, starts = {}, {}
    for p in PANELS:
        d = load(f"bh_stats_{p}")
        starts[p] = set(zip(d.start, d.H))
        for v in d.variant.unique():
            a, c = S.aggregate(d[d.variant == v])
            a.to_csv(C.OUTPUT / f"agg_{p}_{v}.csv", index=False)
            c.to_csv(C.OUTPUT / f"cross_{p}_{v}.csv", index=False)
            aggs[(p, v)] = (a, c)
    crsp = pd.read_parquet(C.OUTPUT / "bh_stats.parquet")
    crsp = crsp[crsp.start >= FROM]
    ca = {v: S.aggregate(crsp[crsp.variant == v]) for v in ("base", "liquid")}
    pairs = starts["us_ds_usd"]
    key = pd.Series(list(zip(crsp.start, crsp.H)), index=crsp.index).isin(pairs)
    cs = crsp[key]
    ds = load("bh_stats_us_ds_usd")
    ds = ds[pd.Series(list(zip(ds.start, ds.H)), index=ds.index).isin(set(zip(cs.start, cs.H)))]
    cal = {"CRSP": S.aggregate(cs[cs.variant == "base"])[0], "Datastream US": S.aggregate(ds[ds.variant == "base"])[0],
           "CRSP liquid": S.aggregate(cs[cs.variant == "liquid"])[0],
           "Datastream US liquid": S.aggregate(ds[ds.variant == "liquid"])[0]}

    def pick(a, stat="p_under_ew"):
        t = a[a.N.isin(NS)].set_index(["H", "N"])[stat] * 100
        return t

    L.append("== Headline: P(underperform the equal-weighted benchmark) %, base case")
    tab = pd.DataFrame({"US (CRSP)": pick(ca["base"][0]),
                        **{PANELS[p].split(",")[0] + (" USD" if p.endswith("usd") else " local"): pick(aggs[(p, "base")][0])
                           for p in ("dev_exus_local", "dev_exus_usd", "acwi_usd", "acwi_local")}})
    L += [tab.round(1).to_string(), ""]
    L.append("== Median annualized return vs the EW benchmark, %/yr, base case")
    tab = pd.DataFrame({"US (CRSP)": pick(ca["base"][0], "rel_ew_p50"),
                        **{p: pick(aggs[(p, "base")][0], "rel_ew_p50")
                           for p in ("dev_exus_local", "dev_exus_usd", "acwi_usd", "acwi_local")}})
    L += [tab.round(2).to_string(), ""]
    L.append("== P(underperform the cap-weighted benchmark) %, base case")
    tab = pd.DataFrame({"US (CRSP)": pick(ca["base"][0], "p_under_vw"),
                        **{p: pick(aggs[(p, "base")][0], "p_under_vw")
                           for p in ("dev_exus_local", "dev_exus_usd", "acwi_usd", "acwi_local")}})
    L += [tab.round(1).to_string(), ""]

    for p, title in PANELS.items():
        a, c = aggs[(p, "base")]
        L += [f"== {title}: base case, full table", S.fmt_table(a), "",
              "smallest N with P(underperform) below each level:", c.round(3).to_string(index=False), "",
              f"checks: mean W / EW benchmark {a.mean_wealth_ratio_ew.min():.4f}..{a.mean_wealth_ratio_ew.max():.4f}; "
              f"top-1% capture vs hypergeometric, max gap {np.abs(a.top1_hit - a.top1_hit_theory).max():.4f}", ""]
        rows = []
        for v in ("base", "m30", "m100", "park_mkt", "liquid"):
            if (p, v) in aggs:
                t = aggs[(p, v)][0]
                t = t[t.N.isin(NS)]
                rows.append(t.assign(variant=v)[["variant", "H", "N", "p_under_ew", "rel_ew_p50"]])
        s = pd.concat(rows)
        L += ["sensitivity, P(under EW) % by variant (m30/m100 impute -30%/-100% on deaths not named as mergers; "
              "park_mkt parks proceeds in the VW market; liquid drops the bottom 5% by cap at the start):",
              (100 * s.pivot_table(index=["H", "N"], columns="variant", values="p_under_ew")).round(1).to_string(), ""]
        d = load(f"bh_stats_{p}")
        d = d[d.variant == "base"]
        per = S.by_period(d, lambda b: ((f"{FROM}-1999", b[b.start < "2000"]), ("2000-", b[b.start >= "2000"])))
        L += ["period split by start date (base):", per.to_string(), ""]

    L.append("== US check: Datastream US against CRSP on identical (start, H) pairs, P(under EW) %")
    t = pd.DataFrame({k: pick(v) for k, v in cal.items()})
    t["gap base"] = t["Datastream US"] - t["CRSP"]
    t["gap liquid"] = t["Datastream US liquid"] - t["CRSP liquid"]
    L += [t.round(2).to_string(), ""]
    t = pd.DataFrame({k: pick(v, "rel_ew_p50") for k, v in cal.items()})
    L += ["same, median relative return %/yr:", t.round(2).to_string(), ""]

    C.write_text(C.OUTPUT / "summary_global_report.txt", "\n".join(L))
    last = max(load("bh_stats_dev_exus_local").start)
    yrs = f"{FROM[:4]}-{last[:4]}"
    S.charts(aggs[("dev_exus_local", "base")][0], C.OUTPUT / "fig_dev_exus_local_vs_ew.png",
             "Developed markets ex-US, local currency: N random stocks held H years vs the equal-weighted market",
             yrs, NOTE)
    S.charts(aggs[("acwi_usd", "base")][0], C.OUTPUT / "fig_acwi_usd_vs_ew.png",
             "All-country (MSCI ACWI countries), USD: N random stocks held H years vs the equal-weighted market",
             yrs, NOTE)
    S.charts(aggs[("dev_exus_usd", "base")][0], C.OUTPUT / "fig_dev_exus_usd_vs_ew.png",
             "Developed markets ex-US, USD: N random stocks held H years vs the equal-weighted market", yrs, NOTE)


if __name__ == "__main__":
    main()
