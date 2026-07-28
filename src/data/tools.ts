/**
 * The canonical list of interactive tools. Both the Tools dropdown in the
 * header and the /tools overview page read from this, so a new tool added here
 * automatically appears in both places.
 */
export type Tool = {
  title: string;
  href: string;
  blurb: string;
  /** Optional short badge, e.g. "New". */
  tag?: string;
};

export const TOOLS: Tool[] = [
  {
    title: "Compound Growth Explorer",
    href: "/tools/compound-growth",
    blurb:
      "See how a starting balance, regular contributions, return, and time compound into long-run growth.",
  },
  {
    title: "Diversification: Waveforms",
    href: "/tools/waveforms",
    blurb:
      "The idea behind diversification, from first principles: how out-of-phase ups and downs cancel out.",
  },
  {
    title: "Diversification: Randomness",
    href: "/tools/randomness",
    blurb:
      "The noisy sequel: with real randomness, variance never fully cancels — and assets sometimes fall together.",
    tag: "New",
  },
  {
    title: "Portfolio Diversification Lab",
    href: "/tools/portfolio",
    blurb:
      "Mix assets and watch correlations, the efficient frontier, and the range of outcomes come to life.",
  },
  {
    title: "CAPM & the Security Market Line",
    href: "/tools/capm",
    blurb:
      "Measure an asset's beta from a return scatter, then see how beta alone sets its fair expected return.",
    tag: "New",
  },
];
