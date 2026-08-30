import { useMemo, useState } from "react";
import { mulberry32 } from "../../lib/portfolio";
import type { GameResult } from "./store";

/**
 * "Sell something" — the disposition effect, played. Six rounds; each round
 * the player must raise cash by selling one of four positions, some sitting
 * on gains, some on losses. Prices carry mild momentum (empirically, recent
 * winners keep edging ahead over the next months — Jegadeesh & Titman 1993),
 * so the tax-free* optimal play is usually to sell LOSERS and let winners
 * run. Odean (1998) showed real investors do the opposite: they're ~50% more
 * likely to realize a gain than a loss, and the winners they sell go on to
 * BEAT the losers they keep by ~3.4pp over the next year.
 * (*and with taxes, selling losers is even better — losses are deductible.)
 */

interface Pos {
  name: string;
  cost: number;
  price: number;
  sold: boolean;
}

const START: Omit<Pos, "sold">[] = [
  { name: "Meridian Health", cost: 100, price: 134 },
  { name: "Cascade Semiconductor", cost: 100, price: 71 },
  { name: "Harbor Logistics", cost: 100, price: 118 },
  { name: "Pinewood Media", cost: 100, price: 83 },
];

const ROUNDS = 6;
const MOMENTUM = 0.045; // per-round expected drift for winners (+) / losers (−)
const NOISE = 0.06;

export default function DispositionGame({ onDone }: { onDone: (r: GameResult) => void }) {
  const rng = useMemo(() => mulberry32(20260823), []);
  const [positions, setPositions] = useState<Pos[]>(() =>
    START.map((p) => ({ ...p, sold: false })),
  );
  const [round, setRound] = useState(0);
  const [winnersSold, setWinnersSold] = useState(0);
  const [losersSold, setLosersSold] = useState(0);
  const [banked, setBanked] = useState(0);
  const [finished, setFinished] = useState(false);

  // Refill the bench so there's always a choice of winners AND losers.
  const evolve = (ps: Pos[]): Pos[] => {
    const next = ps.map((p) => {
      if (p.sold) return p;
      const isWinner = p.price >= p.cost;
      const drift = isWinner ? MOMENTUM : -MOMENTUM;
      const r = drift + (rng() * 2 - 1) * NOISE;
      return { ...p, price: Math.max(5, p.price * (1 + r)) };
    });
    const live = next.filter((p) => !p.sold);
    if (!live.some((p) => p.price >= p.cost) || !live.some((p) => p.price < p.cost)) {
      const up = rng() > 0.5;
      next.push({
        name: ["Bluecrest Foods", "Ionia Power", "Verdant Robotics", "Northgate Rail", "Solent Micro", "Kestrel Labs"][Math.floor(rng() * 6)],
        cost: 100,
        price: up ? 100 * (1.1 + rng() * 0.3) : 100 * (0.65 + rng() * 0.25),
        sold: false,
      });
    }
    return next;
  };

  const sell = (idx: number) => {
    const p = positions[idx];
    const isWinner = p.price >= p.cost;
    const nextWinners = winnersSold + (isWinner ? 1 : 0);
    const nextLosers = losersSold + (isWinner ? 0 : 1);
    setWinnersSold(nextWinners);
    setLosersSold(nextLosers);
    setBanked(banked + p.price);
    let ps = positions.map((q, k) => (k === idx ? { ...q, sold: true } : q));

    if (round + 1 < ROUNDS) {
      setPositions(evolve(ps));
      setRound(round + 1);
    } else {
      setFinished(true);
      const frac = nextWinners / ROUNDS;
      onDone({
        gameId: "disposition",
        score: Math.round(frac * 100),
        headline: `You sold ${nextWinners} winner${nextWinners === 1 ? "" : "s"} and ${nextLosers} loser${nextLosers === 1 ? "" : "s"}`,
        playedAt: Date.now(),
      });
    }
  };

  if (finished) {
    return (
      <div className="ba-reveal">
        <p className="ba-verdict">
          You sold <strong>{winnersSold} winner{winnersSold === 1 ? "" : "s"}</strong> and{" "}
          <strong>{losersSold} loser{losersSold === 1 ? "" : "s"}</strong>.
        </p>
        <p>
          Selling winners to keep losers is the <strong>disposition effect</strong> (Shefrin &amp;
          Statman, 1985). Odean's audit of 10,000 brokerage accounts found investors ~50% more
          likely to realize a gain than a loss — and it cost them twice: the sold winners went on to
          beat the held losers by about <strong>3.4 points</strong> over the following year, and
          selling winners instead of losers hands the taxman gains while wasting deductible losses.
        </p>
        <p>
          The pull you may have felt — locking in a "win," refusing to make a loss "real" — is loss
          aversion wearing a portfolio costume. A paper loss is already real; selling just updates
          the paperwork. Remedy: judge every holding by one question — <em>would I buy it today?</em> —
          and let <a href="/personal-finance/next-dollar">tax-loss harvesting</a> turn the losers
          into something useful.
        </p>
      </div>
    );
  }

  const live = positions.map((p, idx) => ({ p, idx })).filter(({ p }) => !p.sold);
  return (
    <div className="ba-play">
      <p className="ba-progress">Round {round + 1} of {ROUNDS} · cash raised so far: ${Math.round(banked)}</p>
      <p className="ba-question">You need cash. Sell one position.</p>
      <div className="ba-positions">
        {live.map(({ p, idx }) => {
          const ret = (p.price / p.cost - 1) * 100;
          return (
            <button key={p.name + idx} type="button" className="ba-position" onClick={() => sell(idx)}>
              <span className="ba-posname">{p.name}</span>
              <span className="ba-posbasis">bought at $100</span>
              <span className="ba-posprice">${p.price.toFixed(0)}</span>
              <span className={ret >= 0 ? "ba-posret ba-posret--up" : "ba-posret ba-posret--down"}>
                {ret >= 0 ? "+" : ""}{ret.toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>
      <p className="ba-instruction">No taxes, no fees, no other information. Just pick.</p>
    </div>
  );
}
