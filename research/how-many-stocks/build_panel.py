"""Stage 1: build the stock-by-month panel the simulations read.

Reads the shared-library CRSP v2 monthly file and the delisting file, splices
in delisting returns the monthly file lacks, and writes wide arrays to CACHE.
Prints aggregates only.

The 2026-08-30 vintage of crsp_monthly.csv lacks the delisting-month row for
most delistings (see Capitulation note crsp-stock-vintage-and-delisting-
2026-11-02). Where the last monthly row is before the delisting month, the
delisting-month return is rebuilt as

    (|DelDtPrc| / |last month-end price|) * (1 + DelRet) - 1

booked in the month after the last row. Where the row is present, CIZ MthRet
already includes DelRet and is used as is. A missing DelRet on a performance
delisting (GDR) is imputed at simulation time (common.IMPUTE), so the panel
stores the unimputed return plus a flag.
"""
import numpy as np
import pandas as pd

import common as C


def main():
    m = pd.read_csv(C.CRSP / "crsp_monthly.csv", dtype={"PERMNO": str, "PrimaryExch": str, "SICCD": str},
                    encoding="latin-1")
    m["mi"] = C.month_index(pd.to_datetime(m.MthCalDt).values)
    M = int(m.mi.max()) + 1
    permnos = np.sort(m.PERMNO.unique())
    sid = pd.Series(np.arange(len(permnos)), index=permnos)
    m["s"] = sid.loc[m.PERMNO].values
    S = len(permnos)

    ret = np.full((S, M), np.nan, np.float32)
    prc = np.full((S, M), np.nan, np.float32)
    cap = np.full((S, M), np.nan, np.float32)
    listed = np.zeros((S, M), bool)
    r = pd.to_numeric(m.MthRet, errors="coerce").values
    p = np.abs(pd.to_numeric(m.MthPrc, errors="coerce").values)
    sh = pd.to_numeric(m.ShrOut, errors="coerce").values
    ret[m.s, m.mi] = r
    prc[m.s, m.mi] = p
    cap[m.s, m.mi] = p * sh / 1000.0          # $ millions (ShrOut in thousands)
    listed[m.s, m.mi] = True
    lines = [f"monthly rows {len(m):,}  stocks {S:,}  months {C.month_label(0)}..{C.month_label(M - 1)}",
             f"rows with missing MthRet {np.isnan(r).sum():,} ({100 * np.isnan(r).mean():.2f}%)",
             f"monthly returns > +1000%: {(r > 10).sum()}   at -100%: {(r <= -1).sum()}"]

    last_m = np.where(listed.any(1), M - 1 - np.argmax(listed[:, ::-1], axis=1), -1)
    first_m = np.argmax(listed, axis=1)

    # ---- delistings
    dl = pd.read_csv(C.CRSP / "delist.csv", dtype=str, encoding="latin-1")
    dl = dl[dl.PERMNO.isin(sid.index)].copy()
    dl["s"] = sid.loc[dl.PERMNO].values
    dl["D"] = C.month_index(pd.to_datetime(dl.DelistingDt).values)
    dl["dr"] = pd.to_numeric(dl.DelRet, errors="coerce")
    dl["dp"] = np.abs(pd.to_numeric(dl.DelDtPrc, errors="coerce"))
    dl["L"] = last_m[dl.s]
    dl = dl[dl.L < M - 1]                     # still listed at the file's end: alive
    death = np.full(S, M, np.int32)           # month in which the final return is booked
    imp_flag = np.zeros(S, bool)              # GDR with no DelRet: impute at run time
    imp_exch = np.full(S, "N", "<U1")

    same = dl.D == dl.L
    after = dl.D > dl.L
    before = dl.D < dl.L
    lines.append(f"delistings matched to the universe (before the file's last month) {len(dl):,}: "
                 f"row present in delisting month {same.sum():,}, row missing {after.sum():,}, "
                 f"delisting dated before the last row {before.sum():,}")
    lines.append(f"  of row-missing: delisting > 1 month after the last row {(dl.D - dl.L > 1)[after].sum():,} "
                 f"(booked in the month after the last row regardless)")

    a = dl[after]
    lp = prc[a.s.values, a.L.values]
    stub = np.where((a.dp.values > 0) & (lp > 0), a.dp.values / lp, 1.0)
    dr = np.nan_to_num(a.dr.values, nan=0.0)
    ret[a.s.values, a.L.values + 1] = (stub * (1 + dr) - 1).astype(np.float32)
    lines.append(f"  stub price ratio on spliced delistings: median {np.median(stub):.3f}, "
                 f"missing a usable price {(stub == 1.0).mean() * 100:.1f}%")
    death[a.s.values] = a.L.values + 1
    death[dl[same | before].s.values] = dl[same | before].L.values
    gdr_miss = (dl.DelActionType == "GDR") & dl.dr.isna()
    imp_flag[dl[gdr_miss].s.values] = True
    imp_exch[dl.s.values] = dl.PrimaryExch.fillna("N").str[:1].values
    imp_exch[~np.isin(imp_exch, list("NAQ"))] = "N"
    oth_miss = (dl.DelActionType != "GDR") & dl.dr.isna()
    lines.append(f"  performance (GDR) delistings {int((dl.DelActionType == 'GDR').sum()):,}, "
                 f"of which DelRet missing {int(gdr_miss.sum()):,} -> imputed; "
                 f"other delistings with DelRet missing {int(oth_miss.sum()):,} -> 0")
    ends_early = (last_m < M - 1) & (death == M)
    death[ends_early] = last_m[ends_early]
    lines.append(f"stocks whose rows end before the file does with no delisting record: {ends_early.sum():,} "
                 f"(treated as delisted with no further return)")
    gaps = listed.sum(1) < (np.minimum(death, last_m) - first_m + 1)
    lines.append(f"stocks with a missing month inside their life: {gaps.sum():,} (gap months earn 0)")

    # ---- cumulative log wealth within life (unimputed); dead months contribute 0
    alive_ret = np.where(np.arange(M)[None, :] <= death[:, None], ret, np.nan)
    lg = np.log(np.maximum(1.0 + np.nan_to_num(alive_ret.astype(np.float64), nan=0.0), C.LOG_FLOOR))
    CL = np.cumsum(lg, axis=1)

    # ---- parking series: one-month T-bill (French RF) and the value-weighted universe
    ff = pd.read_csv(C.FRENCH / "F-F_Research_Data_Factors.csv", skiprows=4, dtype=str)
    ff.columns = ["ym", "mkt_rf", "smb", "hml", "rf"]
    ff = ff[ff.ym.str.strip().str.len() == 6].dropna()
    ff_mi = C.month_index(pd.to_datetime(ff.ym.str.strip(), format="%Y%m").values)
    rf = np.full(M, np.nan)
    ok = ff_mi < M
    rf[ff_mi[ok]] = ff.rf.astype(float).values[ok] / 100
    first_rf = np.argmax(~np.isnan(rf))
    rf[:first_rf] = rf[first_rf]
    rf = pd.Series(rf).ffill().values
    w = np.vstack([np.full((1, S), np.nan, np.float32), cap[:, :-1].T]).T
    use = (w > 0) & ~np.isnan(alive_ret)
    mkt = np.where(use, w * alive_ret, 0).sum(0) / np.maximum(np.where(use, w, 0).sum(0), 1e-12)
    mkt[0] = 0.0
    lines.append(f"T-bill series from French RF, first month {C.month_label(first_rf)} "
                 f"(earlier months set to that value); mean {12 * rf.mean() * 100:.2f}%/yr")
    lines.append(f"value-weighted universe return, mean {12 * mkt[1:].mean() * 100:.2f}%/yr (sanity: ~10-12%)")

    # ---- universe size at each December (the cohort the simulations draw from)
    alive = listed & (cap > 0) & (np.arange(M)[None, :] < death[:, None])
    dec = [i for i in range(M) if C.month_label(i).endswith("-12")]
    sizes = {C.month_label(i)[:4]: int(alive[:, i].sum()) for i in dec}
    lines.append("stocks alive with a market cap, at December: " +
                 ", ".join(f"{y} {n}" for y, n in sizes.items() if int(y) % 5 == 0 or y in ("1962", "1972", "1973")))

    np.savez(C.CACHE / "panel.npz", ret=ret, prc=prc, cap=cap, listed=listed, CL=CL, death=death,
             imp_flag=imp_flag, imp_exch=imp_exch, rf=rf, mkt=mkt, first_m=first_m, last_m=last_m)
    C.write_text(C.OUTPUT / "build_panel_report.txt", "\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
