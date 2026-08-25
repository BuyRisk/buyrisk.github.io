/**
 * Citation registry: the single source of truth for the studies and datasets
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
  peroldSharpe1988: {
    authors: "Perold, A. F., & Sharpe, W. F.",
    year: 1988,
    title: "Dynamic Strategies for Asset Allocation",
    venue: "Financial Analysts Journal 44(1): 16–27",
    kind: "paper",
    category: "Portfolio theory",
    note: "The classic taxonomy of buy-and-hold, constant-mix (rebalancing) and portfolio-insurance strategies. Rebalancing is concave: it does best in volatile but trendless markets and lags in trending ones — and because it buys more as prices fall, it offers less downside protection than buy-and-hold, not more.",
  },
  peroldSchulman1988: {
    authors: "Perold, A. F., & Schulman, E. C.",
    year: 1988,
    title: "The Free Lunch in Currency Hedging: Implications for Investment Policy and Performance Standards",
    venue: "Financial Analysts Journal 44(3): 45–50",
    kind: "paper",
    category: "Portfolio theory",
    note: "Argues currency hedging has ~zero long-run expected return, so it lowers risk for free.",
  },
  dammonSpattZhang2004: {
    authors: "Dammon, R. M., Spatt, C. S., & Zhang, H. H.",
    year: 2004,
    title: "Optimal Asset Location and Allocation with Taxable and Tax-Deferred Investing",
    venue: "The Journal of Finance 59(3): 999–1037",
    kind: "paper",
    category: "Portfolio theory",
    note: "Formalizes asset location: hold the more heavily-taxed asset (bonds) in the tax-deferred account.",
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
  black1973: {
    authors: "Black, F., & Scholes, M.",
    year: 1973,
    title: "The Pricing of Options and Corporate Liabilities",
    venue: "Journal of Political Economy 81(3): 637–654",
    kind: "paper",
    category: "Asset pricing & the CAPM",
    note: "The Black–Scholes option-pricing formula.",
  },
  merton1973: {
    authors: "Merton, R. C.",
    year: 1973,
    title: "Theory of Rational Option Pricing",
    venue: "The Bell Journal of Economics and Management Science 4(1): 141–183",
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
  kahnemanTversky1979: {
    authors: "Kahneman, D., & Tversky, A.",
    year: 1979,
    title: "Prospect Theory: An Analysis of Decision under Risk",
    venue: "Econometrica 47(2): 263–291",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "The foundation of behavioral finance; losses loom larger than equivalent gains.",
  },
  tverskyKahneman1974: {
    authors: "Tversky, A., & Kahneman, D.",
    year: 1974,
    title: "Judgment under Uncertainty: Heuristics and Biases",
    venue: "Science 185(4157): 1124–1131",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "Anchoring, availability, and representativeness — including the wheel-of-fortune anchoring experiment the arcade's 'wheel' game recreates.",
  },
  tverskyKahneman1981: {
    authors: "Tversky, A., & Kahneman, D.",
    year: 1981,
    title: "The Framing of Decisions and the Psychology of Choice",
    venue: "Science 211(4481): 453–458",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "Identical outcomes, opposite choices when worded as gains vs losses — the design behind the arcade's framing game.",
  },
  shefrinStatman1985: {
    authors: "Shefrin, H., & Statman, M.",
    year: 1985,
    title: "The Disposition to Sell Winners Too Early and Ride Losers Too Long: Theory and Evidence",
    venue: "Journal of Finance 40(3): 777–790",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "Named the disposition effect the arcade's 'Sell something' game measures.",
  },
  odean1998: {
    authors: "Odean, T.",
    year: 1998,
    title: "Are Investors Reluctant to Realize Their Losses?",
    venue: "Journal of Finance 53(5): 1775–1798",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "10,000 brokerage accounts: investors realize gains far more readily than losses, and the winners they sell go on to beat the losers they keep.",
  },
  arkesBlumer1985: {
    authors: "Arkes, H. R., & Blumer, C.",
    year: 1985,
    title: "The Psychology of Sunk Cost",
    venue: "Organizational Behavior and Human Decision Processes 35(1): 124–140",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "Money already spent keeps voting on decisions it can't affect — the arcade's sunk-cost vignettes.",
  },
  baronHershey1988: {
    authors: "Baron, J., & Hershey, J. C.",
    year: 1988,
    title: "Outcome Bias in Decision Evaluation",
    venue: "Journal of Personality and Social Psychology 54(4): 569–579",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "Identical decisions judged differently by how the dice landed — the arcade's 'Good call?' game.",
  },
  alpertRaiffa1982: {
    authors: "Alpert, M., & Raiffa, H.",
    year: 1982,
    title: "A Progress Report on the Training of Probability Assessors",
    venue: "in Kahneman, Slovic & Tversky (eds.), Judgment under Uncertainty",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "The 90%-confidence-interval calibration test (first circulated 1969): people's '90% sure' ranges trap the truth less than half the time.",
  },
  asch1955: {
    authors: "Asch, S. E.",
    year: 1955,
    title: "Opinions and Social Pressure",
    venue: "Scientific American 193(5): 31–35",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "The line-length conformity experiments: 75% of subjects denied their own eyes at least once to agree with a group — the arcade's 'crowd' game.",
  },
  bikhchandaniHirshleiferWelch1992: {
    authors: "Bikhchandani, S., Hirshleifer, D., & Welch, I.",
    year: 1992,
    title: "A Theory of Fads, Fashion, Custom, and Cultural Change as Informational Cascades",
    venue: "Journal of Political Economy 100(5): 992–1026",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "How rational copying snowballs into cascades and manias.",
  },
  kahnemanKnetschThaler1990: {
    authors: "Kahneman, D., Knetsch, J. L., & Thaler, R. H.",
    year: 1990,
    title: "Experimental Tests of the Endowment Effect and the Coase Theorem",
    venue: "Journal of Political Economy 98(6): 1325–1348",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "The coffee-mug experiments: owners demand about twice what buyers will pay for the identical item — the arcade's 'Yours to sell' game.",
  },
  fischhoff1975: {
    authors: "Fischhoff, B.",
    year: 1975,
    title: "Hindsight ≠ Foresight: The Effect of Outcome Knowledge on Judgment under Uncertainty",
    venue: "Journal of Experimental Psychology: Human Perception and Performance 1(3): 288–299",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "Creeping determinism: knowing an outcome inflates how predictable it feels — the arcade's 'You knew it all along' game.",
  },
  dicksonShoven1995: {
    authors: "Dickson, J. M., & Shoven, J. B.",
    year: 1995,
    title: "Taxation and Mutual Funds: An Investor Perspective",
    venue: "Tax Policy and the Economy 9: 151–180",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "Quantifies how fund turnover and distributions erode after-tax returns.",
  },
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
  barberOdean2000: {
    authors: "Barber, B. M., & Odean, T.",
    year: 2000,
    title: "Trading Is Hazardous to Your Wealth: The Common Stock Investment Performance of Individual Investors",
    venue: "The Journal of Finance 55(2): 773–806",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "The more households traded, the worse they did: the most active fifth trailed the market by about 6.5 points a year, mostly from trading costs.",
  },
  morningstarMindTheGap2026: {
    authors: "Ptak, J.",
    year: 2026,
    title: "Mind the Gap 2026: US stock fund investors made history; crypto mavens stumbled",
    venue: "Morningstar Portfolio and Planning Research",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "The authoritative investor-return-gap study. Over the 10 years to Dec. 2025, the average dollar earned 8.7%/yr vs. funds' 9.9% total return — a ~1.2pp gap; the US-equity gap was just ~0.5pp, matching this tool's CRSP figure. The gap widens with category volatility (sector and alternative funds worst).",
  },
  cremersPetajisto2009: {
    authors: "Cremers, M., & Petajisto, A.",
    year: 2009,
    title: "How Active Is Your Fund Manager? A New Measure That Predicts Performance",
    venue: "The Review of Financial Studies 22(9): 3329–3365",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "Introduced Active Share — the fraction of holdings that differ from the benchmark. Funds with the highest Active Share beat their benchmarks; closet indexers (low Active Share, active fees) lagged.",
  },
  petajisto2013: {
    authors: "Petajisto, A.",
    year: 2013,
    title: "Active Share and Mutual Fund Performance",
    venue: "Financial Analysts Journal 69(4): 73–93",
    kind: "paper",
    category: "Market efficiency & active management",
    note: "Documents the rise of closet indexing and frames the fee on the active slice: a low Active Share turns a modest expense ratio into a steep effective fee on the part that's genuinely active.",
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
  frenchPoterba1991: {
    authors: "French, K. R., & Poterba, J. M.",
    year: 1991,
    title: "Investor Diversification and International Equity Markets",
    venue: "American Economic Review 81(2): 222–226",
    kind: "paper",
    category: "Diversification & return concentration",
    note: "The classic documentation of home bias: investors hold far more domestic equity than market weights imply.",
  },
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
  guytonKlinger2006: {
    authors: "Guyton, J. T., & Klinger, W. J.",
    year: 2006,
    title: "Decision Rules and Maximum Initial Withdrawal Rates",
    venue: "Journal of Financial Planning 19(3): 48–58",
    kind: "paper",
    category: "Retirement & withdrawal",
    note: "The guardrails approach: flexing spending with decision rules (capital-preservation and prosperity rules) lets you start at a higher withdrawal rate without running out.",
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
  aqr: {
    name: "AQR Factor & Quality-Minus-Junk / Betting-Against-Beta datasets",
    publisher: "AQR Capital Management",
    url: "https://www.aqr.com/Insights/Datasets",
    note: "Quality (QMJ) and Defensive (Betting-Against-Beta) factor premia. Provided for research/educational use; we ship long-run annualized summary figures only.",
  },
  pastorStambaugh: {
    name: "Liquidity factor (traded)",
    publisher: "Ľuboš Pástor & Robert F. Stambaugh",
    url: "https://faculty.chicagobooth.edu/lubos-pastor/data",
    note: "The traded liquidity factor, monthly from 1968. We ship its long-run annualized premium only.",
  },
  petajisto: {
    name: "Active Share dataset (US equity mutual funds)",
    publisher: "Antti Petajisto",
    url: "https://www.petajisto.net/data.html",
    note: "Used per the author's terms, which require citing this website as the source and citing Petajisto (2013). We ship asset-weighted aggregates only; the raw fund-level panel is licensed and not redistributed.",
  },
  crsp: {
    name: "CRSP US Stock Database",
    publisher: "Center for Research in Security Prices, LLC, via WRDS",
    url: "https://www.crsp.org/",
    note: "Used under license; only aggregate, non-identifiable statistics are published here.",
  },
  crspSp500: {
    name: "CRSP S&P 500 Indexes & Daily Constituents",
    publisher: "Center for Research in Security Prices, LLC, via WRDS",
    url: "https://www.crsp.org/",
    note: "Used under license. We ship only index-level aggregates — month-end concentration, index returns, and a few decade snapshots of top-10 tickers; no per-stock time series is redistributed.",
  },
  crspMf: {
    name: "CRSP Survivor-Bias-Free US Mutual Fund Database",
    publisher: "Center for Research in Security Prices, LLC, via WRDS",
    url: "https://www.crsp.org/",
    note: "Used under license. The behavior gap is computed from fund monthly returns and net assets; only universe-level aggregates and a few illustrative fund figures are published — no full per-fund panel is redistributed.",
  },
  irsRevProc: {
    name: "IRS Revenue Procedures (annual inflation adjustments) & H.R.1 (2025)",
    publisher: "Internal Revenue Service / US Congress",
    url: "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf",
    note: "Federal brackets, standard deductions, capital-gains thresholds, EIC and Child Tax Credit parameters, and saver's-credit tiers by tax year, plus Medicare IRMAA tiers (CMS). Collated via the community-maintained Case Study Spreadsheet (Mr. Money Mustache forums), whose marginal-rate analysis inspired this tool; our engine is validated against it.",
  },
  thomsonS12: {
    name: "Thomson Reuters Mutual Fund Holdings (s12)",
    publisher: "LSEG / Refinitiv, via WRDS",
    url: "https://wrds-www.wharton.upenn.edu/",
    note: "Used under license. Fund portfolio overlap is computed from quarterly holdings filings; only fund names and summary overlap statistics are published — no positions are redistributed.",
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
  ftseGlobalAllCap: {
    name: "FTSE Global All Cap Index — Factsheet",
    publisher: "FTSE Russell (LSEG)",
    url: "https://research.ftserussell.com/Analytics/Factsheets/Home/DownloadSingleIssue?issueName=GEISLMS&IsManual=false",
    note: "Monthly factsheet for the whole-world index Vanguard's VT tracks. The region weights on this site are refreshed from here.",
  },
  vanguardVT: {
    name: "Total World Stock ETF (VT) — Portfolio composition",
    publisher: "The Vanguard Group",
    url: "https://investor.vanguard.com/investment-products/etfs/profile/vt",
    note: "Region allocations used to cross-check and seed the market-cap breakdown.",
  },
  irsPub550: {
    name: "Publication 550: Investment Income and Expenses (Wash Sales)",
    publisher: "Internal Revenue Service",
    url: "https://www.irs.gov/publications/p550",
    note: "The wash-sale rule (IRC §1091) and the “substantially identical” standard. The IRS does not define the term for funds tracking different indexes.",
  },
  bls: {
    name: "Consumer Price Index (CPI) series",
    publisher: "U.S. Bureau of Labor Statistics, via FRED",
    url: "https://www.bls.gov/cpi/",
    note: "Annual price levels by spending category.",
  },
  irsRetirementLimits: {
    name: "2026 Retirement Plan Contribution Limits (COLA)",
    publisher: "Internal Revenue Service",
    url: "https://www.irs.gov/retirement-plans/cola-increases-for-dollar-limitations-on-benefits-and-contributions",
    note: "Elective deferral, catch-up, and IRA limits and phase-outs, indexed annually.",
  },
  irsHsaLimits: {
    name: "Rev. Proc. 2025-19 (2026 HSA & HDHP limits)",
    publisher: "Internal Revenue Service",
    url: "https://www.irs.gov/pub/irs-drop/rp-25-19.pdf",
    note: "Inflation-adjusted HSA contribution limits and HDHP parameters for 2026.",
  },
  irsPub915: {
    name: "Publication 915: Social Security and Equivalent Railroad Retirement Benefits",
    publisher: "Internal Revenue Service",
    url: "https://www.irs.gov/publications/p915",
    note: "The worksheet for how much of a Social Security benefit is federally taxable.",
  },
  cmsIrmaa: {
    name: "2026 Medicare Parts B & D Premiums (IRMAA)",
    publisher: "Centers for Medicare & Medicaid Services",
    url: "https://www.medicare.gov/basics/costs/medicare-costs",
    note: "Income-related monthly adjustment amounts and tiers, based on MAGI from two years prior.",
  },
  bogleheads: {
    name: "Prioritizing investments",
    publisher: "Bogleheads wiki",
    url: "https://www.bogleheads.org/wiki/Prioritizing_investments",
    note: "The community 'order of operations' the Next Dollar ladder follows.",
  },
  treasuryDaily: {
    name: "Daily Treasury Par Yield Curve Rates",
    publisher: "U.S. Department of the Treasury",
    url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve",
    note: "The daily CMT par yields, fetched client-side from Treasury's public CSV feed (no API key).",
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
    studies: ["bengen1994", "cooley1998"],
    datasets: ["shiller", "damodaran", "fred"],
  },
  fees: {
    studies: ["sharpe1991", "malkiel1973", "dammonSpattZhang2004", "dicksonShoven1995"],
    datasets: ["ici", "fred", "crspMf", "french"],
  },
  "rent-vs-buy": {
    studies: [],
    datasets: ["fred"],
  },
  diversification: {
    studies: ["markowitz1952", "samuelson1965"],
    datasets: ["damodaran", "crspSp500"],
  },
  "stock-picking": {
    studies: ["markowitz1952", "evansArcher1968", "eltonGruber1977", "statman1987", "bessembinder2018", "bessembinder2023", "black1973", "merton1973"],
    datasets: ["crsp"],
  },
  portfolio: {
    studies: ["markowitz1952", "tobin1958", "sharpe1966", "peroldSharpe1988"],
    datasets: ["damodaran", "fred"],
  },
  factors: {
    studies: [
      "treynor1962",
      "sharpe1964",
      "lintner1965",
      "mossin1966",
      "famaMacBeth1973",
      "famaFrench1992",
      "famaFrench1993",
      "famaFrench2015",
      "jegadeeshTitman1993",
      "carhart1997",
    ],
    datasets: ["french", "aqr", "pastorStambaugh"],
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
      "barberOdean2000",
      "cremersPetajisto2009",
      "petajisto2013",
      "carhart1997",
    ],
    datasets: ["french", "shiller", "spiva", "petajisto", "crspMf", "thomsonS12", "crspSp500"],
  },
  retirement: {
    studies: ["bengen1994", "cooley1998", "guytonKlinger2006"],
    datasets: ["damodaran", "shiller"],
  },
  "retirement-accounts": {
    studies: ["shovenSlavov2014"],
    datasets: ["ssa", "irsPub915", "cmsIrmaa"],
  },
  options: {
    studies: ["black1973", "merton1973"],
    datasets: [],
  },
  "risk-tolerance": {
    studies: ["markowitz1952"],
    datasets: ["damodaran"],
  },
  "behavioral-finance": {
    studies: [
      "kahnemanTversky1979", "barberOdean2000", "morningstarMindTheGap2026",
      "tverskyKahneman1974", "tverskyKahneman1981", "shefrinStatman1985",
      "odean1998", "arkesBlumer1985", "baronHershey1988", "alpertRaiffa1982",
      "asch1955", "bikhchandaniHirshleiferWelch1992", "kahnemanKnetschThaler1990", "fischhoff1975",
    ],
    datasets: ["french", "crspMf", "damodaran"],
  },
  "next-dollar": {
    studies: [],
    datasets: ["bogleheads", "irsRevProc"],
  },
  global: {
    studies: ["frenchPoterba1991", "peroldSchulman1988"],
    datasets: ["ftseGlobalAllCap", "vanguardVT", "french"],
  },
};
