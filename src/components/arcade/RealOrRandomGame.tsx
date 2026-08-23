import { useMemo, useState } from "react";
import { marketDaily } from "../../data/generated/market-daily";
import { mulberry32 } from "../../lib/portfolio";
import type { GameResult } from "./store";

/**
 * "Real or random?" — eight price charts; half are actual 250-day stretches
 * of the US market, half are pure coin flips scaled to the same daily
 * volatility. If markets left readable patterns, real charts would be easy to
 * spot. They aren't: people reliably score near chance while FEELING sure
 * (the streaks and "trends" our eyes find are exactly what randomness
 * produces). One of the oldest demonstrations in finance teaching — Working
 * (1934) noted random series "look like" speculative prices.
 */

const N = 8;
const DAYS = 250;

interface Chart {
  path: number[]; // cumulative price, starts at 1
  real: boolean;
}

function makeCharts(): Chart[] {
  const rng = mulberry32(87124);
  const R = marketDaily.returns;
  // Daily sigma of the real series, for vol-matched fakes.
  const mean = R.reduce((s, r) => s + r, 0) / R.length;
  const sd = Math.sqrt(R.reduce((s, r) => s + (r - mean) ** 2, 0) / R.length);

  const charts: Chart[] = [];
  const reals = new Set<number>();
  while (reals.size < N / 2) reals.add(Math.floor(rng() * (R.length - DAYS)));
  for (const start of reals) {
    const path = [1];
    for (let i = 0; i < DAYS; i++) path.push(path[i] * (1 + R[start + i]));
    charts.push({ path, real: true });
  }
  for (let c = 0; c < N / 2; c++) {
    const path = [1];
    for (let i = 0; i < DAYS; i++) {
      const r = (rng() > 0.5 ? 1 : -1) * sd; // pure coin flip, vol-matched, zero drift
      path.push(path[i] * (1 + r));
    }
    charts.push({ path, real: false });
  }
  // Deterministic shuffle.
  for (let i = charts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [charts[i], charts[j]] = [charts[j], charts[i]];
  }
  return charts;
}

function Spark({ path }: { path: number[] }) {
  const w = 560, h = 180, pad = 8;
  const min = Math.min(...path), max = Math.max(...path);
  const x = (i: number) => pad + (i / (path.length - 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad);
  const d = path.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="A one-year price chart">
      <rect x="0" y="0" width={w} height={h} rx="8" fill="var(--color-surface-alt)" />
      <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth={1.8} />
    </svg>
  );
}

export default function RealOrRandomGame({ onDone }: { onDone: (r: GameResult) => void }) {
  const charts = useMemo(makeCharts, []);
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const [finished, setFinished] = useState(false);

  const guess = (saysReal: boolean) => {
    const correct = saysReal === charts[i].real;
    const nextRight = right + (correct ? 1 : 0);
    setRight(nextRight);
    if (i + 1 < N) {
      setI(i + 1);
    } else {
      setFinished(true);
      // Chance = 4/8. Susceptibility here is the ILLUSION gap: everyone feels
      // like they can read charts; scoring at/below chance while feeling
      // confident IS the demonstration. Score by distance from perfect.
      onDone({
        gameId: "patterns",
        score: Math.round((1 - nextRight / N) * 100),
        headline: `You told real markets from coin flips ${nextRight} times out of ${N}`,
        playedAt: Date.now(),
      });
    }
  };

  if (finished) {
    return (
      <div className="ba-reveal">
        <p className="ba-verdict">
          {right} of {N} correct — a coin scores 4.
        </p>
        <p>
          Half those charts were the real US market; half were literal coin flips with the market's
          daily volatility. The trends, streaks, "support levels," and dramatic reversals you saw in
          the fakes were produced by pure chance — because that's what chance looks like. Our
          pattern-hungry brains supply the story (<strong>the hot hand and the gambler's
          fallacy</strong> are the two directions of the same mistake).
        </p>
        <p>
          If genuine market charts can't be told from noise at a glance, day-to-day price action
          carries far less readable signal than it feels like it does — which is why{" "}
          <a href="/tools/beat-the-market">timing it and trading it</a> keep failing in the data.
          The market's real, durable pattern lives at the decades scale, not the daily one.
        </p>
      </div>
    );
  }

  return (
    <div className="ba-play">
      <p className="ba-progress">Chart {i + 1} of {N} · {right} correct so far</p>
      <Spark path={charts[i].path} />
      <p className="ba-question">One year of daily prices. Is this the real market — or coin flips?</p>
      <div className="ba-choicerow">
        <button type="button" className="wl-btn" onClick={() => guess(true)}>📈 Real market</button>
        <button type="button" className="wl-btn" onClick={() => guess(false)}>🪙 Coin flips</button>
      </div>
    </div>
  );
}
