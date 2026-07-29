/**
 * Citation registry — the single source of truth for the studies and datasets
 * credited across the site. Each tool page renders its relevant subset via the
 * <Sources> component (keyed by TOOL_SOURCES), and the About page renders the
 * full catalogue. Add a source once here and it stays consistent everywhere.
 *
 * Study `venue` carries the full reference (journal, volume, pages) so a plain
 * text citation is unambiguous even without a link. DOIs/URLs are optional and
 * can be filled in over time; datasets always link to their publisher.
 */

export type StudyCategory =
  | "Portfolio theory"
  | "Asset pricing & the CAPM"
  | "Factor models"
  | "Market efficiency & active management"
  | "Diversification & return concentration"
  | "Valuation & long-run returns"
  | "Retirement & withdrawal";

/** Order categories appear in on the About page catalogue. */
export const STUDY_CATEGORY_ORDER: StudyCategory[] = [
  "Portfolio theory",
  "Asset pricing & the CAPM",
  "Factor models",
  "Market efficiency & active management",
  "Diversification & return concentration",
  "Valuation & long-run returns",
  "Retirement & withdrawal",
];

export interface Study {
  authors: string;
  year: number;
  title: string;
  /** Full reference tail: journal/publisher, volume(issue): pages. */
  venue: string;
  kind: "paper" | "book";
  category: StudyCategory;
  url?: string;
  note?: string;
}

export interface Dataset {
  name: string;
  publisher: string;
  url: string;
  note?: string;
}

export const STUDIES: Record<string, Study> = {
  // --- Portfolio theory ----------------------------------------------------
  markowitz1952: {
    authors: "Markowitz, H.",
    year: 1952,
    title: "Portfolio Selection",
    venue: "The Journal of Finance 7(1): 77–91",
    kind: "paper",
    category: "Portfolio theory",
    note: "The founding paper of modern portfolio theory.",
  },
  roy1952: {
    authors: "Roy, A. D.",
    year: 1952,
    title: "Safety First and the Holding of Assets",
    venue: "Econometrica 20(3): 431–449",
    kind: "paper",
    category: "Portfolio theory",
  },
  tobin1958: {
    authors: "Tobin, J.",
    year: 1958,
    title: "Liquidity Preference as Behavior Towards Risk",
    venue: "The Review of Economic Studies 25(2): 65–86",
    kind: "paper",
    category: "Portfolio theory",
    note: "Introduces the separation theorem.",
  },

  // --- Asset pricing & the CAPM -------------------------------------------
  treynor1962: {
    authors: "Treynor, J. L.",
    year: 1962,
    title: "Toward a Theory of Market Value of Risky Assets",
    venue: "Unpublished manuscript (circulated 1962; published 1999)",
    kind: "paper",
    category: "Asset pricing & the CAPM",
  },
  sharpe1964: {
    authors: "Sharpe, W. F.",
    year: 1964,
    title:
      "Capital Asset Prices: A Theory of Market Equilibrium under Conditions of Risk",
    venue: "The Journal of Finance 19(3): 425–442",
    kind: "paper",
    category: "Asset pricing & the CAPM",
  },
  lintner1965: {
    authors: "Lintner, J.",
    year: 1965,
    title:
      "The Valuation of Risk Assets and the Selection of Risky Investments in Stock Portfolios and Capital Budgets",
    venue: "The Review of Economics and Statistics 47(1): 13–37",
    kind: "paper",
    category: "Asset pricing & the CAPM",
  },
  mossin1966: {
    authors: "Mossin, J.",
    year: 1966,
    title: "Equilibrium in a Capital Asset Market",
    venue: "Econometrica 34(4): 768–783",
    kind: "paper",
    category: "Asset pricing & the CAPM",
  },
  famaMacBeth1973: {
    authors: "Fama, E. F., & MacBeth, J. D.",
    year: 1973,
    title: "Risk, Return, and Equilibrium: Empirical Tests",
    venue: "Journal of Political Economy 81(3): 607–636",
    kind: "paper",
    category: "Asset pricing & the CAPM",
  },

  // --- Factor models -------------------------------------------------------
  famaFrench1992: {
    authors: "Fama, E. F., & French, K. R.",
    year: 1992,
    title: "The Cross-Section of Expected Stock Returns",
    venue: "The Journal of Finance 47(2): 427–465",
    kind: "paper",
    category: "Factor models",
  },
  famaFrench1993: {
    authors: "Fama, E. F., & French, K. R.",
    year: 1993,
    title: "Common Risk Factors in the Returns on Stocks and Bonds",
    venue: "Journal of Financial Economics 33(1): 3–56",
    kind: "paper",
    category: "Factor models",
    note: "The three-factor model.",
  },
  famaFrench2015: {
    authors: "Fama, E. F., & French, K. R.",
    year: 2015,
    title: "A Five-Factor Asset Pricing Model",
    venue: "Journal of Financial Economics 116(1): 1–22",
    kind: "paper",
    category: "Factor models",
  },
  jegadeeshTitman1993: {
    authors: "Jegadeesh, N., & Titman, S.",
    year: 1993,
    title:
      "Returns to Buying Winners and Selling Losers: Implications for Stock Market Efficiency",
    venue: "The Journal of Finance 48(1): 65–91",
    kind: "paper",
    category: "Factor models",
    note: "Documents the momentum effect.",
  },
  carhart1997: {
    authors: "Carhart, M. M.",
    year: 1997,
    title: "On Persistence in Mutual Fund Performance",
    venue: "The Journal of Finance 52(1): 57–82",
    kind: "paper",
    category: "Factor models",
    note: "Adds momentum as a fourth factor.",
  },

  // --- Market efficiency & active management ------------------------------
  samuelson1965: {
    authors: "Samuelson, P. A.",
    year: 1965,
    title: "Proof That Properly Anticipated Prices Fluctuate Randomly",
    venue: "Industrial Management Review 6(2): 41–49",
    kind: "paper",
    category: "Market efficiency & active management",
  },
  fama1970: {
    authors: "Fama, E. F.",
    year: 1970,
    title: "Efficient Capital Markets: A Review of Theory and Empirical Work",
    venue: "The Journal of Finance 25(2): 383–417",
    kind: "paper",
    category: "Market efficiency & active management",
  },
  fama1991: {
    authors: "Fama, E. F.",
    year: 1991,
    title: "Efficient Capital Markets: II",
    venue: "The Journal of Finance 46(5): 1575–1617",
    kind: "paper",
    category: "Market efficiency & active management",
  },
  grossmanStiglitz1980: {
    authors: "Grossman, S. J., & Stiglitz, J. E.",
    year: 1980,
    title: "On the Impossibility of Informationally Efficient Markets",
    venue: "The American Economic Review 70(3): 393–408",
    kind: "paper",
    category: "Market efficiency & active management",
  },
  jensen1968: {
    authors: "Jensen, M. C.",
    year: 1968,
    title: "The Performance of Mutual Funds in the Period 1945–1964",
    venue: "The Journal of Finance 23(2): 389–416",
    kind: "paper",
    category: "Market efficiency & active management",
  },
  sharpe1966: {
    authors: "Sharpe, W. F.",
    year: 1966,
    title: "Mutual Fund Performance",
    venue: "The Journal of Business 39(1): 119–138",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "Introduces the reward-to-variability (Sharpe) ratio.",
  },
  sharpe1991: {
    authors: "Sharpe, W. F.",
    year: 1991,
    title: "The Arithmetic of Active Management",
    venue: "Financial Analysts Journal 47(1): 7–9",
    kind: "paper",
    category: "Market efficiency & active management",
  },
  famaFrench2010: {
    authors: "Fama, E. F., & French, K. R.",
    year: 2010,
    title: "Luck versus Skill in the Cross-Section of Mutual Fund Returns",
    venue: "The Journal of Finance 65(5): 1915–1947",
    kind: "paper",
    category: "Market efficiency & active management",
  },
  malkiel1973: {
    authors: "Malkiel, B. G.",
    year: 1973,
    title: "A Random Walk Down Wall Street",
    venue: "W. W. Norton & Company",
    kind: "book",
    category: "Market efficiency & active management",
  },

  // --- Diversification & return concentration -----------------------------
  evansArcher1968: {
    authors: "Evans, J. L., & Archer, S. H.",
    year: 1968,
    title: "Diversification and the Reduction of Dispersion: An Empirical Analysis",
    venue: "The Journal of Finance 23(5): 761–767",
    kind: "paper",
    category: "Diversification & return concentration",
  },
  eltonGruber1977: {
    authors: "Elton, E. J., & Gruber, M. J.",
    year: 1977,
    title: "Risk Reduction and Portfolio Size: An Analytical Solution",
    venue: "The Journal of Business 50(4): 415–437",
    kind: "paper",
    category: "Diversification & return concentration",
  },
  statman1987: {
    authors: "Statman, M.",
    year: 1987,
    title: "How Many Stocks Make a Diversified Portfolio?",
    venue: "Journal of Financial and Quantitative Analysis 22(3): 353–363",
    kind: "paper",
    category: "Diversification & return concentration",
  },
  bessembinder2018: {
    authors: "Bessembinder, H.",
    year: 2018,
    title: "Do Stocks Outperform Treasury Bills?",
    venue: "Journal of Financial Economics 129(3): 440–457",
    kind: "paper",
    category: "Diversification & return concentration",
  },
  bessembinder2023: {
    authors: "Bessembinder, H., Chen, T.-F., Choi, G., & Wei, K.-C. J.",
    year: 2023,
    title: "Long-Term Shareholder Returns: Evidence from 64,000 Global Stocks",
    venue: "Financial Analysts Journal 79(3): 33–63",
    kind: "paper",
    category: "Diversification & return concentration",
  },

  // --- Valuation & long-run returns ---------------------------------------
  shiller1981: {
    authors: "Shiller, R. J.",
    year: 1981,
    title:
      "Do Stock Prices Move Too Much to Be Justified by Subsequent Changes in Dividends?",
    venue: "The American Economic Review 71(3): 421–436",
    kind: "paper",
    category: "Valuation & long-run returns",
  },
  campbellShiller1988: {
    authors: "Campbell, J. Y., & Shiller, R. J.",
    year: 1988,
    title: "Stock Prices, Earnings, and Expected Dividends",
    venue: "The Journal of Finance 43(3): 661–676",
    kind: "paper",
    category: "Valuation & long-run returns",
  },
  shiller2000: {
    authors: "Shiller, R. J.",
    year: 2000,
    title: "Irrational Exuberance",
    venue: "Princeton University Press",
    kind: "book",
    category: "Valuation & long-run returns",
  },
  dimsonMarshStaunton2002: {
    authors: "Dimson, E., Marsh, P., & Staunton, M.",
    year: 2002,
    title: "Triumph of the Optimists: 101 Years of Global Investment Returns",
    venue: "Princeton University Press",
    kind: "book",
    category: "Valuation & long-run returns",
  },
  jorda2019: {
    authors: "Jordà, Ò., Knoll, K., Kuvshinov, D., Schularick, M., & Taylor, A. M.",
    year: 2019,
    title: "The Rate of Return on Everything, 1870–2015",
    venue: "The Quarterly Journal of Economics 134(3): 1225–1298",
    kind: "paper",
    category: "Valuation & long-run returns",
  },

  // --- Retirement & withdrawal --------------------------------------------
  bengen1994: {
    authors: "Bengen, W. P.",
    year: 1994,
    title: "Determining Withdrawal Rates Using Historical Data",
    venue: "Journal of Financial Planning 7(4): 171–180",
    kind: "paper",
    category: "Retirement & withdrawal",
    note: "Origin of the “4% rule.”",
  },
  cooley1998: {
    authors: "Cooley, P. L., Hubbard, C. M., & Walz, D. T.",
    year: 1998,
    title: "Retirement Savings: Choosing a Withdrawal Rate That Is Sustainable",
    venue: "AAII Journal 20(2): 16–21",
    kind: "paper",
    category: "Retirement & withdrawal",
    note: "The “Trinity study.”",
  },
  shovenSlavov2014: {
    authors: "Shoven, J. B., & Slavov, S. N.",
    year: 2014,
    title: "Does It Pay to Delay Social Security?",
    venue: "Journal of Pension Economics & Finance 13(2): 121–144",
    kind: "paper",
    category: "Retirement & withdrawal",
  },
};

export const DATASETS: Record<string, Dataset> = {
  french: {
    name: "Kenneth R. French Data Library",
    publisher: "Tuck School of Business, Dartmouth College",
    url: "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html",
  },
  crsp: {
    name: "CRSP US Stock Database",
    publisher: "Center for Research in Security Prices, LLC, via WRDS",
    url: "https://www.crsp.org/",
    note: "Used under license; only aggregate, non-identifiable statistics are published here.",
  },
  shiller: {
    name: "U.S. Stock Markets 1871–Present and CAPE Ratio",
    publisher: "Robert J. Shiller, Yale University",
    url: "https://shillerdata.com/",
  },
  damodaran: {
    name: "Historical Returns on Stocks, Bonds and Bills",
    publisher: "Aswath Damodaran, NYU Stern School of Business",
    url: "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datacurrent.html",
  },
  fred: {
    name: "Federal Reserve Economic Data (FRED)",
    publisher: "Federal Reserve Bank of St. Louis",
    url: "https://fred.stlouisfed.org/",
  },
  jst: {
    name: "The Jordà-Schularick-Taylor Macrohistory Database",
    publisher: "macrohistory.net",
    url: "https://www.macrohistory.net/database/",
  },
  ssa: {
    name: "Actuarial Life Tables & Benefit Data",
    publisher: "U.S. Social Security Administration",
    url: "https://www.ssa.gov/oact/",
  },
  ici: {
    name: "Trends in the Expenses and Fees of Funds",
    publisher: "Investment Company Institute",
    url: "https://www.ici.org/research/stats/fees",
    note: "Aggregate industry averages; only the reduced figures are published here.",
  },
  spiva: {
    name: "SPIVA U.S. Scorecard (Year-End 2025)",
    publisher: "S&P Dow Jones Indices",
    url: "https://www.spglobal.com/spdji/en/research-insights/spiva/",
    note: "Copyrighted report; only specific transcribed figures, with attribution, are published here.",
  },
};

export interface ToolSources {
  studies: string[];
  datasets: string[];
}

/** Keyed by the tool's slug (the last segment of its /tools/<slug> href). */
export const TOOL_SOURCES: Record<string, ToolSources> = {
  "compound-growth": {
    studies: [],
    datasets: ["shiller", "damodaran", "fred"],
  },
  inflation: {
    studies: [],
    datasets: ["fred"],
  },
  fees: {
    studies: ["sharpe1991", "malkiel1973"],
    datasets: ["ici"],
  },
  "active-vs-passive": {
    studies: ["sharpe1991", "famaFrench2010", "malkiel1973"],
    datasets: ["spiva"],
  },
  "rent-vs-buy": {
    studies: [],
    datasets: ["fred"],
  },
  "burn-rate": {
    studies: ["bengen1994", "cooley1998"],
    datasets: ["damodaran", "shiller"],
  },
  "social-security": {
    studies: ["shovenSlavov2014"],
    datasets: ["ssa"],
  },
  waveforms: {
    studies: ["markowitz1952"],
    datasets: ["damodaran"],
  },
  randomness: {
    studies: ["markowitz1952", "samuelson1965"],
    datasets: ["damodaran"],
  },
  "how-many-stocks": {
    studies: ["markowitz1952", "evansArcher1968", "eltonGruber1977", "statman1987"],
    datasets: ["crsp"],
  },
  superstocks: {
    studies: ["bessembinder2018", "bessembinder2023"],
    datasets: ["crsp"],
  },
  portfolio: {
    studies: ["markowitz1952", "tobin1958", "sharpe1966"],
    datasets: ["damodaran"],
  },
  capm: {
    studies: [
      "treynor1962",
      "sharpe1964",
      "lintner1965",
      "mossin1966",
      "famaMacBeth1973",
      "famaFrench1992",
    ],
    datasets: ["french"],
  },
  factors: {
    studies: [
      "famaFrench1992",
      "famaFrench1993",
      "famaFrench2015",
      "jegadeeshTitman1993",
      "carhart1997",
    ],
    datasets: ["french"],
  },
  "beat-the-market": {
    studies: [
      "samuelson1965",
      "fama1970",
      "fama1991",
      "grossmanStiglitz1980",
      "shiller1981",
      "malkiel1973",
      "jensen1968",
      "sharpe1991",
      "famaFrench2010",
    ],
    datasets: [],
  },
};
