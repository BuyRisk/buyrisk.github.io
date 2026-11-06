"""Stage 1g: Datastream panels for the global universes, plus a US check panel.

Reads the month-end parquet written by ds_profile.py and the static lookup
tables, applies the screens below, and writes one panel per universe and
currency to CACHE in the layout build_panel.py uses for CRSP, plus m0 (the
month index of the panel's first month), region and base_impute. Prints
aggregates only.

Static screens (per infocode):
  major      the company's major security (ds2security.ismajorsec = Y)
  home       company country = quote country, which drops foreign listings
  names      no depositary-receipt, preferred, warrant, right, unit, fund,
             ETF, REIT, debt, certificate, partly-paid, duplicate or
             partnership keyword in the quote or security name
  country    in the universe's country list (MSCI classification, held fixed)
Row screens (per stock-month):
  exchange   rows on OTC, pink-sheet or grey markets dropped. A stock that
             moves from an exchange to OTC is treated as delisted that month,
             and its first OTC month's return is its delisting return (the
             role CRSP's delisting return plays).
  padding    a dead series' trailing months of exactly-zero return dropped
  reversal   monthly form of the Ince and Porter (2006) screen: a return above
             +300% next to a reversal that leaves the two-month return below
             +50% sets both months to zero (thresholds unverified against the
             paper)
  cap        any remaining monthly return above +300% set to zero. Datastream
             misses reverse splits and labels pre-listing OTC months with the
             later exchange, so most such months are errors; on CRSP the same
             rule barely moves the answer (figures in the private study notes)
  run-up     a stock whose wealth multiplies more than 1,000-fold within any
             60 months (USD where FX exists) is dropped. CRSP 1988-2025 has
             no such stock, nor does the Datastream US panel
Datastream carries no delisting returns. A dead stock's last price is its exit
value in the base case. Sensitivities impute -30% and -100% on deaths not named
as mergers. USD returns compound local returns with a currency-month FX rate:
the median of close_usd / close, after a per-stock power-of-ten unit scale
(pence against pounds, and similar).
"""
import re
import time

import numpy as np
import pandas as pd

import common as C

STATIC = C.DATA_LIB / "datastream" / "static_2026-11-05"
MONTHLY = C.CACHE / "ds2_monthend.parquet"
START, END = "1988-01", "2026-09"        # October 2026 is partial in the 2026-11-05 pull
DM_EXUS = ("AU", "AT", "BE", "CA", "DK", "FI", "FR", "DE", "HK", "IE", "IL", "IT", "JP", "NL", "NZ", "NO", "PT",
           "SG", "ES", "SE", "CH", "GB")
EM = ("BR", "CL", "CN", "CO", "CZ", "EG", "GR", "HU", "IN", "ID", "KR", "KW", "MY", "MX", "PE", "PH", "PL", "QA",
      "SA", "ZA", "TW", "TH", "TR", "AE")
UNIVERSES = {"us_ds": ("US",), "dev_exus": DM_EXUS, "acwi": DM_EXUS + ("US",) + EM}
KW = ["ADRS?", "GDRS?", "DEPOSITARY", "DEPOSITORY", "RECEIPTS?", "PREFS?", "PREFERRED", "PFD", "PRF", "CONV",
      "WARRANTS?", "WTS", "WRTS?", "RIGHTS", "RTS", "UNITS", "FUND", "FD", "ETF", "ETN", "REIT", "BONDS?", "DEB",
      "DEBENTURES?", "CERTS?", "CERTIFICATES?", "PARTLY", "PART PAID", "NIL PAID", "DUPL", "DUPLICATE",
      r"INV\.? ?TST", "INVESTMENT TRUST", "INV TRUST", "LP", r"L\.P\.", "PARTNERSHIP"]
OTC_RE = re.compile(r"OTC|PINK|GREY|GRAY|BULLETIN|OVER.THE.COUNTER", re.I)
MERGER_RE = re.compile(r"MERGE|T/O|TAKEOVER|ACQ", re.I)


def rd(t):
    return pd.read_csv(STATIC / f"ds2static_{t}.csv.gz", dtype=str, encoding="latin-1")


def norm(s):
    return s.astype(str).str.replace(r"\.0$", "", regex=True)


def grp_first(ic):
    return np.r_[True, ic[1:] != ic[:-1]]


def french_rf(m0, M):
    ff = pd.read_csv(C.FRENCH / "F-F_Research_Data_Factors.csv", skiprows=4, dtype=str)
    ff.columns = ["ym", "mkt_rf", "smb", "hml", "rf"]
    ff = ff[ff.ym.str.strip().str.len() == 6].dropna()
    fmi = C.month_index(pd.to_datetime(ff.ym.str.strip(), format="%Y%m").values) - m0
    rf = np.full(M, np.nan)
    ok = (fmi >= 0) & (fmi < M)
    rf[fmi[ok]] = ff.rf.astype(float).values[ok] / 100
    last = int(np.flatnonzero(~np.isnan(rf)).max())
    return pd.Series(rf).ffill().bfill().values, last


def main():
    t0 = time.time()
    L = []
    out = L.append
    m0, m1 = (int(x) for x in C.month_index(np.array([START, END], dtype="datetime64[M]")))
    M = m1 - m0 + 1

    m = pd.read_parquet(MONTHLY, columns=["infocode", "marketdate", "region", "currency", "exchintcode", "ri",
                                          "close", "close_usd", "mktcap", "mktcap_usd"])
    m["mi"] = C.month_index(pd.to_datetime(m.marketdate).values)
    m = m[(m.mi >= m0) & (m.mi <= m1)].drop(columns="marketdate").reset_index(drop=True)
    for c in ("region", "currency", "exchintcode"):
        m[c] = m[c].astype(str).str.replace(r"\.0$", "", regex=True).astype("category")
    out(f"Datastream panels, months {START}..{END}: {len(m):,} rows, {m.infocode.nunique():,} infocodes in span")

    # ---- static screens -------------------------------------------------
    cq, sec, co, ex = rd("ds2ctryqtinfo"), rd("ds2security"), rd("ds2company"), rd("ds2exchange")
    for d, cols in ((cq, ["infocode", "dsseccode"]), (sec, ["dsseccode", "dscmpycode"]), (co, ["dscmpycode"]),
                    (ex, ["exchintcode"])):
        for c in cols:
            d[c] = norm(d[c])
    cq["infocode"] = cq.infocode.astype(np.int64)
    info = (cq[["infocode", "dsseccode", "dsqtname", "region"]]
            .merge(sec[["dsseccode", "dscmpycode", "ismajorsec", "dssecname"]], on="dsseccode", how="left")
            .merge(co[["dscmpycode", "cmpyctrycode"]], on="dscmpycode", how="left")
            .set_index("infocode"))
    info = info.loc[np.unique(m.infocode)]
    qn = info.dsqtname.fillna("").str.upper()
    base = qn.str.split(r"\s+DEAD\b", n=1, regex=True).str[0]
    secn = info.dssecname.fillna("").str.upper()
    hit = pd.Series(False, index=info.index)
    kw_counts = {}
    for k in KW:
        rx = re.compile(rf"(?<![A-Z0-9]){k}(?![A-Z0-9])")
        h = base.str.contains(rx) | secn.str.contains(rx)
        kw_counts[k] = int(h.sum())
        hit |= h
    major = info.ismajorsec.eq("Y")
    home = info.cmpyctrycode.eq(info.region)
    merger_named = qn.str.contains(MERGER_RE)
    acwi = info.region.isin(UNIVERSES["acwi"])
    out("")
    out("STATIC SCREENS (infocodes with a row in the span; each line removes from what is left)")
    keep = pd.Series(True, index=info.index)
    for lab, f in (("not the major security", major), ("company country != quote country", home),
                   ("name keyword", ~hit), ("country outside ACWI (frontier and other)", acwi)):
        drop = keep & ~f
        out(f"  {lab}: -{int(drop.sum()):,}")
        keep &= f
    out(f"  left: {int(keep.sum()):,}")
    out("  keyword hits (any screen stage): " + ", ".join(f"{k}={v:,}" for k, v in kw_counts.items() if v))
    m = m[m.infocode.isin(info.index[keep.to_numpy()])].reset_index(drop=True)

    # ---- exchange screen ------------------------------------------------
    exn = ex.set_index("exchintcode").exchname
    cats = list(m.exchintcode.cat.categories)
    otc_cat = np.array([bool(OTC_RE.search(str(exn.get(c, "")))) for c in cats])
    unknown = [c for c in cats if c not in exn.index]
    otc = otc_cat[m.exchintcode.cat.codes.to_numpy()]
    vc = pd.Series(np.array(cats)[m.exchintcode.cat.codes.to_numpy()][otc]).map(exn).value_counts()
    out("")
    out(f"EXCHANGE SCREEN: {len(cats)} exchange codes, {len(unknown)} not in ds2exchange; OTC-type rows "
        f"{int(otc.sum()):,}: " + ", ".join(f"{k}={v:,}" for k, v in vc.items()))
    ic = m.infocode.to_numpy()
    first = grp_first(ic)
    gid = np.cumsum(first) - 1
    started = pd.Series(~otc).groupby(gid).cummax().to_numpy()
    after = started & otc
    cnt = pd.Series(after.astype(np.int32)).groupby(gid).cumsum().to_numpy()
    exit_row = after & (cnt == 1)
    relist = int(pd.Series(started & ~otc & (cnt >= 1)).groupby(gid).any().sum())
    keep_r = started & ((cnt == 0) | exit_row)
    otc_exit_ic = set(ic[exit_row])
    out(f"  stocks only ever on OTC (never enter): {int((~pd.Series(started).groupby(gid).any()).sum()):,}; "
        f"rows before a stock's first exchange month dropped: {int((~started).sum()):,}")
    out(f"  exchange-to-OTC moves treated as delistings: {len(otc_exit_ic):,} "
        f"(of which later back on an exchange, ignored: {relist:,})")
    m = m[keep_r].reset_index(drop=True)

    # ---- local returns, padding, reversals ------------------------------
    ic = m.infocode.to_numpy()
    first = grp_first(ic)
    gid = np.cumsum(first) - 1
    mi = m.mi.to_numpy()
    ri = m.ri.to_numpy(float)
    prev = np.r_[np.nan, ri[:-1]]
    with np.errstate(divide="ignore", invalid="ignore"):
        r = np.where(first, 0.0, np.where((prev > 0) & (ri > 0), ri / prev - 1, np.nan))
    last_mi = pd.Series(mi).groupby(gid).transform("max").to_numpy()
    dead_row = last_mi < m1
    zero = (r == 0) & ~first
    any_nz_here_on = pd.Series(~zero)[::-1].groupby(gid[::-1]).cummax()[::-1].to_numpy()
    is_exit_stock = np.isin(ic, list(otc_exit_ic))
    trail = dead_row & ~is_exit_stock & ~any_nz_here_on
    out("")
    out(f"PADDING: trailing zero-return rows dropped from dead series: {int(trail.sum()):,} rows, "
        f"{len(np.unique(ic[trail])):,} stocks")
    keep_r = ~trail
    m, r = m[keep_r].reset_index(drop=True), r[keep_r]
    ic = m.infocode.to_numpy()
    first = grp_first(ic)
    gid = np.cumsum(first) - 1
    mi = m.mi.to_numpy()
    out(f"  returns not computable (RI <= 0 or missing), set to zero: {int(np.isnan(r).sum()):,}")
    r = np.nan_to_num(r, nan=0.0)
    rn = np.r_[r[1:], 0.0]
    same_next = np.r_[~first[1:], False]
    ip = same_next & ((r > 3) | (rn > 3)) & ((1 + r) * (1 + rn) - 1 < 0.5)
    r[ip] = 0.0
    r[np.r_[False, ip[:-1]]] = 0.0
    out(f"REVERSALS: Ince-Porter pairs zeroed: {int(ip.sum()):,}")
    z = np.load(C.CACHE / "panel.npz")
    c0 = m0 - 0                                   # CRSP panel index 0 = 1925-12, same convention
    cr = z["ret"][:, c0:][z["listed"][:, c0:]]
    cr = cr[~np.isnan(cr)]
    out(f"  monthly returns above +300% per million stock-months: Datastream after screens "
        f"{1e6 * (r > 3).mean():.0f}, CRSP {START}-2025 {1e6 * (cr > 3).mean():.0f}; above +990%: "
        f"{1e6 * (r > 9.9).mean():.1f} vs {1e6 * (cr > 9.9).mean():.1f}")
    # Cap rule, chosen on the US check of 2026-11-05: setting every monthly return above +300% to zero
    # barely moves CRSP's own answer and brings the Datastream US panel close to CRSP (figures in the
    # private study notes, not here: this repo is public).
    big = r > 3
    r[big] = 0.0
    out(f"CAP: monthly returns still above +300% set to zero: {int(big.sum()):,}")
    lr = np.log(np.maximum(1 + r, C.LOG_FLOOR))
    cl_loc = pd.Series(lr).groupby(gid).cumsum().to_numpy()

    # ---- FX -------------------------------------------------------------
    cur = m.currency.astype(str).to_numpy()
    with np.errstate(divide="ignore", invalid="ignore"):
        f_row = np.where((m.close > 0) & (m.close_usd > 0), m.close_usd / m.close, np.nan)
    key = pd.MultiIndex.from_arrays([cur, mi])
    raw = pd.Series(f_row).groupby([cur, mi]).median()
    rel = f_row / raw.reindex(key).to_numpy()
    scale = 10.0 ** np.round(np.log10(pd.Series(rel).groupby(gid).transform("median").to_numpy()))
    scale = np.where(np.isfinite(scale), scale, 1.0)
    fx = pd.Series(f_row / scale).groupby([cur, mi]).median().reindex(key).to_numpy()
    fx[cur == "USD"] = 1.0
    off = np.abs(f_row / scale / fx - 1)
    off = off[~np.isnan(off)]
    out("")
    out(f"FX: stocks with a non-unit price scale {len(np.unique(gid[scale != 1])):,}; rows whose own rate is more "
        f"than 1% off the currency-month median: {100 * (off > 0.01).mean():.2f}%")
    fcov = pd.Series(~np.isnan(fx)).groupby(cur).mean().sort_values()
    out("  currencies with the lowest FX coverage (share of rows): "
        + ", ".join(f"{k} {v:.2f}" for k, v in fcov.head(8).items()))
    cap_u = m.mktcap_usd.to_numpy(float) / 1e6
    fill = m.mktcap.to_numpy(float) * fx / 1e6
    both = ~np.isnan(cap_u) & ~np.isnan(fill) & (cap_u > 0)
    agree = np.abs(fill[both] / cap_u[both] - 1) < 0.02
    out(f"  mktcap x FX against mktcap_usd, where both exist: within 2% on {100 * agree.mean():.1f}% of rows; "
        f"used to fill {int((np.isnan(cap_u) & ~np.isnan(fill)).sum()):,} rows")
    cap_u = np.where(np.isnan(cap_u), fill, cap_u)
    has_fx = ~np.isnan(fx)

    # ---- run-up screen: drop stocks whose wealth multiplies more than 1,000-fold within any 60 months
    # (USD where FX exists, local otherwise). CRSP 1988-2025 has no such stock and neither does the
    # Datastream US panel, so on US data the rule removes nothing; abroad it removes a handful of
    # series that otherwise dominate some cohorts' equal-weighted wealth.
    ustk = np.unique(ic)
    si = np.searchsorted(ustk, ic)
    cl_cmp = np.where(has_fx, cl_loc + np.log(np.where(has_fx, fx, 1.0)), np.nan)
    no_fx = ~pd.Series(has_fx).groupby(si).any().to_numpy()
    cl_cmp = np.where(no_fx[si], cl_loc, cl_cmp)
    wide = np.full((len(ustk), M), np.nan)
    wide[si, mi - m0] = cl_cmp
    wide = pd.DataFrame(wide).ffill(axis=1).to_numpy()
    with np.errstate(invalid="ignore"):
        run60 = np.nanmax(wide[:, 60:] - wide[:, :-60], axis=1)
    del wide
    junk = ustk[np.nan_to_num(run60, nan=0.0) > np.log(1000)]
    jr = pd.Series(info.region.reindex(junk).to_numpy()).value_counts()
    out(f"RUN-UP SCREEN: stocks with a 60-month wealth multiple above 1,000 dropped: {len(junk):,} ("
        + ", ".join(f"{k} {v}" for k, v in jr.items()) + "); CRSP 1988-2025 and the Datastream US panel have none")
    keep_r = ~np.isin(ic, junk)
    m, r, lr, cl_loc, fx, cap_u, has_fx = (m[keep_r].reset_index(drop=True), r[keep_r], lr[keep_r], cl_loc[keep_r],
                                           fx[keep_r], cap_u[keep_r], has_fx[keep_r])
    ic, mi = ic[keep_r], mi[keep_r]

    orig_last = pd.Series(mi).groupby(ic).max()
    reg_s = m.region.astype(str).to_numpy()
    rf, rf_last = french_rf(m0, M)
    out(f"  T-bill series: French RF, last month {C.month_label(rf_last + m0)} (later months carry it forward)")

    # ---- panels ---------------------------------------------------------
    out("")
    out("PANELS (stocks alive with a cap at December; returns annualized from monthly means)")
    calib = {}
    for uname, ctry in UNIVERSES.items():
        for ccy in (("usd",) if uname == "us_ds" else ("local", "usd")):
            sel = np.isin(reg_s, ctry) & (has_fx if ccy == "usd" else True)
            idx = np.flatnonzero(sel)
            ics = ic[idx]
            f = grp_first(ics)
            if ccy == "local":
                lrow = np.where(f, 0.0, lr[idx])
            else:
                clu = cl_loc[idx] + np.log(fx[idx])
                lrow = np.where(f, 0.0, clu - np.r_[0.0, clu[:-1]])
            stocks = np.unique(ics)
            S = len(stocks)
            s = np.searchsorted(stocks, ics)
            t = mi[idx] - m0
            ret = np.full((S, M), np.nan, np.float32)
            cap = np.full((S, M), np.nan, np.float32)
            listed = np.zeros((S, M), bool)
            lgw = np.zeros((S, M))
            ret[s, t] = np.expm1(lrow)
            cap[s, t] = cap_u[idx]
            listed[s, t] = True
            lgw[s, t] = lrow
            CL = np.cumsum(lgw, axis=1)
            del lgw
            last_m = np.zeros(S, np.int64)
            np.maximum.at(last_m, s, t)
            first_m = np.full(S, M, np.int64)
            np.minimum.at(first_m, s, t)
            dead = orig_last.reindex(stocks).to_numpy() < m1
            death = np.where(dead, last_m, M).astype(np.int32)
            imp_flag = dead & ~merger_named.reindex(stocks).to_numpy() & ~np.isin(stocks, list(otc_exit_ic))
            region = info.region.reindex(stocks).to_numpy().astype("<U2")
            w = np.vstack([np.full((1, S), np.nan, np.float32), cap[:, :-1].T]).T
            use = (w > 0) & ~np.isnan(ret)
            mkt = np.where(use, w * ret, 0).sum(0) / np.maximum(np.where(use, w, 0).sum(0), 1e-12)
            mkt[0] = 0.0
            ew = np.where(use, ret, 0).sum(0) / np.maximum(use.sum(0), 1)
            ew[0] = 0.0
            name = f"panel_{uname}_{ccy}"
            np.savez(C.CACHE / f"{name}.npz", ret=ret, cap=cap, listed=listed, CL=CL, death=death,
                     imp_flag=imp_flag, imp_exch=np.full(S, "N", "<U1"), rf=rf, mkt=mkt, first_m=first_m,
                     last_m=last_m, m0=m0, region=region, infocode=stocks, base_impute="none")
            alive = listed & (cap > 0) & (np.arange(M)[None, :] < death[:, None])
            decs = {y: int(alive[:, (y - 1988) * 12 + 11].sum()) for y in range(1990, 2026, 5)}
            act = np.arange(M) >= 24
            out(f"  {name}: {S:,} stocks, {int(listed.sum()):,} stock-months, dead {int(dead.sum()):,} "
                f"(imputed in m30/m100: {int(imp_flag.sum()):,}); VW {1200 * mkt[act].mean():.1f}%/yr, "
                f"EW {1200 * ew[act].mean():.1f}%/yr")
            out("    alive at December: " + ", ".join(f"{y} {n:,}" for y, n in decs.items()))
            if uname == "us_ds":
                calib = dict(ew=ew, vw=mkt, alive=alive)
            if uname == "acwi":
                yrs = np.arange(M) >= 24
                rows = []
                for k in UNIVERSES["acwi"]:
                    ss = region == k
                    u = use[ss][:, yrs]
                    rr = np.where(u, ret[ss][:, yrs], 0).sum(0) / np.maximum(u.sum(0), 1)
                    rows.append((k, 1200 * rr.mean()))
                calib[ccy] = dict(rows)
            del ret, cap, listed, CL, w, use, alive

    # ---- US check against CRSP ------------------------------------------
    out("")
    out("US CHECK: Datastream US panel against CRSP common stocks, 1990-01..2025-12")
    zc = z
    c_ret = zc["ret"][:, m0 - 0:]
    c_cap = zc["cap"][:, m0 - 0:]
    c_l = zc["listed"][:, m0 - 0:]
    Mc = c_ret.shape[1]
    wc = np.hstack([np.full((c_cap.shape[0], 1), np.nan, np.float32), c_cap[:, :-1]])
    uc = (wc > 0) & ~np.isnan(c_ret)
    c_vw = np.where(uc, wc * c_ret, 0).sum(0) / np.maximum(np.where(uc, wc, 0).sum(0), 1e-12)
    c_ew = np.where(uc, c_ret, 0).sum(0) / np.maximum(uc.sum(0), 1)
    a, b = 24, min(Mc, M)
    for lab, d1, d2 in (("EW", calib["ew"][a:b], c_ew[a:b]), ("VW", calib["vw"][a:b], c_vw[a:b])):
        out(f"  {lab}: Datastream {1200 * d1.mean():.2f}%/yr, CRSP {1200 * d2.mean():.2f}%/yr, "
            f"correlation {np.corrcoef(d1, d2)[0, 1]:.4f}, tracking error {np.sqrt(12) * 100 * np.std(d1 - d2):.2f}%/yr")
    ca = c_l & (c_cap > 0)
    out("  alive at December, Datastream / CRSP: " + ", ".join(
        f"{y} {int(calib['alive'][:, (y - 1988) * 12 + 11].sum()):,}/{int(ca[:, (y - 1988) * 12 + 11].sum()):,}"
        for y in range(1990, 2026, 5)))
    out("")
    out("LOCAL vs USD, ACWI countries: EW mean return %/yr, 1990-01..2026-09 (gap = inflation and FX)")
    rows = [(k, calib["local"].get(k, np.nan), calib["usd"].get(k, np.nan)) for k in UNIVERSES["acwi"]]
    rows.sort(key=lambda x: -(x[1] - x[2]))
    for i in range(0, len(rows), 4):
        out("  " + "; ".join(f"{k} {lo:5.1f} / {us:5.1f}" for k, lo, us in rows[i:i + 4]))
    out("")
    out(f"elapsed {time.time() - t0:.0f}s")
    C.write_text(C.OUTPUT / "build_global_report.txt", "\n".join(L) + "\n")


if __name__ == "__main__":
    main()
