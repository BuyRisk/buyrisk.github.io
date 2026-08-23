import { useState } from "react";
import type { GameResult } from "./store";

/**
 * "Flip or fold" — a titration staircase for loss aversion. Each round offers
 * a fair coin flip: lose $100 on tails, win $X on heads. Accepting shrinks the
 * next offer, rejecting grows it; after seven rounds the staircase converges
 * on the player's indifference point, and λ ≈ (indifference offer)/100 is
 * their loss-aversion coefficient. Kahneman & Tversky's estimate for the
 * population: λ ≈ 2.25 — losses loom a bit more than twice as large as gains.
 */

const ROUNDS = 7;
const LOSS = 100;

export default function LossAversionGame({ onDone }: { onDone: (r: GameResult) => void }) {
  const [round, setRound] = useState(0);
  const [offer, setOffer] = useState(150);
  const [lastAccept, setLastAccept] = useState<number | null>(null);
  const [lastReject, setLastReject] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [lambda, setLambda] = useState(0);

  const answer = (accept: boolean) => {
    const acc = accept ? offer : lastAccept;
    const rej = accept ? lastReject : offer;
    if (accept) setLastAccept(offer); else setLastReject(offer);
    let next: number;
    if (accept) next = rej !== null ? (offer + rej) / 2 : offer * 0.7;
    else next = acc !== null ? (offer + acc) / 2 : offer * 1.5;
    next = Math.round(Math.min(600, Math.max(100, next)) / 5) * 5;

    if (round + 1 < ROUNDS) {
      setOffer(next);
      setRound(round + 1);
    } else {
      // Indifference ≈ midpoint of the tightest accept/reject bracket we saw.
      const hiSide = rej ?? 600;
      const loSide = acc ?? 100;
      const indiff = (hiSide + loSide) / 2;
      const lam = indiff / LOSS;
      setLambda(lam);
      setFinished(true);
      const score = Math.round(Math.min(100, Math.max(0, ((lam - 1) / 3) * 100)));
      onDone({
        gameId: "loss",
        score,
        headline: `Your loss-aversion coefficient λ ≈ ${lam.toFixed(1)} (losses feel ~${lam.toFixed(1)}× as big as gains)`,
        playedAt: Date.now(),
      });
    }
  };

  if (finished) {
    return (
      <div className="ba-reveal">
        <p className="ba-verdict">
          Your indifference point implies <strong>λ ≈ {lambda.toFixed(1)}</strong> — a $100 loss
          feels roughly like a ${Math.round(lambda * 100)} gain to you.
        </p>
        <p>
          That number is <strong>loss aversion</strong>, the heart of prospect theory (Kahneman
          &amp; Tversky, 1979). The population average is about <strong>2.25</strong>. There's no
          virtuous score: pure expected-value logic says accept anything over $100, and for small,
          repeatable bets that's the "rational" answer (turning down many small favorable flips adds
          up to a large forfeited edge — Rabin, 2000).
        </p>
        <p>
          The investing consequence is <em>myopic</em> loss aversion: the more often you check a
          portfolio, the more losses you witness (down days are ~47% of days, down decades are
          rare), and λ turns each glance into pain — which is what makes panic-selling feel like
          relief. The remedy is structural: check less, automate more, and size stock exposure so
          the worst year is one you can sit through. The{" "}
          <a href="/tools/behavioral-finance">behavior-gap sim</a> prices the alternative.
        </p>
      </div>
    );
  }

  return (
    <div className="ba-play">
      <p className="ba-progress">Offer {round + 1} of {ROUNDS}</p>
      <p className="ba-question">
        A fair coin. <strong>Tails: you lose ${LOSS}.</strong>{" "}
        <strong>Heads: you win ${offer}.</strong>
      </p>
      <p className="ba-instruction">Real money, one flip, right now. Would you take it?</p>
      <div className="ba-choicerow">
        <button type="button" className="wl-btn" onClick={() => answer(true)}>Take the bet</button>
        <button type="button" className="wl-btn" onClick={() => answer(false)}>Pass</button>
      </div>
    </div>
  );
}
