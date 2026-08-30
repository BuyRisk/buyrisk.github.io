import { useMemo, useState } from "react";
import ResetButton from "./ResetButton";
import { mulberry32, makeNormal } from "../lib/portfolio";

/**
 * "Can you beat the market?": an efficient-markets game. A simulated stock
 * unfolds one step at a time; the player predicts each next move (up/down). Two
 * lessons emerge: prediction accuracy hovers at ~50% (the past doesn't forecast
 * the future, weak-form EMH), and jumping in and out ("timing") tends to trail
 * just holding, because you sit out unpredictable jumps.
 */

const N = 24; // steps per game — enough to feel a pattern that isn't there
// Per-step drift and volatility roughly like a month of US stocks: +0.6% average
// (≈7%/yr) with 5% swings — so "up" is slightly more likely, but far from sure.
const DRIFT = 0.006;
const SIGMA = 0.05;
const START = 100;
const NEWS_THRESHOLD = 1.9; // |z| above this is flagged as a "news" jump

const pct = (x: number, dp = 1) => `${x >= 0 ? "" : ""}${(x * 100).toFixed(dp)}%`;
const signed = (x: number, dp = 1) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(dp)}%`;

function makePath(seed: number) {
  const rng = mulberry32(seed);
  const norm = makeNormal(rng);
  const prices = [START];
  const rets: number[] = [];
  const news: boolean[] = [];
  for (let i = 0; i < N; i++) {
    const z = norm();
    const ret = DRIFT + SIGMA * z;
    rets.push(ret);
    news.push(Math.abs(z) > NEWS_THRESHOLD);
    prices.push(prices[prices.length - 1] * (1 + ret));
  }
  return { prices, rets, news };
}

export default function EmhLab() {
  const [seed, setSeed] = useState(1);
  const [revealed, setRevealed] = useState(0);
  const [calls, setCalls] = useState<("up" | "down")[]>([]);
  const [cum, setCum] = useState({ correct: 0, total: 0 });

  const path = useMemo(() => makePath(seed), [seed]);
  const over = revealed >= N;

  const correctCount = calls.filter((c, i) => (c === "up") === path.rets[i] > 0).length;
  const accuracy = revealed > 0 ? correctCount / revealed : 0;
  // Timing: invested when you predicted up, in cash when you predicted down.
  let timingVal = 1;
  for (let i = 0; i < revealed; i++) if (calls[i] === "up") timingVal *= 1 + path.rets[i];
  const timingReturn = timingVal - 1;
  const buyHold = revealed > 0 ? path.prices[revealed] / START - 1 : 0;
  const cumAcc = cum.total > 0 ? cum.correct / cum.total : 0;

  const bet = (dir: "up" | "down") => {
    if (over) return;
    const i = revealed;
    const right = (dir === "up") === path.rets[i] > 0;
    setCalls((prev) => [...prev, dir]);
    setRevealed(i + 1);
    setCum((prev) => ({ correct: prev.correct + (right ? 1 : 0), total: prev.total + 1 }));
  };

  const newGame = () => {
    setSeed((s) => s + 1);
    setRevealed(0);
    setCalls([]);
  };

  return (
    <div className="emh">
      <div className="emh-chart-wrap">
        <PriceChart path={path} revealed={revealed} calls={calls} over={over} />
        <div className="emh-controls">
          {!over ? (
            <>
              <span className="emh-prompt">Next move?</span>
              <button type="button" className="emh-btn emh-btn--up" onClick={() => bet("up")}>↑ Up</button>
              <button type="button" className="emh-btn emh-btn--down" onClick={() => bet("down")}>↓ Down</button>
            </>
          ) : (
            <button type="button" className="emh-btn emh-btn--new" onClick={newGame}>Play again →</button>
          )}
        </div>
      </div>

      <div className="emh-side">
        <dl className="emh-stats">
          <div>
            <dt>Right so far</dt>
            <dd>{correctCount}/{revealed} {revealed > 0 && <span className="emh-acc">({Math.round(accuracy * 100)}%)</span>}</dd>
          </div>
          <div>
            <dt>Your timing return</dt>
            <dd className={timingReturn >= buyHold ? "emh-good" : "emh-bad"}>{signed(timingReturn)}</dd>
          </div>
          <div>
            <dt>Just holding</dt>
            <dd>{signed(buyHold)}</dd>
          </div>
        </dl>

        {over ? (
          <div className="emh-verdict">
            <p className="emh-verdict-head">
              You called {correctCount} of {N} right, {accuracy > 0.6 ? "a hot streak" : accuracy < 0.4 ? "a cold streak" : "about a coin flip"}.
            </p>
            <p>
              {timingReturn < buyHold ? (
                <>By jumping in and out you turned the market's <strong>{signed(buyHold)}</strong> into <strong>{signed(timingReturn)}</strong>. Timing <em>cost</em> you, because you sat out moves you couldn't predict.</>
              ) : (
                <>You beat buy-and-hold this round (<strong>{signed(timingReturn)}</strong> vs <strong>{signed(buyHold)}</strong>), but that's luck. Keep playing and watch your accuracy drift toward 50%.</>
              )}
            </p>
          </div>
        ) : (
          <p className="emh-hint">
            The chart is a simulated stock. Study the trend all you like, then
            predict. The past is already in the price.
          </p>
        )}

        <div className="emh-cumulative">
          <span className="emh-cum-label">Your accuracy across all games</span>
          <div className="emh-cum-bar">
            <div className="emh-cum-fill" style={{ width: `${Math.min(100, cumAcc * 100)}%` }} />
            <div className="emh-cum-mid" />
          </div>
          <span className="emh-cum-val">
            {cum.total > 0 ? `${Math.round(cumAcc * 100)}% over ${cum.total} predictions` : "make some predictions…"}
            {cum.total >= 10 && <>. The 50% line is a coin flip — and because the market drifts upward, always guessing “up” already edges above it, no skill required.</>}
          </span>
        </div>

        <ResetButton
          onReset={() => {
            setSeed(1);
            setRevealed(0);
            setCalls([]);
            setCum({ correct: 0, total: 0 });
          }}
        />
      </div>
    </div>
  );
}

function PriceChart({
  path,
  revealed,
  calls,
  over,
}: {
  path: { prices: number[]; rets: number[]; news: boolean[] };
  revealed: number;
  calls: ("up" | "down")[];
  over: boolean;
}) {
  const width = 640;
  const height = 300;
  const pad = { top: 16, right: 16, bottom: 30, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const shown = path.prices.slice(0, revealed + 1);
  const yMin = Math.min(...shown) * 0.97;
  const yMax = Math.max(...shown) * 1.03;
  const x = (i: number) => pad.left + (i / N) * plotW;
  const y = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Simulated stock price you are predicting">
      {[0, 0.5, 1].map((f) => {
        const v = yMin + (yMax - yMin) * f;
        return (
          <g key={f}>
            <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
            <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" style={axisText}>{Math.round(v)}</text>
          </g>
        );
      })}
      {/* revealed segments, colored by prediction correctness after the game */}
      {Array.from({ length: revealed }, (_, i) => {
        const right = (calls[i] === "up") === path.rets[i] > 0;
        const stroke = over ? (right ? "var(--color-accent)" : "var(--color-error)") : "var(--color-accent)";
        return (
          <line key={i} x1={x(i)} y1={y(path.prices[i])} x2={x(i + 1)} y2={y(path.prices[i + 1])} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" />
        );
      })}
      {/* news flags on revealed jumps */}
      {Array.from({ length: revealed }, (_, i) =>
        path.news[i] ? (
          <text key={`n${i}`} x={x(i + 1)} y={y(path.prices[i + 1]) - 8} textAnchor="middle" style={{ ...axisText, fontSize: 13 }}>📰</text>
        ) : null
      )}
      {/* current point */}
      <circle cx={x(revealed)} cy={y(path.prices[revealed])} r={5} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={2} />
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Time →{over ? "  (green = you called it right, red = wrong)" : ""}
      </text>
    </svg>
  );
}
