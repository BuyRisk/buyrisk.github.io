"""Profile the Datastream month-end pull and cache it as parquet. Aggregates only.

Input: DATA_LIB/datastream/<file>.csv.gz, written on WRDS Cloud by
ds2_monthend.py (manifest in the Capitulation repo). One row per infocode and
calendar month: the last primary-quote (isprimqt = 1) equity (typecode EQ) row
of tr_ds_equities.wrds_ds2dsf in that month.

Writes CACHE/ds2_monthend.parquet (stock-level, licensed) and
OUTPUT/ds_profile_report.txt (aggregates). Never prints a row.

    python ds_profile.py [path-to-csv.gz]
"""
import sys
import time

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.compute as pcomp
import pyarrow.csv as pc
import pyarrow.parquet as pq

from common import CACHE, DATA_LIB, OUTPUT, write_text

SRC = sys.argv[1] if len(sys.argv) > 1 else str(DATA_LIB / "datastream" / "ds2_monthend_2026-11-05.csv.gz")
WRDS_LOG_ROWS = 20_869_374        # "DONE" line of the WRDS Cloud job log, 2026-11-05
STR_COLS = ["region", "currency", "exchintcode", "statuscode", "typecode", "ar_flag"]
NUM_COLS = ["ri", "ri_usd", "close", "close_usd", "mktcap", "mktcap_usd"]
YEARS = (1973, 1980, 1990, 2000, 2010, 2020, 2025)

t0 = time.time()
# infocode arrives as a float ("1.0") from WRDS; read it as float and cast only
# after checking that every value is a whole number
types = {"infocode": pa.float64(), **{c: pa.string() for c in STR_COLS}, **{c: pa.float64() for c in NUM_COLS}}
tbl = pc.read_csv(SRC, read_options=pc.ReadOptions(block_size=1 << 26),
                  convert_options=pc.ConvertOptions(column_types=types, strings_can_be_null=True))
_ic = tbl["infocode"].to_numpy()
assert not np.isnan(_ic).any() and np.all(_ic == np.floor(_ic)), "infocode not integral"
tbl = tbl.set_column(0, "infocode", pa.array(_ic.astype(np.int64)))
del _ic
for c in STR_COLS:
    tbl = tbl.set_column(tbl.schema.get_field_index(c), c, pcomp.dictionary_encode(tbl[c]))
CACHE.mkdir(parents=True, exist_ok=True)
pq.write_table(tbl, CACHE / "ds2_monthend.parquet", compression="zstd")
df = tbl.to_pandas()
del tbl
df["marketdate"] = pd.to_datetime(df["marketdate"])
t_read = time.time() - t0

L = []
out = L.append
pct = lambda x: f"{100 * x:.2f}%"

# ---- 1. file -----------------------------------------------------------
n = len(df)
ic = df["infocode"].to_numpy()
mi = (df["marketdate"].dt.year * 12 + df["marketdate"].dt.month - 1).to_numpy()
key = ic * 40_000 + mi
strict = bool(np.all(np.diff(key) > 0))
if not strict:
    o = np.argsort(key, kind="stable")
    df, ic, mi, key = df.iloc[o].reset_index(drop=True), ic[o], mi[o], key[o]
dups = int((np.diff(key) == 0).sum())
out("Datastream month-end profile (tr_ds_equities.wrds_ds2dsf, isprimqt=1, typecode=EQ)")
out(f"source: {SRC}")
out(f"read + parquet: {t_read:.0f}s")
out("")
out("1. FILE")
out(f"  rows: {n:,}  (WRDS job log: {WRDS_LOG_ROWS:,}; match = {n == WRDS_LOG_ROWS})")
out(f"  infocodes: {len(np.unique(ic)):,}")
out(f"  marketdate: {df['marketdate'].min().date()} to {df['marketdate'].max().date()}")
out(f"  sorted by (infocode, month) on arrival: {strict};  duplicate (infocode, month): {dups:,}")

# ---- 2. nulls ----------------------------------------------------------
out("")
out("2. NULL SHARE BY COLUMN")
for c in df.columns:
    out(f"  {c:12s} {pct(df[c].isna().mean())}")

# ---- 3. categories -----------------------------------------------------
out("")
out("3. CATEGORIES")
first = np.r_[True, ic[1:] != ic[:-1]]
last = np.r_[ic[1:] != ic[:-1], True]
for c in ["typecode", "statuscode", "ar_flag"]:
    vc = df[c].value_counts(dropna=False)
    out(f"  {c} (rows): " + ", ".join(f"{k}={v:,}" for k, v in vc.items()))
st_last = df["statuscode"].to_numpy()[last]
out("  statuscode at each infocode's last row: "
    + ", ".join(f"{k}={v:,}" for k, v in pd.Series(st_last).value_counts(dropna=False).items()))
g = df.groupby("infocode", sort=False, observed=True)
for c in ["statuscode", "region", "currency"]:
    k = int((g[c].nunique() > 1).sum())
    out(f"  infocodes with more than one {c}: {k:,}")
vc = df["currency"].value_counts()
out(f"  currency: {len(vc)} distinct; top 15 (rows): " + ", ".join(f"{k}={v:,}" for k, v in vc.head(15).items()))
out(f"  exchintcode: {df['exchintcode'].nunique()} distinct")
reg_last = pd.Series(df["region"].to_numpy()[last])
vc = reg_last.value_counts()
out(f"  region: {len(vc)} distinct. Infocodes by region at their last row:")
for i in range(0, len(vc), 8):
    out("    " + ", ".join(f"{k}={v:,}" for k, v in vc.iloc[i:i + 8].items()))

# ---- 4. gaps -----------------------------------------------------------
same = ~first
gap = np.where(same, mi - np.r_[0, mi[:-1]], 0)
out("")
out("4. GAPS BETWEEN CONSECUTIVE MONTHS OF ONE INFOCODE")
out(f"  consecutive pairs: {int(same.sum()):,}; gap = 1 month: {pct((gap[same] == 1).mean())}")
for lo, hi in [(2, 2), (3, 12), (13, 10_000)]:
    k = int(((gap >= lo) & (gap <= hi) & same).sum())
    out(f"  gap {lo}-{hi if hi < 10_000 else 'more'} months: {k:,}")

# ---- 5. returns --------------------------------------------------------
ok = same & (gap == 1)
ri = df["ri"].to_numpy()
riu = df["ri_usd"].to_numpy()
prev = np.r_[np.nan, ri[:-1]]
prevu = np.r_[np.nan, riu[:-1]]
with np.errstate(divide="ignore", invalid="ignore"):
    r = np.where(ok & (prev > 0), ri / prev - 1, np.nan)
    ru = np.where(ok & (prevu > 0), riu / prevu - 1, np.nan)
rn = r[~np.isnan(r)]
out("")
out("5. MONTHLY RETURNS FROM RI (consecutive months, prior RI > 0)")
out(f"  RI <= 0: {int((ri <= 0).sum()):,};  RI null: {int(np.isnan(ri).sum()):,}")
out(f"  local returns: {len(rn):,};  USD returns: {int((~np.isnan(ru)).sum()):,}")
qs = [0.001, 0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99, 0.999]
out("  local percentiles: " + ", ".join(f"p{100 * q:g}={v:+.3f}" for q, v in zip(qs, np.quantile(rn, qs))))
out(f"  local mean {rn.mean():+.4f}, min {rn.min():+.3f}, max {rn.max():+.1f}")
out(f"  exactly zero: {pct((rn == 0).mean())};  > +300%: {int((rn > 3).sum()):,};  < -90%: {int((rn < -0.9).sum()):,}")
nxt = np.r_[r[1:], np.nan]
ip = ((r > 3) | (nxt > 3)) & ((1 + r) * (1 + nxt) - 1 < 0.5)
out(f"  Ince-Porter reversal pairs (one leg > +300%, two-month total < +50%): {int(ip.sum()):,}")
dec = (df["marketdate"].dt.year // 10 * 10).to_numpy()
zs = pd.Series(r == 0)[~np.isnan(r)].groupby(dec[~np.isnan(r)]).mean()
out("  zero-return share by decade: " + ", ".join(f"{k}s {pct(v)}" for k, v in zs.items()))

# ---- 6. padding after death -------------------------------------------
# Datastream carries a dead series' last price forward. A trailing run of
# exactly-zero returns at the end of a series is the signature.
pos = np.arange(n)
nz = ~(r == 0)                      # NaN (first row, gaps) counts as non-zero
last_nz = pd.Series(np.where(nz, pos, -1)).groupby(ic).max().to_numpy()
first_pos = pos[first]
last_pos = pos[last]
trail = last_pos - np.maximum(last_nz, first_pos)
months = last_pos - first_pos + 1
end_m = mi[last]
data_end = mi.max()
out("")
out("6. TRAILING RUNS OF ZERO RETURNS (padding signature)")
for s in ["D", "A", "S"]:
    m = st_last == s
    if m.sum() == 0:
        continue
    t = trail[m]
    out(f"  statuscode {s}: {int(m.sum()):,} infocodes; trailing zero run >=1: {pct((t >= 1).mean())}, "
        f">=3: {pct((t >= 3).mean())}, >=12: {pct((t >= 12).mean())}, >=36: {pct((t >= 36).mean())}; "
        f"rows in runs: {int(t.sum()):,}")
    out(f"    last row in the data's final month: {pct((end_m[m] == data_end).mean())};  "
        f"median series length {np.median(months[m]):.0f} months")
md = st_last == "D"
if md.any():
    yrs = pd.Series(end_m[md] // 12).value_counts().sort_index()
    out("  dead infocodes by year of last row: " + ", ".join(f"{k}={v:,}" for k, v in yrs.items()))

# ---- 7. coverage -------------------------------------------------------
out("")
out("7. INFOCODES WITH A DECEMBER ROW, BY REGION (top 20 by 2020)")
mon = df["marketdate"].dt.month.to_numpy()
yr = df["marketdate"].dt.year.to_numpy()
reg = df["region"].astype(str).to_numpy()
dmask = mon == 12
cov = pd.crosstab(reg[dmask], yr[dmask])
cols = [y for y in YEARS if y in cov.columns]
top = cov[2020].sort_values(ascending=False).index[:20] if 2020 in cov.columns else cov.index[:20]
out("  " + "region".ljust(8) + "".join(f"{y:>8d}" for y in cols))
out("  " + "ALL".ljust(8) + "".join(f"{int(cov[y].sum()):>8,d}" for y in cols))
for k in top:
    out("  " + str(k).ljust(8) + "".join(f"{int(cov.loc[k, y]):>8,d}" for y in cols))
for thr in (300, 3000):
    firsts = {k: next((y for y in sorted(cov.columns) if cov.loc[k, y] >= thr), None) for k in top}
    out(f"  first December with >= {thr:,} infocodes: "
        + ", ".join(f"{k}={v}" for k, v in firsts.items() if v is not None))

# ---- 8. units and a CRSP cross-check ----------------------------------
out("")
out("8. MARKET CAP AND CURRENCY SANITY, 2020-12")
d20 = (yr == 2020) & (mon == 12)
mc, mcu = df["mktcap"].to_numpy(), df["mktcap_usd"].to_numpy()
for k in list(top[:6]):
    m = d20 & (reg == k)
    out(f"  {k}: n={int(m.sum()):,}, median mktcap {np.nanmedian(mc[m]):,.1f}, median mktcap_usd "
        f"{np.nanmedian(mcu[m]):,.1f}, total mktcap_usd {np.nansum(mcu[m]) / 1e6:,.2f} (x1e6)")
try:
    z = np.load(CACHE / "panel.npz")
    t20 = (2020 - 1925) * 12            # month index of 2020-12 (0 = 1925-12)
    cap = z["cap"][:, t20]
    live = z["listed"][:, t20] & (cap > 0)
    out(f"  CRSP common stocks 2020-12 (panel.npz): n={int(live.sum()):,}, median cap ${np.median(cap[live]):,.1f}M, "
        f"total ${cap[live].sum() / 1e6:,.2f} trillion")
except (OSError, KeyError) as e:
    out(f"  CRSP cross-check skipped: {e}")
for k in list(top[:3]):
    m = (reg == k) & ~np.isnan(r) & ~np.isnan(ru)
    out(f"  {k}: share of months with local return == USD return (to 1e-9): {pct((np.abs(r[m] - ru[m]) < 1e-9).mean())}")

out("")
out(f"elapsed {time.time() - t0:.0f}s")
write_text(OUTPUT / "ds_profile_report.txt", "\n".join(L))
