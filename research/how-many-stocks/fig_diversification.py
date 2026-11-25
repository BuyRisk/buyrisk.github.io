"""Figure: textbook diversification against diversification under skewness.

One normalized scale, the share of the one-stock problem that N stocks remove:

  textbook   stock-specific (diversifiable) variance removed, 1 - 1/N. For
             terminal wealth relative to the equal-weighted benchmark this is
             exact under random draws, whatever the skew (finite-population
             correction ignored).
  median     the median annualized shortfall against the equal-weighted
             benchmark, as a share of the one-stock median shortfall.
  odds       P(trail the equal-weighted benchmark) minus 50%, as a share of
             the one-stock excess. Under symmetric returns both the median
             shortfall and this excess are zero at every N, so these two
             lines measure only what skew does.

Input: agg_base_modern.csv from summarize.py (CRSP, quarterly starts 1973-03 on).
Lines are 10-year holds; shading spans 1-, 5-, 10- and 20-year holds.
Writes fig_diversification.png and a tidy fig_diversification.csv to OUTPUT.
"""
import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

import common as C
import summarize as S

H_LINE = 10
N_MARK = 30
BLUE, ORANGE = "#2a78d6", "#eb6834"


def main():
    a = pd.read_csv(C.OUTPUT / "agg_base_modern.csv")
    rows = []
    for H, g in a.groupby("H"):
        g = g.sort_values("N").set_index("N")
        p1, m1 = g.p_under_ew.loc[1], g.rel_ew_p50.loc[1]
        rows.append(pd.DataFrame({"H": H, "N": g.index,
                                  "textbook": 1 - 1 / g.index.to_numpy(),
                                  "median": 1 - g.rel_ew_p50.to_numpy() / m1,
                                  "odds": (p1 - g.p_under_ew.to_numpy()) / (p1 - 0.5)}))
    t = pd.concat(rows, ignore_index=True)
    t.to_csv(C.OUTPUT / "fig_diversification.csv", index=False)
    line = t[t.H == H_LINE].set_index("N")
    lo, hi = t.groupby("N").min(), t.groupby("N").max()
    first = a[a.H == H_LINE].first_start.min()
    last = a[a.H == H_LINE].last_start.max()

    fig, ax = plt.subplots(figsize=(8.5, 5.6), dpi=200)
    fig.patch.set_facecolor(S.SURF)
    S.style(ax, "Share of the one-stock problem removed")
    N = line.index.to_numpy()
    ax.plot(N, line.textbook, color=S.INK2, lw=2, ls="--", label="Textbook: stock-specific variance removed (1 - 1/N)")
    ax.fill_between(lo.index, lo["median"], hi["median"], color=BLUE, alpha=0.14, lw=0)
    ax.plot(N, line["median"], color=BLUE, lw=2, label="Skew: typical (median) shortfall removed")
    ax.fill_between(lo.index, lo.odds, hi.odds, color=ORANGE, alpha=0.14, lw=0)
    ax.plot(N, line.odds, color=ORANGE, lw=2, label="Skew: excess odds of trailing the market removed")
    ax.set_xlim(1, 1000)
    ax.set_ylim(0, 1.04)

    ax.axvline(N_MARK, color=S.INK2, lw=0.8, ls=":")
    ax.text(N_MARK * 1.04, 0.015, f"{N_MARK} stocks", color=S.INK2, fontsize=8.5, va="bottom")
    for col, c in (("textbook", S.INK2), ("median", BLUE), ("odds", ORANGE)):
        y = line.loc[N_MARK, col]
        ax.plot([N_MARK], [y], "o", ms=7, color=c, mec=S.SURF, mew=1.5, zorder=5)
        ax.text(N_MARK * 0.93, y, f"{100 * y:.0f}%", color=S.INK, fontsize=9, ha="right",
                va="bottom" if col == "textbook" else "center", fontweight="bold")

    ax.text(2.6, 0.74, "Textbook", color=S.INK, fontsize=9, ha="right")
    ax.text(9, 0.52, "Typical shortfall", color=S.INK, fontsize=9, ha="left")
    ax.text(110, 0.47, "Odds of trailing", color=S.INK, fontsize=9, ha="left")
    ax.legend(frameon=False, fontsize=8, loc="lower right", bbox_to_anchor=(1.0, 0.04))

    fig.suptitle("How much diversification do N stocks buy? The textbook answer and the skewed one",
                 x=0.01, ha="left", fontsize=11.5, color=S.INK)
    fig.text(0.01, 0.925, f"US common stocks (CRSP), random equal-dollar portfolios bought and held {H_LINE} years, "
             f"quarterly starts {first[:4]}-{last[:4]}", ha="left", fontsize=8.5, color=S.INK2)
    fig.text(0.01, 0.005,
             "Textbook: share of a single stock's diversifiable variance removed, 1 - 1/N. Typical shortfall: median "
             "annualized return against the equal-weighted market,\nas a share of the one-stock median. Odds: "
             "P(trail the equal-weighted market) minus 50%, as a share of the one-stock excess. Both skew measures "
             "are zero at every N\nif returns are symmetric. Shading: range over 1-, 5-, 10- and 20-year holds.\n" + S.CRSP_NOTE,
             fontsize=6.3, color=S.INK2)
    fig.tight_layout(rect=(0, 0.085, 1, 0.985))
    fig.savefig(C.OUTPUT / "fig_diversification.png", facecolor=fig.get_facecolor())
    plt.close(fig)
    print("wrote", C.OUTPUT / "fig_diversification.png")


if __name__ == "__main__":
    main()
