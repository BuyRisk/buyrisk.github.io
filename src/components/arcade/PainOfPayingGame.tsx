import { useState } from "react";
import type { GameResult } from "./store";

/**
 * "Does spending hurt?" — the Spendthrift–Tightwad scale of Rick, Cryder &
 * Loewenstein (2008, Journal of Consumer Research 34(6): 767–782), reproduced
 * verbatim from the paper's appendix. Four items, summed to 4–26; items 2b
 * and 3 are reverse-scored. Cutoffs: tightwad 4–11, unconflicted 12–18,
 * spendthrift 19–26. Sourced 2026-09-13 from the authors' working-paper
 * appendix; do not reword — a validated scale is only validated verbatim.
 *
 * The site's twist is on the reveal, not the instrument: both ends cost
 * money, in opposite directions, and there is a tool for each. The arcade
 * score is DISTANCE from the unconflicted center (15), so the radar reads
 * "how strongly does this show up," the same as every other game.
 */

interface Item {
  id: string;
  prompt: React.ReactNode;
  /** Scale labels, index 0 = value 1. Empty strings for unlabeled points. */
  labels: string[];
  reverse: boolean;
  min: number;
  max: number;
}

const DESCRIPTIONS = (
  <>
    <p>
      Some people have trouble limiting their spending: they often spend money—for example on
      clothes, meals, vacations, phone calls—when they would do better not to.
    </p>
    <p>
      Other people have trouble spending money. Perhaps because spending money makes them anxious,
      they often don't spend money on things they should spend it on.
    </p>
  </>
);

const ITEMS: Item[] = [
  {
    id: "self",
    prompt: <p className="ba-question">Which of the following descriptions fits you better?</p>,
    labels: ["Tightwad (difficulty spending money)", "", "", "", "", "About the same or neither", "", "", "", "", "Spendthrift (difficulty controlling spending)"],
    reverse: false,
    min: 1,
    max: 11,
  },
  {
    id: "limit",
    prompt: (
      <>
        {DESCRIPTIONS}
        <p className="ba-question">How well does the first description fit you? That is, do you have trouble limiting your spending?</p>
      </>
    ),
    labels: ["Never", "Rarely", "Sometimes", "Often", "Always"],
    reverse: false,
    min: 1,
    max: 5,
  },
  {
    id: "spend",
    prompt: (
      <>
        {DESCRIPTIONS}
        <p className="ba-question">How well does the second description fit you? That is, do you have trouble spending money?</p>
      </>
    ),
    labels: ["Never", "Rarely", "Sometimes", "Often", "Always"],
    reverse: true,
    min: 1,
    max: 5,
  },
  {
    id: "mall",
    prompt: (
      <>
        <p>Following is a scenario describing the behavior of two shoppers. After reading about each shopper, please answer the question that follows.</p>
        <p>
          Mr. A is accompanying a good friend who is on a shopping spree at a local mall. When they
          enter a large department store, Mr. A sees that the store has a "one-day-only-sale" where
          everything is priced 10–60% off. He realizes he doesn't need anything, yet can't resist and
          ends up spending almost $100 on stuff.
        </p>
        <p>
          Mr. B is accompanying a good friend who is on a shopping spree at a local mall. When they
          enter a large department store, Mr. B sees that the store has a "one-day-only-sale" where
          everything is priced 10–60% off. He figures he can get great deals on many items that he
          needs, yet the thought of spending the money keeps him from buying the stuff.
        </p>
        <p className="ba-question">In terms of your own behavior, who are you more similar to, Mr. A or Mr. B?</p>
      </>
    ),
    labels: ["Mr. A", "", "About the same or neither", "", "Mr. B"],
    reverse: true,
    min: 1,
    max: 5,
  },
];

type Band = "tightwad" | "unconflicted" | "spendthrift";
const band = (total: number): Band => (total <= 11 ? "tightwad" : total >= 19 ? "spendthrift" : "unconflicted");

export default function PainOfPayingGame({ onDone }: { onDone: (r: GameResult) => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  const item = ITEMS[i];

  const submit = () => {
    if (picked === null) return;
    const raw = picked;
    const scored = item.reverse ? item.max + item.min - raw : raw;
    const next = [...answers, scored];
    setAnswers(next);
    setPicked(null);
    if (i + 1 < ITEMS.length) {
      setI(i + 1);
      return;
    }
    setFinished(true);
    const total = next.reduce((s, x) => s + x, 0);
    const b = band(total);
    // Distance from the unconflicted center, 0–100. Center is 15; the far
    // ends are 4 and 26, eleven points away.
    const score = Math.round(Math.min(100, (Math.abs(total - 15) / 11) * 100));
    onDone({
      gameId: "painofpaying",
      score,
      headline:
        b === "tightwad"
          ? `Scored ${total} of 26 — a tightwad: spending hurts more than it should`
          : b === "spendthrift"
            ? `Scored ${total} of 26 — a spendthrift: spending hurts less than it should`
            : `Scored ${total} of 26 — unconflicted: spending hurts about the right amount`,
      playedAt: Date.now(),
    });
  };

  if (finished) {
    const total = answers.reduce((s, x) => s + x, 0);
    const b = band(total);
    return (
      <div className="ba-reveal">
        <p className="ba-verdict">
          You scored <strong>{total}</strong> on a scale of 4 to 26 — {b === "unconflicted" ? "the" : "a"}{" "}
          <strong>{b}</strong>
          {b === "tightwad" && " (4–11)"}
          {b === "unconflicted" && " zone (12–18)"}
          {b === "spendthrift" && " (19–26)"}.
        </p>
        <p>
          That was the <strong>Spendthrift–Tightwad scale</strong> (Rick, Cryder &amp; Loewenstein, 2008),
          reproduced word for word. It measures one thing: the <em>pain of paying</em> — how much it
          hurts, in the moment, to let money go. Tightwads feel too much of it and spend less than
          they'd like to; spendthrifts feel too little and spend more. Across 13,327 people, tightwads
          outnumbered spendthrifts three to two, and the score tracked credit-card debt and savings
          while barely tracking income: the differences are habit, not paycheck.
        </p>
        {b === "tightwad" && (
          <p>
            Here is the part the scale's authors emphasize and the part this site cares about: a
            tightwad is not a saver. Saving is a plan; the pain of paying is a flinch, and it fires
            at the grocery store and at the brokerage alike. The tightwad's characteristic cost is{" "}
            <strong>cash that never gets invested</strong> — money parked where it feels safe while{" "}
            <a href="/tools/fees#inflation">inflation quietly takes a share every year</a> and{" "}
            <a href="/tools/compound-growth">compounding runs without it</a>. The flinch also makes
            you a soft target for wording: in the study, tightwads were nearly five times less
            likely than spendthrifts to pay a $5 shipping fee, but when the same fee was called
            "a small $5 fee" the gap almost vanished. One adjective. Knowing that is most of the
            defense.
          </p>
        )}
        {b === "spendthrift" && (
          <p>
            The spendthrift's cost is the obvious one, and the numbers agree: in the study, spendthrifts
            carried more credit-card debt and held less in savings, at the same income. The site's
            answer is not a budget lecture; it's making the future cost visible before the flinch
            fails to fire. <a href="/personal-finance/money-basics#budget">The 50/30/20 budget</a>{" "}
            gives the spending a lane, the <a href="/tools/compound-growth#savings">savings-rate
            tool</a> shows what each percent of income buys in years of freedom, and the{" "}
            <a href="/tools/compound-growth#debt">cost-of-debt tool</a> shows what a balance carried
            at 22% actually charges. Spendthrifts in the study were nearly immune to how a fee was
            worded — which cuts both ways: harder to nudge into paying, and harder to nudge out.
          </p>
        )}
        {b === "unconflicted" && (
          <p>
            Most people land here — about six in ten in the study — and it means the pain of paying
            is doing its job: deterring spending you'd regret without blocking spending you should
            do. The residual risk is drift, in either direction, and the two tools that catch it are
            the <a href="/tools/compound-growth#savings">savings-rate tool</a> (are you converting
            income into freedom?) and the <a href="/tools/fees#inflation">inflation tab</a> (is your
            cash cushion bigger than it needs to be?).
          </p>
        )}
        <p>
          The site's thesis, applied to temperament: there is no free lunch in caution any more
          than in spending. Both ends pay — one in interest, the other in growth foregone. The
          scale is public, and{" "}
          <a href="https://umich.qualtrics.com/jfe/form/SV_55xxAQrYK0WRlY2">the authors host their
          own copy</a> if you'd like the original.
        </p>
      </div>
    );
  }

  const values = Array.from({ length: item.max - item.min + 1 }, (_, k) => item.min + k);
  return (
    <div className="ba-play">
      <p className="ba-progress">Question {i + 1} of {ITEMS.length}</p>
      {item.prompt}
      <div className={`pp-scale ${item.max === 11 ? "pp-scale--wide" : ""}`} role="radiogroup" aria-label="Your answer">
        {values.map((v, k) => (
          <label key={v} className={`pp-opt ${picked === v ? "pp-opt--on" : ""}`}>
            <input type="radio" name={`pp-${item.id}`} value={v} checked={picked === v} onChange={() => setPicked(v)} />
            <span className="pp-num">{v}</span>
            {item.labels[k] && <span className="pp-lab">{item.labels[k]}</span>}
          </label>
        ))}
      </div>
      <button type="button" className="wl-btn" disabled={picked === null} onClick={submit}>
        {i + 1 < ITEMS.length ? "Next →" : "See my score →"}
      </button>
    </div>
  );
}
