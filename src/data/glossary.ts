/**
 * Plain-language investing glossary. Evergreen content — definitions, not data.
 * Each term is one or two sentences that define the jargon before it's used,
 * matching the site's voice. `see` optionally links to a tool or reference page
 * where the idea is shown in motion. Rendered alphabetically by the page.
 */
export interface Term {
  term: string;
  /** Short category tag, for the filter/label on the page. */
  tag:
    | "Core"
    | "Risk & return"
    | "Funds & fees"
    | "Accounts & tax"
    | "Bonds & rates"
    | "Markets";
  def: string;
  see?: { label: string; href: string };
}

export const GLOSSARY: Term[] = [
  { term: "12b-1 fee", tag: "Funds & fees", def: "An annual fee some mutual funds charge out of fund assets to pay for marketing and distribution. It is part of the expense ratio, and US rules cap it at 1% of assets a year.", see: { label: "What funds actually cost", href: "/info/fund-fees" } },
  { term: "Active share", tag: "Funds & fees", def: "The percentage of a fund's holdings that differ from its benchmark index. A high number means the manager really is betting differently; a low number means the portfolio largely mirrors the index.", see: { label: "Closet indexing", href: "/tools/beat-the-market#closet" } },
  { term: "Alpha", tag: "Risk & return", def: "Return that isn't explained by the risks a portfolio took — what's left after accounting for its exposure to the market and other factors. Measured alpha tends to shrink as more risk factors are accounted for.", see: { label: "Factors: beyond beta", href: "/tools/factors#factors" } },
  { term: "Asset allocation", tag: "Core", def: "How you split a portfolio across broad types of investments — stocks, bonds, cash. It's the single biggest driver of how your portfolio behaves.", see: { label: "Portfolio tool", href: "/tools/portfolio" } },
  { term: "Basis point", tag: "Funds & fees", def: "One hundredth of a percentage point (0.01%). A fee that goes from 0.50% to 0.55% rose by 5 basis points. Costs are often quoted this way." },
  { term: "Bear market", tag: "Markets", def: "A prolonged fall in prices, conventionally a drop of 20% or more from a recent peak. A 'bull market' is the opposite — a sustained rise." },
  { term: "Behavior gap", tag: "Core", def: "The difference between the return a fund reported and the return its average investor actually earned, created by buying and selling at the wrong moments. Fund returns ignore when money arrived; investor returns don't.", see: { label: "Your own worst enemy", href: "/tools/behavioral-finance#gap" } },
  { term: "Beta", tag: "Risk & return", def: "How much an investment tends to move with the overall market. A beta of 1 moves in line with the market; above 1 amplifies it, below 1 dampens it.", see: { label: "CAPM & Factors tool", href: "/tools/factors" } },
  { term: "Bond", tag: "Bonds & rates", def: "A loan you make to a government or company that pays regular interest and returns the principal at a set date. Generally steadier than stocks, with lower long-run returns." },
  { term: "CAGR", tag: "Core", def: "Compound annual growth rate — the single yearly rate that turns the starting value into the ending value. It is always lower than the simple average of the yearly returns whenever those returns vary.", see: { label: "Compound growth", href: "/tools/compound-growth#growth" } },
  { term: "CAPE ratio", tag: "Markets", def: "Price divided by the average of the last ten years of inflation-adjusted earnings. Averaging over a decade strips out the business cycle, making valuations comparable across long stretches of history.", see: { label: "Is the market expensive?", href: "/info/market-valuations" } },
  { term: "Capital gain", tag: "Accounts & tax", def: "The profit when you sell an investment for more than you paid. 'Realized' once you sell; taxed as short-term (held ≤1 year) or the lower long-term rate (>1 year)." },
  { term: "CAPM", tag: "Risk & return", def: "The capital asset pricing model: the idea that an asset's expected return depends on how much it moves with the overall market (its beta), not on the risk specific to that asset alone.", see: { label: "CAPM: the price of market risk", href: "/tools/factors#capm" } },
  { term: "Closet indexing", tag: "Funds & fees", def: "Charging active-management fees for a portfolio that closely tracks its benchmark. The fee is active; the holdings are not.", see: { label: "Closet indexing", href: "/tools/beat-the-market#closet" } },
  { term: "Compounding", tag: "Core", def: "Earning a return on your past returns, not just your original money. Given enough time it's the dominant force in building wealth.", see: { label: "Growth tool", href: "/tools/compound-growth" } },
  { term: "Concentration", tag: "Risk & return", def: "Holding a large share of a portfolio in a few positions. It widens the range of possible outcomes without raising expected return, because the risk it adds is idiosyncratic and therefore uncompensated.", see: { label: "How many is enough?", href: "/tools/stock-picking#count" } },
  { term: "Correlation", tag: "Risk & return", def: "How closely two investments move together, from −1 (opposite) to +1 (in lockstep). Low or negative correlation is what makes diversification work.", see: { label: "Historical returns", href: "/info/historical-returns" } },
  { term: "Diversification", tag: "Core", def: "Spreading money across many investments so no single one can sink you. Mixing things that don't move together lowers risk without necessarily lowering return.", see: { label: "Diversification tool", href: "/tools/diversification" } },
  { term: "Dividend", tag: "Core", def: "A share of a company's profits paid out to shareholders, usually quarterly. Reinvesting dividends is a big part of stocks' long-run 'total return.'" },
  { term: "Dollar-cost averaging", tag: "Core", def: "Investing a fixed amount on a regular schedule regardless of price. It removes the temptation to time the market and smooths your average purchase price.", see: { label: "Beat-the-Market tool", href: "/tools/beat-the-market" } },
  { term: "Drawdown", tag: "Risk & return", def: "The peak-to-trough fall in value before a new high is reached, quoted as a percentage. It measures the worst stretch an investor had to sit through, which is often what actually breaks a plan.", see: { label: "How much in stocks?", href: "/tools/portfolio#allocation" } },
  { term: "Duration", tag: "Bonds & rates", def: "A bond's sensitivity to interest-rate changes, in years. A duration of 7 means the price falls roughly 7% if rates rise 1 percentage point (and rises if they fall)." },
  { term: "Efficient frontier", tag: "Risk & return", def: "The set of portfolios that offer the most expected return for a given level of risk. The core idea of modern portfolio theory.", see: { label: "Portfolio tool", href: "/tools/portfolio" } },
  { term: "Efficient market hypothesis", tag: "Markets", def: "The idea that prices already reflect available information, so consistently beating the market is very hard. It's the theoretical backbone of index investing.", see: { label: "Beat-the-Market tool", href: "/tools/beat-the-market" } },
  { term: "ETF", tag: "Funds & fees", def: "Exchange-traded fund — a fund that trades on an exchange like a stock, all day. Most index ETFs are low-cost and tax-efficient. Compare with 'mutual fund.'" },
  { term: "Excess return", tag: "Risk & return", def: "Return above a benchmark — usually above the risk-free rate, sometimes above a comparison index. Risk premiums are measured as excess returns." },
  { term: "Expected return", tag: "Core", def: "The average outcome across all the ways the future could go, weighted by how likely each one is. It is not a prediction of any particular year; actual returns scatter widely around it." },
  { term: "Expense ratio", tag: "Funds & fees", def: "The percentage of your money a fund charges each year to run itself. Small numbers, but they're taken every year and compound against you.", see: { label: "Fund fees over time", href: "/info/fund-fees" } },
  { term: "Factor", tag: "Risk & return", def: "A shared, measurable trait — like company size or 'value' — that has historically explained differences in returns across stocks.", see: { label: "CAPM & Factors tool", href: "/tools/factors" } },
  { term: "Idiosyncratic risk", tag: "Risk & return", def: "Risk specific to one company — a failed product, a fraud, a lost lawsuit. Because you can remove it almost for free by owning many companies instead of a few, the market pays no premium for holding it. Also called diversifiable, specific, or unsystematic risk.", see: { label: "How many stocks is enough?", href: "/tools/stock-picking#count" } },
  { term: "Index fund", tag: "Funds & fees", def: "A fund that simply holds everything in a market index in proportion, rather than trying to pick winners. Low cost, and hard to beat over the long run.", see: { label: "Active vs. index", href: "/info/active-vs-index" } },
  { term: "Inflation", tag: "Core", def: "The gradual rise in prices, which erodes what each dollar can buy. Beating inflation — earning a positive 'real' return — is the whole point of investing.", see: { label: "Fees & Inflation tool", href: "/tools/fees" } },
  { term: "Liquidity", tag: "Markets", def: "How quickly and cheaply you can turn an investment into cash without moving its price. Stocks and Treasuries are highly liquid; a house or a small-company stake is not." },
  { term: "Market capitalization", tag: "Markets", def: "A company's total stock-market value — share price times shares outstanding. Broad index funds weight companies by their market cap.", see: { label: "Global market-cap breakdown", href: "/info/global-market-cap" } },
  { term: "Expense drag", tag: "Funds & fees", def: "The cumulative wealth lost to fees over time. Because a fee compounds against your whole balance every year, a small rate becomes a large sum over decades." },
  { term: "Mutual fund", tag: "Funds & fees", def: "A pooled fund priced once a day after the market closes. Index mutual funds and ETFs can track the same thing; the wrapper differs more than the substance." },
  { term: "NAV", tag: "Funds & fees", def: "Net asset value — the per-share value of a fund's holdings. Mutual funds transact at the day's NAV; ETF prices hover close to it during the day." },
  { term: "Nominal vs. real", tag: "Core", def: "A nominal return is the raw percentage; a real return subtracts inflation, showing the gain in actual buying power. Real is what you can spend." },
  { term: "Principal", tag: "Core", def: "The original amount you invest or borrow, before any returns or interest are added." },
  { term: "Rebalancing", tag: "Core", def: "Periodically trimming what's grown and topping up what's lagged to return to your target allocation. It enforces 'sell high, buy low' and controls risk." },
  { term: "Risk premium", tag: "Risk & return", def: "The extra expected return you're paid for taking on risk instead of holding something safe. Crucially, it is paid only for risk that can't be diversified away — concentrating in a few stocks raises your risk without raising your expected return.", see: { label: "Historical returns", href: "/info/historical-returns" } },
  { term: "Risk tolerance", tag: "Risk & return", def: "How much ups and downs you can stomach — financially and emotionally — without abandoning your plan. It should drive your stock/bond mix." },
  { term: "Roth vs. traditional", tag: "Accounts & tax", def: "Two tax treatments for retirement accounts. Traditional: deduct now, pay tax on withdrawal. Roth: pay tax now, withdraw tax-free later.", see: { label: "Contribution limits", href: "/info/contribution-limits" } },
  { term: "Sales load", tag: "Funds & fees", def: "A commission charged when buying (front-end) or selling (back-end) fund shares, separate from and on top of the ongoing expense ratio.", see: { label: "What funds actually cost", href: "/info/fund-fees" } },
  { term: "Sequence-of-returns risk", tag: "Risk & return", def: "The risk that the order of returns, not just their average, decides the outcome. It bites when money is being added or withdrawn: poor returns early in retirement do far more damage than the same returns later.", see: { label: "Will your money last?", href: "/tools/retirement" } },
  { term: "Sharpe ratio", tag: "Risk & return", def: "A measure of return earned per unit of risk (return above cash, divided by volatility). Higher means a better risk-adjusted result." },
  { term: "Skewness", tag: "Markets", def: "How lopsided a distribution of outcomes is. Individual stock returns are strongly right-skewed: most underperform, while a small number of very large winners pull the average up.", see: { label: "Why a few win", href: "/tools/stock-picking#super" } },
  { term: "Standard deviation", tag: "Risk & return", def: "A measure of how much a return bounces around its average — the most common yardstick for 'volatility,' or how bumpy the ride is." },
  { term: "Survivorship bias", tag: "Funds & fees", def: "Measuring only the funds or companies that still exist, which quietly deletes the failures and flatters the record. Databases that keep dead funds in show materially lower averages.", see: { label: "Beat it with active funds", href: "/tools/beat-the-market#beat" } },
  { term: "Systematic risk", tag: "Risk & return", def: "Risk that hits everything at once — the market falling, inflation, a recession — so spreading your money around can't remove it. Someone has to hold it, which is why it carries an expected premium. This is the risk investors are actually paid to bear. Also called market or undiversifiable risk.", see: { label: "How markets price risk", href: "/tools/factors" } },
  { term: "Tax-loss harvesting", tag: "Accounts & tax", def: "Selling an investment at a loss to offset gains or income, then buying a similar (but not 'substantially identical') replacement to stay invested.", see: { label: "TLH partners", href: "/info/tax-loss-harvesting" } },
  { term: "Ticker", tag: "Markets", def: "The short symbol that identifies a stock or fund on an exchange — VTI, AAPL, SPY. A shorthand, not a description of what you own." },
  { term: "Total return", tag: "Core", def: "An investment's full return counting both price change and income (dividends or interest). It's the number that actually matters for wealth." },
  { term: "Treasury", tag: "Bonds & rates", def: "Debt issued by the U.S. government — bills (≤1 year), notes (2–10 years), and bonds (20–30 years). Considered about the safest dollar investment.", see: { label: "Treasury yields", href: "/info/treasury-yields" } },
  { term: "Volatility", tag: "Risk & return", def: "How much an investment's value swings up and down. Higher volatility means a rougher ride — and, historically, is part of what higher-returning assets demand." },
  { term: "Volatility drag", tag: "Risk & return", def: "The gap between the average annual return and the compound return actually earned. The more returns bounce around, the wider the gap, because a loss needs a larger gain to undo it.", see: { label: "Volatility drag: the 2× trap", href: "/tools/fees#leverage" } },
  { term: "Wash sale", tag: "Accounts & tax", def: "An IRS rule that disallows a tax loss if you buy the same or a 'substantially identical' security within 30 days before or after the sale.", see: { label: "TLH partners", href: "/info/tax-loss-harvesting" } },
  { term: "Yield", tag: "Bonds & rates", def: "The income an investment pays as a percentage of its price — a bond's interest or a stock's dividend relative to what you paid." },
  { term: "Yield curve", tag: "Bonds & rates", def: "A snapshot of Treasury yields across maturities, from months to 30 years. Its shape hints at expectations for growth, inflation, and rates.", see: { label: "Treasury yields", href: "/info/treasury-yields" } },
];
