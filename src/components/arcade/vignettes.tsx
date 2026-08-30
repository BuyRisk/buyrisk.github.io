import type { VignetteConfig } from "./VignetteGame";

/**
 * The three vignette-game configs. Pair members share a `pair` key, are
 * separated in running order, and keep the SAME option index for the
 * logically-equivalent answer (VignetteGame scores an index mismatch within
 * a pair as one count of the bias).
 */

export const FRAMING: VignetteConfig = {
  gameId: "framing",
  items: [
    {
      id: "crisis-gain",
      pair: "crisis",
      text: "A crisis threatens a $600,000 portfolio. Two rescue plans: Plan A preserves $200,000 for certain. Plan B gives a 1-in-3 chance of preserving all $600,000, and a 2-in-3 chance of preserving nothing.",
      options: ["Plan A — the sure $200,000", "Plan B — the 1-in-3 shot at everything"],
    },
    {
      id: "fund-gain",
      pair: "fund",
      text: "You're investing a windfall for ten years. In its worst year on record, Fund G preserved 62% of its value; long-run it has beaten cash handily.",
      options: ["Invest in Fund G", "Keep the money in cash"],
    },
    {
      id: "crisis-loss",
      pair: "crisis",
      text: "A crisis threatens a $600,000 portfolio. Two rescue plans: Plan C loses $400,000 for certain. Plan D gives a 1-in-3 chance of losing nothing, and a 2-in-3 chance of losing all $600,000.",
      options: ["Plan C — the certain $400,000 loss", "Plan D — the 1-in-3 chance of losing nothing"],
    },
    {
      id: "fund-loss",
      pair: "fund",
      text: "You're investing a windfall for ten years. In its worst year on record, Fund L lost 38% of its value; long-run it has beaten cash handily.",
      options: ["Invest in Fund L", "Keep the money in cash"],
    },
  ],
  headline: (n, p) => `${n} of ${p} identical decisions flipped when the wording changed`,
  reveal: (n, p) => (
    <>
      <p className="ba-verdict">
        {n} of {p} of your answers <strong>flipped</strong> between logically identical scenarios.
      </p>
      <p>
        "Preserves $200,000 of $600,000" and "loses $400,000 of $600,000" are the same plan; a fund
        that "preserved 62%" and one that "lost 38%" are the same fund. That's{" "}
        <strong>framing</strong> (Tversky &amp; Kahneman, 1981) — in the original experiment, the
        share choosing the risky option jumped from 28% to 78% when identical outcomes were
        reworded from lives saved to lives lost. Gains make us play it safe; losses make us gamble.
      </p>
      <p>
        Every fund fact-sheet, headline, and pitch chooses its frame on purpose. The defense is
        mechanical: translate everything into the same units before deciding — end-of-year dollars,
        worst-year dollars, and the odds. If two descriptions imply the same numbers, your answer
        should be the same.
      </p>
    </>
  ),
};

export const SUNK_COST: VignetteConfig = {
  gameId: "sunk",
  items: [
    {
      id: "fund-sunk",
      pair: "fund",
      text: "Two years ago you paid a $500 non-refundable setup fee for an actively managed fund. It has trailed its index every year since. Switching to the index fund today is free.",
      options: ["Switch to the index fund", "Stay — otherwise the $500 was wasted"],
    },
    {
      id: "stock-sunk",
      pair: "stock",
      text: "You bought a stock at $80. The reason you bought it has since fallen apart, and it now trades at $50. You've identified a clearly better home for the money.",
      options: ["Sell and move the $50 to the better option", "Hold until it gets back to $80, then move"],
    },
    {
      id: "fund-clean",
      pair: "fund",
      text: "You're choosing a fund today for new money. Fund one has trailed its index every year for two years; fund two IS the index fund. Costs are otherwise identical.",
      options: ["The index fund", "The fund that has trailed for two years"],
    },
    {
      id: "stock-clean",
      pair: "stock",
      text: "You inherit $50 per share of a stock today — no history, no purchase price. Its prospects are mediocre, and you've identified a clearly better home for the money.",
      options: ["Move the money to the better option", "Keep the inherited shares"],
    },
  ],
  headline: (n, p) => `The past changed your answer in ${n} of ${p} matched decisions`,
  reveal: (n, p) => (
    <>
      <p className="ba-verdict">
        In {n} of {p} matched pairs, money already spent changed what you did with money{" "}
        <strong>not yet spent</strong>.
      </p>
      <p>
        The $500 fee is gone whether you stay or switch; the $30-per-share loss exists whether or
        not you "make it real." That's the <strong>sunk-cost fallacy</strong> (Arkes &amp; Blumer,
        1985): costs that no decision can recover keep voting anyway. The tell is that your answer
        differed from the clean-slate version of the same choice — the inheritance test.
      </p>
      <p>
        The portfolio-sized version: "I'll sell when I'm back to even" keeps money in broken theses
        for years. Ask the only forward-looking question — <em>if this arrived today as cash, is
        this where I'd put it?</em> — and the sunk costs lose their vote.
      </p>
    </>
  ),
};

export const OUTCOME: VignetteConfig = {
  gameId: "outcome",
  items: [
    {
      id: "lucky-gamble",
      pair: "gamble",
      text: "An investor put their entire emergency fund into one trendy stock. Within a year it doubled, and they bought a car with the profit. Judge the DECISION, not the person.",
      options: ["Good decision", "Bad decision"],
    },
    {
      id: "unlucky-plan",
      pair: "plan",
      text: "An investor followed their written plan and held a diversified index portfolio through 2008. That year the portfolio lost 35%. Judge the DECISION.",
      options: ["Good decision", "Bad decision"],
    },
    {
      id: "unlucky-gamble",
      pair: "gamble",
      text: "An investor put their entire emergency fund into one trendy stock. Within a year it fell 60%, and a job loss forced them to sell the rest at the bottom. Judge the DECISION.",
      options: ["Good decision", "Bad decision"],
    },
    {
      id: "lucky-plan",
      pair: "plan",
      text: "An investor followed their written plan and held a diversified index portfolio through 2019. That year the portfolio gained 30%. Judge the DECISION.",
      options: ["Good decision", "Bad decision"],
    },
  ],
  headline: (n, p) => `The outcome swayed your judgment in ${n} of ${p} matched cases`,
  reveal: (n, p) => (
    <>
      <p className="ba-verdict">
        You judged identical decisions differently in <strong>{n} of {p}</strong> matched pairs.
      </p>
      <p>
        Both "trendy stock" investors made exactly the same decision — betting the emergency fund on
        one ticket — and both index investors made exactly the same decision. Only the dice differed.
        Judging the choice by how the dice landed is <strong>outcome bias</strong> (Baron &amp;
        Hershey, 1988), and its evil twin, hindsight bias, quietly rewrites what "was obvious."
      </p>
      <p>
        Markets are a casino where good decisions lose often and bad ones get paid just often enough
        to teach the wrong lesson — the <a href="/tools/stock-picking">lottery-ticket math</a> in
        action. The remedy is keeping score on <em>process</em>: write down why before you act, and
        grade the reasoning later, not the luck.
      </p>
    </>
  ),
};
