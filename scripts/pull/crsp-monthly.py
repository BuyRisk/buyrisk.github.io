#!/usr/bin/env python3
"""
Pull CRSP monthly US common-stock returns from WRDS.

This is a licensed source. The raw output (crsp_monthly.csv) is written to the
shared cross-project data library (DATA_LIB\crsp_stock\, default E:\Finance\data\
sources) — git-ignored and never committed or shipped, see data/sources/crsp/
README.md. Only the manifest (provenance, no rows), which stays in the repo, and
the downstream AGGREGATE reducers (src/data/generated/crsp-*.ts) enter the repo.

Prereqs (on a machine with WRDS access, e.g. Northwestern faculty):
    pip install wrds pandas pyarrow
    # First run prompts for your WRDS username/password and offers to create a
    # ~/.pgpass so future runs are non-interactive.

Run:
    python scripts/pull/crsp-monthly.py --user <your_wrds_netid>

What it pulls: monthly total returns for share codes 10/11 (US common stock) on
NYSE/AMEX/NASDAQ (exch 1/2/3), delisting-adjusted, plus market equity. That is
the exact universe behind the Superstock (Bessembinder) and "How Many Stocks"
tools. It is intentionally NARROW — a handful of columns, no CUSIP/name/identifiers
beyond the permno key — so the local file is as small and as non-sensitive as the
research question allows.
"""

import argparse
import datetime as dt
import json
import os
import pathlib
import sys

# Raw CSV -> shared cross-project data library (licensed/large; git-ignored).
# Override the library location per machine with the DATA_LIB env var.
# The manifest (provenance, no rows) stays committed in the Buy Risk repo.
DATA_LIB = pathlib.Path(os.environ.get("DATA_LIB", r"E:\Finance\data\sources"))
REPO_CRSP = pathlib.Path(__file__).resolve().parents[2] / "data" / "sources" / "crsp"
RAW_CSV = DATA_LIB / "crsp_stock" / "crsp_monthly.csv"
MANIFEST = REPO_CRSP / "crsp_monthly.manifest.json"

# ---------------------------------------------------------------------------
# CLASSIC (SIZ) query — crsp.msf + crsp.msenames + crsp.msedelist.
# Rock-solid and widely documented; this is the "known-good today" path.
# ---------------------------------------------------------------------------
SIZ_SQL = """
SELECT a.permno, a.date, a.ret, a.retx, a.prc, a.shrout,
       d.dlret, d.dlstcd, n.shrcd, n.exchcd, n.siccd
FROM crsp.msf AS a
JOIN crsp.msenames AS n
  ON a.permno = n.permno
 AND a.date BETWEEN n.namedt AND n.nameendt
LEFT JOIN crsp.msedelist AS d
  ON a.permno = d.permno
 AND date_trunc('month', a.date) = date_trunc('month', d.dlstdt)
WHERE n.shrcd IN (10, 11)
  AND n.exchcd IN (1, 2, 3)
ORDER BY a.permno, a.date
"""

# ---------------------------------------------------------------------------
# PRIMARY (CIZ) query — crsp.msf_v2, CRSP's flat "Version 2" format. As of the
# current WRDS vintage the classic SIZ data is under "Legacy … no longer
# updated", so CIZ is the one to build on. `mthret` already folds in the
# delisting adjustment (no msedelist join needed), and common-stock filtering
# uses the new descriptor fields instead of shrcd/exchcd. The shrcd 10/11 +
# exch 1/2/3 universe maps to the WHERE clause below.
#
# `crsp.msf_v2` is WRDS's convenience view that pre-joins the CIZ time-series
# (crsp.stkmthsecuritydata) with the descriptor history (crsp.stksecurityinfohist),
# so all these columns come from one table. CONFIRM the column names against your
# vintage first:  python scripts/pull/crsp-monthly.py --describe
#   docs: https://wrds-www.wharton.upenn.edu/  (CRSP > Stock - Version 2 (CIZ))
# NOTE: CIZ returns are DECIMAL (0.0289 = +2.89%), unlike French's percent.
# ---------------------------------------------------------------------------
CIZ_SQL = """
SELECT permno, mthcaldt AS date, mthret AS ret, mthretx AS retx,
       mthprc AS prc, shrout, siccd, primaryexch, sharetype, securitytype
FROM crsp.msf_v2
WHERE sharetype = 'NS'
  AND securitytype = 'EQTY'
  AND securitysubtype = 'COM'
  AND issuertype IN ('ACOR', 'CORP')
  AND usincflg = 'Y'
  AND primaryexch IN ('N', 'A', 'Q')
ORDER BY permno, mthcaldt
"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--user", required=True, help="your WRDS username (NetID)")
    ap.add_argument(
        "--format",
        choices=["ciz", "siz"],
        default="ciz",
        help="ciz = crsp.msf_v2, the maintained 'Version 2' format (default); "
        "siz = classic msf/msenames/msedelist, now Legacy on WRDS (fallback)",
    )
    ap.add_argument(
        "--describe",
        action="store_true",
        help="just print the columns of the CIZ/SIZ tables and exit (run this "
        "first to confirm names on your WRDS vintage before pulling)",
    )
    args = ap.parse_args()

    try:
        import wrds  # noqa: PLC0415  (import here so the file reads without wrds installed)
        import pandas as pd  # noqa: PLC0415
    except ImportError:
        print("Install deps first:  pip install wrds pandas pyarrow", file=sys.stderr)
        return 1

    RAW_CSV.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    print(f"Connecting to WRDS as {args.user} …")
    db = wrds.Connection(wrds_username=args.user)

    if args.describe:
        # Confirm the real column names on this WRDS vintage before trusting the
        # hard-coded SELECTs. CIZ column names have shifted between releases.
        for lib, tbl in [("crsp", "msf_v2"), ("crsp", "stksecurityinfohist"),
                         ("crsp", "msf"), ("crsp", "msenames"), ("crsp", "msedelist")]:
            try:
                cols = db.describe_table(library=lib, table=tbl)
                print(f"\n{lib}.{tbl}:\n{list(cols['name'])}")
            except Exception as e:  # noqa: BLE001 — table may not exist on your vintage
                print(f"\n{lib}.{tbl}: (unavailable — {e})")
        db.close()
        return 0

    sql = CIZ_SQL if args.format == "ciz" else SIZ_SQL
    print(f"Running {args.format.upper()} pull (this takes a minute) …")
    df = db.raw_sql(sql, date_cols=["date"])
    db.close()

    # --- Delisting-adjusted total return -----------------------------------
    # SIZ: combine holding-period return with the delisting return in the
    # delist month.  adjret = (1+ret)(1+dlret) - 1, degrading gracefully when
    # either side is missing.  (CIZ's mthret already includes this, so the
    # dlret column is absent and the fill below is a no-op.)
    if "dlret" in df.columns:
        ret = df["ret"].fillna(0.0)
        dlret = df["dlret"].fillna(0.0)
        has_any = df["ret"].notna() | df["dlret"].notna()
        df["ret_adj"] = ((1 + ret) * (1 + dlret) - 1).where(has_any)
        # OPTIONAL refinement (Shumway 1997): performance-related delists with a
        # missing dlret are known to overstate returns. To apply the standard
        # -30% assumption, uncomment:
        # perf = df["dlstcd"].between(500, 584) & df["dlret"].isna()
        # df.loc[perf, "ret_adj"] = -0.30
    else:
        df["ret_adj"] = df["ret"]

    # Market equity in $millions (shrout is in thousands of shares, prc in $).
    df["me_musd"] = (df["prc"].abs() * df["shrout"]) / 1_000.0

    out = df[["permno", "date", "ret_adj", "me_musd"]].dropna(subset=["ret_adj"])
    out.to_csv(RAW_CSV, index=False)

    span = (out["date"].min(), out["date"].max())
    manifest = {
        "pulled_at": dt.date.today().isoformat(),
        "wrds_format": args.format,
        "query": " ".join(sql.split()),
        "universe": "US common stock (shrcd 10/11), NYSE/AMEX/NASDAQ (exch 1/2/3), delisting-adjusted",
        "columns": list(out.columns),
        "rows": int(len(out)),
        "permnos": int(out["permno"].nunique()),
        "date_span": [str(span[0].date()), str(span[1].date())],
        "raw_file": RAW_CSV.name,
        "license": "CRSP via WRDS — raw file is git-ignored; ship only aggregates.",
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"\nWrote {len(out):,} rows for {manifest['permnos']:,} stocks "
          f"({manifest['date_span'][0]} → {manifest['date_span'][1]})")
    print(f"  raw  (git-ignored): {RAW_CSV}")
    print(f"  manifest (commit):  {MANIFEST}")
    print("\nNext: write scripts/reduce-crsp-*.mjs to turn this into the "
          "aggregate numbers in src/data/generated/. See data/sources/crsp/README.md.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
