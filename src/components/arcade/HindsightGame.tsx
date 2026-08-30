import { useState } from "react";
import type { GameResult } from "./store";

/**
 * "You knew it all along" — hindsight bias, per Fischhoff (1975): knowing an
 * outcome silently inflates how "predictable" it feels. Four real market
 * episodes, all with genuinely surprising outcomes that DID happen: for two,
 * the outcome is revealed and the player rates how foreseeable it was
 * beforehand; for the matched two, the outcome is hidden and the player
 * assigns a probability. The bias is the gap — the known outcomes get rated
 * far more "predictable" than the equally-surprising hidden ones.
 */

interface Episode {
  id: string;
  revealed: boolean;
  setup: string;
  outcome: string; // shown upfront when revealed, after answering otherwise
  ask: string;
}

const EPISODES: Episode[] = [
  {
    id: "1995",
    revealed: true,
    setup: "January 1995. The Fed has raised rates six times in the past year and isn't done — the bond market has just had its worst year in decades. Recession worries dominate the outlook pages.",
    outcome: "What happened: US stocks returned over +37% in 1995, one of the best years of the century.",
    ask: "Knowing that, how foreseeable was a +30%-or-better year for a well-informed investor in January 1995?",
  },
  {
    id: "2020",
    revealed: false,
    setup: "Late March 2020. A global pandemic is closing entire economies; US stocks have just crashed ~34% in five weeks, the fastest bear market ever. Unemployment claims are the worst in history.",
    outcome: "What actually happened: US stocks finished 2020 UP about +18%, with the recovery starting within days of that moment.",
    ask: "What probability would you give that US stocks end 2020 with a POSITIVE return?",
  },
  {
    id: "2008",
    revealed: true,
    setup: "January 2008. US house prices have never fallen nationally in the post-war data. The Fed chair assured Congress the previous spring that subprime troubles were 'likely to be contained.' Major banks had just reported record profits.",
    outcome: "What happened: US stocks fell ~37% in 2008, and the global financial system nearly failed.",
    ask: "Knowing that, how foreseeable was a 30%-plus crash for a well-informed investor in January 2008?",
  },
  {
    id: "2022bond",
    revealed: false,
    setup: "January 2022. Inflation has hit a 40-year high and the Fed is signaling aggressive hikes. Ten-year Treasuries — the classic 'safe' asset — yield just 1.6%.",
    outcome: "What actually happened: 10-year Treasuries lost about 18% in 2022 — by far their worst year in the modern record.",
    ask: "What probability would you give that 'safe' 10-year Treasury bonds lose MORE than 15% in 2022?",
  },
];

export default function HindsightGame({ onDone }: { onDone: (r: GameResult) => void }) {
  const [i, setI] = useState(0);
  const [val, setVal] = useState(50);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showOutcome, setShowOutcome] = useState(false);
  const [finished, setFinished] = useState(false);

  const ep = EPISODES[i];

  const advance = (next: number[]) => {
    setVal(50);
    setShowOutcome(false);
    if (i + 1 < EPISODES.length) {
      setI(i + 1);
    } else {
      setFinished(true);
      const withOutcome = EPISODES.map((e, k) => (e.revealed ? next[k] : null)).filter((x): x is number => x !== null);
      const blind = EPISODES.map((e, k) => (!e.revealed ? next[k] : null)).filter((x): x is number => x !== null);
      const gap = withOutcome.reduce((s, x) => s + x, 0) / withOutcome.length - blind.reduce((s, x) => s + x, 0) / blind.length;
      const score = Math.round(Math.min(100, Math.max(0, (gap / 50) * 100)));
      onDone({
        gameId: "hindsight",
        score,
        headline: gap > 0
          ? `Known outcomes felt ${Math.round(gap)} points more "predictable" than hidden ones`
          : "Known outcomes didn't feel more predictable to you — rare",
        playedAt: Date.now(),
      });
    }
  };

  const submit = () => {
    const next = [...answers, val];
    setAnswers(next);
    if (!ep.revealed) {
      setShowOutcome(true); // show what actually happened before moving on
    } else {
      advance(next);
    }
  };

  if (finished) {
    const withOutcome = EPISODES.map((e, k) => (e.revealed ? answers[k] : null)).filter((x): x is number => x !== null);
    const blind = EPISODES.map((e, k) => (!e.revealed ? answers[k] : null)).filter((x): x is number => x !== null);
    const wAvg = withOutcome.reduce((s, x) => s + x, 0) / withOutcome.length;
    const bAvg = blind.reduce((s, x) => s + x, 0) / blind.length;
    return (
      <div className="ba-reveal">
        <p className="ba-verdict">
          Episodes with the ending shown felt <strong>{Math.round(wAvg)}%</strong> foreseeable; the
          matched ones without it got <strong>{Math.round(bAvg)}%</strong>.
        </p>
        <p>
          All four outcomes really happened, and all four were considered close to unthinkable at
          the time. The only difference was whether you knew the ending when you judged — that's{" "}
          <strong>hindsight bias</strong>, Fischhoff's "creeping determinism" (1975): once we know
          what happened, we can't fully un-know it, and the past reorganizes itself into something
          that was "obviously coming."
        </p>
        <p>
          The investing damage is indirect but constant: hindsight makes crashes look like they had
          sirens attached ("everyone knew"), which makes you trust forecasters — and your own
          foresight — far too much going forward. The antidote is a decision journal: write the
          probability down <em>before</em>, and let your past self testify. (Its cousin is the{" "}
          <a href="/tools/behavioral-finance">outcome bias game</a> — grade process, not endings.)
        </p>
      </div>
    );
  }

  return (
    <div className="ba-play">
      <p className="ba-progress">Episode {i + 1} of {EPISODES.length}</p>
      <p className="ba-question">{ep.setup}</p>
      {ep.revealed && <div className="ba-wheel">📜 {ep.outcome}</div>}
      {showOutcome ? (
        <>
          <div className="ba-wheel">📜 {ep.outcome}</div>
          <button type="button" className="wl-btn" onClick={() => advance(answers)}>Next episode →</button>
        </>
      ) : (
        <>
          <p className="ba-instruction">{ep.ask}</p>
          <label className="wl-slider">
            <span><strong>{val}%</strong></span>
            <input type="range" min={0} max={100} step={5} value={val} onChange={(e) => setVal(+e.target.value)} />
          </label>
          <button type="button" className="wl-btn" onClick={submit}>Lock it in →</button>
        </>
      )}
    </div>
  );
}
