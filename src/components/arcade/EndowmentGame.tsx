import { useState } from "react";
import type { GameResult } from "./store";

/**
 * "Yours to sell" — the endowment effect, measured the Kahneman-Knetsch-
 * Thaler way (1990, coffee mugs): the same person demands about twice as
 * much to GIVE UP a thing as they'd pay to GET it. Two rounds of matched
 * lottery tickets: for one you're the owner (name your minimum selling
 * price), for the other a buyer (name your maximum bid). The buy-side
 * ticket is slightly BETTER in expected value, so any WTA/WTP ratio above
 * ~1 after adjustment is ownership doing the talking.
 */

interface Round {
  ownDesc: string;
  ownEV: number;
  buyDesc: string;
  buyEV: number;
}

const ROUNDS: Round[] = [
  {
    ownDesc: "a ticket that pays $200 on a coin flip (heads), nothing on tails",
    ownEV: 100,
    buyDesc: "a ticket that pays $220 on a coin flip (heads), nothing on tails",
    buyEV: 110,
  },
  {
    ownDesc: "a ticket with an 80% chance of paying $100 (20%: nothing)",
    ownEV: 80,
    buyDesc: "a ticket with an 80% chance of paying $110 (20%: nothing)",
    buyEV: 88,
  },
];

type Step = { round: number; side: "own" | "buy" };
const STEPS: Step[] = [
  { round: 0, side: "own" },
  { round: 1, side: "buy" },
  { round: 1, side: "own" },
  { round: 0, side: "buy" },
];

export default function EndowmentGame({ onDone }: { onDone: (r: GameResult) => void }) {
  const [i, setI] = useState(0);
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const [ratio, setRatio] = useState(1);

  const step = STEPS[i];
  const r = ROUNDS[step.round];

  const submit = () => {
    const v = parseFloat(input);
    if (!Number.isFinite(v) || v <= 0) return;
    const next = { ...answers, [`${step.round}-${step.side}`]: v };
    setAnswers(next);
    setInput("");
    if (i + 1 < STEPS.length) {
      setI(i + 1);
    } else {
      setFinished(true);
      // EV-normalized WTA/WTP per round, averaged.
      const ratios = ROUNDS.map((rr, k) => {
        const wta = next[`${k}-own`] / rr.ownEV;
        const wtp = next[`${k}-buy`] / rr.buyEV;
        return wtp > 0 ? wta / wtp : 1;
      });
      const avg = ratios.reduce((s, x) => s + x, 0) / ratios.length;
      setRatio(avg);
      const score = Math.round(Math.min(100, Math.max(0, ((avg - 1) / 1.5) * 100)));
      onDone({
        gameId: "endowment",
        score,
        headline: `You demanded ${avg.toFixed(1)}× more to sell than you'd pay to buy the same bet`,
        playedAt: Date.now(),
      });
    }
  };

  if (finished) {
    return (
      <div className="ba-reveal">
        <p className="ba-verdict">
          Adjusted for the odds, your selling prices were <strong>{ratio.toFixed(1)}×</strong> your
          buying prices — for essentially identical bets.
        </p>
        <p>
          The tickets you "owned" and the ones you were offered were near-twins (the ones for sale
          were actually slightly <em>better</em>). Valuing a thing more because it's yours is the{" "}
          <strong>endowment effect</strong>: in the classic experiment (Kahneman, Knetsch &amp;
          Thaler, 1990), people given a mug demanded about $7 to part with it while identical
          people offered about $3 to acquire one — a 2-to-1 gap with zero information difference.
        </p>
        <p>
          Portfolios inherit this constantly: the employer stock you'd never buy today, the
          inherited shares "Dad picked," the fund you've simply had for years. Ownership is not a
          reason. The test is the same one the disposition game teaches — <em>if this arrived as
          cash today, would I buy this exact thing?</em> If not, the only thing holding it is the
          holding.
        </p>
      </div>
    );
  }

  return (
    <div className="ba-play">
      <p className="ba-progress">Ticket {i + 1} of {STEPS.length}</p>
      {step.side === "own" ? (
        <>
          <p className="ba-question">You've just been HANDED {r.ownDesc}. It's yours.</p>
          <p className="ba-instruction">Someone offers to buy it before the flip. What's the minimum price you'd accept?</p>
        </>
      ) : (
        <>
          <p className="ba-question">Someone offers to SELL you {r.buyDesc}.</p>
          <p className="ba-instruction">What's the most you'd pay for it?</p>
        </>
      )}
      <div className="ba-rangerow">
        <label>
          $ <input type="number" inputMode="decimal" min="0" value={input} onChange={(e) => setInput(e.target.value)} aria-label={step.side === "own" ? "Minimum selling price" : "Maximum buying price"} />
        </label>
      </div>
      <button type="button" className="wl-btn" disabled={input === ""} onClick={submit}>Lock it in →</button>
    </div>
  );
}
