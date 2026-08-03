/**
 * Tax-loss-harvesting partner candidates.
 *
 * The idea: to harvest a loss you sell a fund that's down and immediately buy
 * another covering the SAME slice of the market — so your allocation barely
 * changes — while staying clear of the wash-sale rule (IRC §1091), which
 * disallows the loss if you buy a "substantially identical" security within 30
 * days. The common practice is to pair funds that track DIFFERENT underlying
 * indexes; two funds on the *same* index (e.g. two S&P 500 funds) are the
 * classic thing to avoid.
 *
 * IMPORTANT: "substantially identical" is not defined by the IRS for funds that
 * track different indexes of the same market. This table is educational, not
 * tax advice, and not a claim that any specific swap is safe. The `index`
 * (family) is the field that matters for pairing: within a segment, a partner
 * is a fund whose `index` differs from the one you sold.
 *
 * Maintenance: fund/index mappings change occasionally (a fund can switch its
 * benchmark). Verify against the fund's current prospectus before relying on it.
 */

export interface TlhFund {
  ticker: string;
  name: string;
  provider: string;
  /** Index family the fund tracks — the field that must DIFFER between partners. */
  index: string;
}

export interface TlhSegment {
  id: string;
  name: string;
  blurb: string;
  /** Optional caution specific to this segment. */
  note?: string;
  funds: TlhFund[];
}

export const TLH_UPDATED = "2026-08";

export const TLH_SEGMENTS: TlhSegment[] = [
  {
    id: "us-total",
    name: "US total market",
    blurb: "Whole US stock market — large, mid, and small combined.",
    funds: [
      { ticker: "VTI / VTSAX", name: "Vanguard Total Stock Market", provider: "Vanguard", index: "CRSP US Total Market" },
      { ticker: "ITOT", name: "iShares Core S&P Total US Stock Market", provider: "iShares", index: "S&P Total Market" },
      { ticker: "SCHB / SWTSX", name: "Schwab US Broad Market / Total Stock", provider: "Schwab", index: "Dow Jones US Total/Broad" },
      { ticker: "FSKAX", name: "Fidelity Total Market Index", provider: "Fidelity", index: "Dow Jones US Total Market" },
      { ticker: "FZROX", name: "Fidelity ZERO Total Market", provider: "Fidelity", index: "Fidelity US Total Investable Mkt" },
    ],
  },
  {
    id: "us-large",
    name: "US large cap",
    blurb: "The biggest US companies. The S&P 500 funds below all track the SAME index — pair one of them with a different-index large-cap fund, not with each other.",
    note: "VOO, IVV, SPY, SPLG, and FXAIX all follow the S&P 500, so they are likely substantially identical to one another. Their natural partners are the CRSP or Dow Jones large-cap funds, or a total-market fund.",
    funds: [
      { ticker: "VOO / IVV / SPY / SPLG / FXAIX", name: "S&P 500 funds (multiple providers)", provider: "Various", index: "S&P 500" },
      { ticker: "VV / VLCAX", name: "Vanguard Large-Cap", provider: "Vanguard", index: "CRSP US Large Cap" },
      { ticker: "SCHX", name: "Schwab US Large-Cap", provider: "Schwab", index: "Dow Jones US Large-Cap" },
    ],
  },
  {
    id: "us-small",
    name: "US small cap",
    blurb: "Smaller US companies.",
    funds: [
      { ticker: "VB / VSMAX", name: "Vanguard Small-Cap", provider: "Vanguard", index: "CRSP US Small Cap" },
      { ticker: "IJR", name: "iShares Core S&P Small-Cap", provider: "iShares", index: "S&P SmallCap 600" },
      { ticker: "SCHA", name: "Schwab US Small-Cap", provider: "Schwab", index: "Dow Jones US Small-Cap" },
      { ticker: "VTWO / IWM", name: "Vanguard / iShares Russell 2000", provider: "Vanguard / iShares", index: "Russell 2000" },
    ],
  },
  {
    id: "us-extended",
    name: "US extended market (mid + small)",
    blurb: "The mid- and small-cap completion that turns an S&P 500 holding into the total market.",
    funds: [
      { ticker: "VXF / VEXAX", name: "Vanguard Extended Market", provider: "Vanguard", index: "S&P Completion" },
      { ticker: "FSMAX", name: "Fidelity Extended Market", provider: "Fidelity", index: "Dow Jones US Completion" },
    ],
  },
  {
    id: "dev-ex-us",
    name: "Developed markets ex-US",
    blurb: "Developed economies outside the US. FTSE and MSCI classify some countries (notably South Korea) differently, which helps make them non-identical.",
    funds: [
      { ticker: "VEA / VTMGX", name: "Vanguard FTSE Developed Markets", provider: "Vanguard", index: "FTSE Developed All Cap ex US" },
      { ticker: "SCHF", name: "Schwab International Equity", provider: "Schwab", index: "FTSE Developed ex US" },
      { ticker: "IEFA", name: "iShares Core MSCI EAFE", provider: "iShares", index: "MSCI EAFE IMI" },
      { ticker: "FSPSX / SWISX", name: "Fidelity / Schwab International Index", provider: "Fidelity / Schwab", index: "MSCI EAFE" },
      { ticker: "SPDW", name: "SPDR Portfolio Developed World ex-US", provider: "SPDR", index: "S&P Developed ex-US BMI" },
    ],
  },
  {
    id: "emerging",
    name: "Emerging markets",
    blurb: "Faster-growing, less-established markets. FTSE vs MSCI differ most here (Korea, and China share classes).",
    funds: [
      { ticker: "VWO / VEMAX", name: "Vanguard FTSE Emerging Markets", provider: "Vanguard", index: "FTSE Emerging All Cap" },
      { ticker: "SCHE", name: "Schwab Emerging Markets", provider: "Schwab", index: "FTSE Emerging" },
      { ticker: "IEMG", name: "iShares Core MSCI EM", provider: "iShares", index: "MSCI Emerging Markets IMI" },
      { ticker: "SPEM", name: "SPDR Portfolio Emerging Markets", provider: "SPDR", index: "S&P Emerging BMI" },
    ],
  },
  {
    id: "total-intl",
    name: "Total international (developed + emerging)",
    blurb: "All non-US stocks in one fund.",
    funds: [
      { ticker: "VXUS / VTIAX", name: "Vanguard Total International", provider: "Vanguard", index: "FTSE Global All Cap ex US" },
      { ticker: "IXUS", name: "iShares Core MSCI Total International", provider: "iShares", index: "MSCI ACWI ex US IMI" },
      { ticker: "FTIHX", name: "Fidelity Total International Index", provider: "Fidelity", index: "MSCI ACWI ex US IMI variant" },
    ],
  },
  {
    id: "us-bond",
    name: "US total bond",
    blurb: "The broad US investment-grade bond market.",
    note: "Bonds are trickier: most total-bond funds track a version of the Bloomberg US Aggregate, so they may be closer to substantially identical than stock-fund pairs. Some harvesters instead pair with a government or corporate bond fund to be safe.",
    funds: [
      { ticker: "BND / VBTLX", name: "Vanguard Total Bond Market", provider: "Vanguard", index: "Bloomberg US Aggregate Float-Adj" },
      { ticker: "AGG", name: "iShares Core US Aggregate Bond", provider: "iShares", index: "Bloomberg US Aggregate" },
      { ticker: "FXNAX", name: "Fidelity US Bond Index", provider: "Fidelity", index: "Bloomberg US Aggregate" },
      { ticker: "SPAB", name: "SPDR Portfolio Aggregate Bond", provider: "SPDR", index: "Bloomberg US Aggregate" },
    ],
  },
];
