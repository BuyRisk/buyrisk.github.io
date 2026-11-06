"""Shared settings for the how-many-stocks Monte Carlo.

Code lives in the public BuyRisk repo. Everything it writes goes to
OUT_ROOT, which sits outside every repo on purpose: the outputs are
CRSP-derived, and no WRDS-derived figure may be hosted until the
Northwestern library rules on academic use. The caches are stock-level
and stay licensed forever.
"""
import os
from pathlib import Path

import numpy as np

DATA_LIB = Path(os.environ.get("DATA_LIB", r"E:\Finance\data\sources"))
CRSP = DATA_LIB / "crsp_stock"
FRENCH = Path(__file__).resolve().parents[2] / "data" / "sources" / "french"
OUT_ROOT = Path(os.environ.get("NSTOCKS_OUT", r"E:\Finance\data\derived\how-many-stocks"))
CACHE = OUT_ROOT / "cache"
OUTPUT = OUT_ROOT / "output"

HORIZONS = (1, 5, 10, 20)               # years
N_REPORT = (1, 2, 5, 10, 20, 30, 50, 100, 250, 500, 1000)
N_TABLE = (10, 30, 100, 500, 1000)
# dense grid so the smallest N crossing a threshold is not read off a coarse grid
N_GRID = np.unique(np.r_[np.arange(1, 51), np.arange(55, 101, 5), np.arange(110, 251, 10),
                         np.arange(275, 501, 25), np.arange(550, 1001, 50), N_REPORT]).astype(int)
N_MAX = int(N_GRID.max())
# a cell (start date, N) is drawn only when N <= alive / UNIVERSE_FRACTION, so a
# 500-stock draw from a 600-stock market never stands in for "diversification"
UNIVERSE_FRACTION = 3
DRAWS = 5000
CHUNK = 1000
SEED = 20261102

# missing delisting returns on performance delistings (DelActionType GDR).
# "shumway": -30% NYSE/AMEX (Shumway 1997), -55% Nasdaq (Shumway and Warther
# 1999); both citations to be verified against the primary source.
IMPUTE = {
    "shumway": {"N": -0.30, "A": -0.30, "Q": -0.55},
    "m30": {"N": -0.30, "A": -0.30, "Q": -0.30},
    "m100": {"N": -1.00, "A": -1.00, "Q": -1.00},
    "none": {"N": 0.0, "A": 0.0, "Q": 0.0},     # Datastream base: last price is the exit value
}
LOG_FLOOR = 1e-8   # a -100% month leaves wealth at 1e-8 rather than log(0)
PCTS = (5, 25, 50, 75, 95)


def month_index(dates):
    """Months since 1925-12 (index 0)."""
    d = np.asarray(dates, dtype="datetime64[M]").astype(int)
    return d - np.datetime64("1925-12", "M").astype(int)


def month_label(i):
    return str(np.datetime64("1925-12", "M") + int(i))


def write_text(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    print(text)
