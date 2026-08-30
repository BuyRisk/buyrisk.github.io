import { HISTORY } from "../../lib/bootstrap";

/**
 * Question bank for the calibration and anchoring games, with every "true"
 * answer computed live from the same Damodaran history the rest of the site
 * runs on — so the reveal can honestly say where the number comes from.
 */

export interface Fact {
  id: string;
  question: string;
  /** Unit suffix shown on inputs, e.g. "%" or "years". */
  unit: string;
  truth: number;
  /** Decimal places for display. */
  dp: number;
  /** Where the number comes from (shown in the reveal). */
  note: string;
}

const S = HISTORY.series;
const first = S[0].year;
const last = S[S.length - 1].year;
const pct = (x: number) => x * 100;

function build(): { calibration: Fact[]; anchoring: Fact[]; herding: Fact[] } {
  const best = S.reduce((a, y) => (y.stocks > a.stocks ? y : a));
  const worst = S.reduce((a, y) => (y.stocks < a.stocks ? y : a));
  const downYears = S.filter((y) => y.stocks < 0).length;
  const inflPeak = S.reduce((a, y) => (y.inflation > a.inflation ? y : a));
  const worstBond = S.reduce((a, y) => (y.tbonds < a.tbonds ? y : a));
  const beatBills = S.filter((y) => y.stocks > y.tbills).length;
  let streak = 0, longest = 0;
  for (const y of S) {
    streak = y.stocks < 0 ? streak + 1 : 0;
    longest = Math.max(longest, streak);
  }
  const stockMult = S.reduce((m, y) => m * (1 + y.stocks), 1);
  const cpiMult = S.reduce((m, y) => m * (1 + y.inflation), 1);
  const bestBill = S.reduce((a, y) => (y.tbills > a.tbills ? y : a));
  const up20 = S.filter((y) => y.stocks > 0.2).length;
  const bestBond = S.reduce((a, y) => (y.tbonds > a.tbonds ? y : a));
  const bondsBeatStocks = S.filter((y) => y.tbonds > y.stocks).length;

  const span = `${first}–${last}`;
  const src = `Computed from the Damodaran annual return history (${span}) that powers this site's simulators.`;

  return {
    calibration: [
      { id: "best-year", question: `Best single calendar year for US stocks since ${first}: what total return, in percent?`, unit: "%", truth: pct(best.stocks), dp: 0, note: `${best.year}: ${pct(best.stocks).toFixed(1)}%. ${src}` },
      { id: "worst-year", question: `Worst single calendar year for US stocks since ${first}: what total return, in percent? (Use a negative number.)`, unit: "%", truth: pct(worst.stocks), dp: 0, note: `${worst.year}: ${pct(worst.stocks).toFixed(1)}%. ${src}` },
      { id: "down-years", question: `Out of the ${S.length} calendar years since ${first}, how many did US stocks finish DOWN?`, unit: "years", truth: downYears, dp: 0, note: `${downYears} of ${S.length} — roughly one year in four. ${src}` },
      { id: "infl-peak", question: `The highest single-year US inflation since ${first}, in percent?`, unit: "%", truth: pct(inflPeak.inflation), dp: 0, note: `${inflPeak.year}: ${pct(inflPeak.inflation).toFixed(1)}%. ${src}` },
      { id: "worst-bond", question: `Worst single calendar year for 10-year US Treasury BONDS since ${first}, in percent? (Negative number.)`, unit: "%", truth: pct(worstBond.tbonds), dp: 0, note: `${worstBond.year}: ${pct(worstBond.tbonds).toFixed(1)}% — "safe" assets have bad years too. ${src}` },
      { id: "beat-bills", question: `In what percent of calendar years since ${first} did stocks beat cash (T-bills)?`, unit: "%", truth: (beatBills / S.length) * 100, dp: 0, note: `${beatBills} of ${S.length} years ≈ ${((beatBills / S.length) * 100).toFixed(0)}%. In any single year it's barely better than a coin flip. ${src}` },
      { id: "streak", question: `The longest run of consecutive DOWN years for US stocks since ${first}?`, unit: "years", truth: longest, dp: 0, note: `${longest} years (the Great Depression run). ${src}` },
      { id: "stock-mult", question: `$1 in US stocks in ${first}, dividends reinvested, grew to how many dollars by ${last} (nominal)?`, unit: "$", truth: stockMult, dp: 0, note: `About $${Math.round(stockMult).toLocaleString()}. Compounding at full horizon beats any intuition. ${src}` },
      { id: "best-bill", question: `The best single year for CASH (T-bills) since ${first} paid what, in percent?`, unit: "%", truth: pct(bestBill.tbills), dp: 1, note: `${bestBill.year}: ${pct(bestBill.tbills).toFixed(1)}% — the Volcker era. ${src}` },
      { id: "cpi-mult", question: `What cost $1 in ${first} costs how many dollars today?`, unit: "$", truth: cpiMult, dp: 0, note: `About $${cpiMult.toFixed(0)} — inflation's quiet compounding. ${src}` },
    ],
    herding: [
      { id: "up10", question: `Out of the ${S.length} calendar years since ${first}, how many saw US stocks gain more than 10%?`, unit: "years", truth: S.filter((y) => y.stocks > 0.1).length, dp: 0, note: `${S.filter((y) => y.stocks > 0.1).length} of ${S.length} years. ${src}` },
      { id: "infl-beat", question: `In how many calendar years since ${first} did inflation outrun the stock market?`, unit: "years", truth: S.filter((y) => y.inflation > y.stocks).length, dp: 0, note: `${S.filter((y) => y.inflation > y.stocks).length} of ${S.length} years. ${src}` },
      { id: "bill-mult", question: `$1 kept in CASH (T-bills) since ${first} grew to how many dollars (nominal)?`, unit: "$", truth: S.reduce((m, y) => m * (1 + y.tbills), 1), dp: 0, note: `About $${S.reduce((m, y) => m * (1 + y.tbills), 1).toFixed(0)} — versus roughly $${Math.round(S.reduce((m, y) => m * (1 + y.stocks), 1)).toLocaleString()} in stocks. ${src}` },
    ],
    anchoring: [
      { id: "up20", question: `How many calendar years since ${first} did US stocks gain more than 20%?`, unit: "years", truth: up20, dp: 0, note: `${up20} of ${S.length} years — big up-years are common. ${src}` },
      { id: "best-bond", question: `The best single year for 10-year Treasury bonds since ${first} returned what, in percent?`, unit: "%", truth: pct(bestBond.tbonds), dp: 0, note: `${bestBond.year}: ${pct(bestBond.tbonds).toFixed(1)}%. ${src}` },
      { id: "bonds-beat", question: `In how many calendar years since ${first} did bonds beat stocks?`, unit: "years", truth: bondsBeatStocks, dp: 0, note: `${bondsBeatStocks} of ${S.length} years. ${src}` },
      { id: "infl-mult", question: `$100 of groceries in 1970 costs about how many dollars today?`, unit: "$", truth: 100 * S.filter((y) => y.year >= 1970).reduce((m, y) => m * (1 + y.inflation), 1), dp: 0, note: `Computed from CPI since 1970. ${src}` },
    ],
  };
}

export const FACTS = build();
