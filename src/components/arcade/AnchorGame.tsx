import { useMemo, useState } from "react";
import { FACTS } from "./facts";
import type { GameResult } from "./store";

/**
 * "The wheel" — Tversky & Kahneman's 1974 anchoring demonstration, adapted to
 * a single player. Before each estimate, a visibly arbitrary "wheel" lands on
 * a number and we ask the throwaway higher/lower question; the anchors
 * alternate far-high and far-low around the truth. A pulled answer lands on
 * its anchor's side of the true value; four pulled answers out of four is the
 * textbook result. (In the original, wheel numbers 10 vs 65 dragged estimates
 * of a UN statistic from 25% to 45%.)
 */

const QS = FACTS.anchoring;

/** Deterministic, obviously-arbitrary anchors: far high / far low, alternating. */
function anchorFor(i: number, truth: number): number {
  const high = i % 2 === 0;
  const raw = high ? truth * 2.6 : truth * 0.3;
  // Round to something wheel-like.
  return Math.max(1, Math.round(raw / 5) * 5);
}

export default function AnchorGame({ onDone }: { onDone: (r: GameResult) => void }) {
  const anchors = useMemo(() => QS.map((q, i) => anchorFor(i, q.truth)), []);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"spin" | "estimate">("spin");
  const [est, setEst] = useState("");
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  const q = QS[i];
  const anchor = anchors[i];

  const submit = () => {
    const v = parseFloat(est);
    if (!Number.isFinite(v)) return;
    const next = [...answers, v];
    setAnswers(next);
    setEst("");
    setPhase("spin");
    if (i + 1 < QS.length) {
      setI(i + 1);
    } else {
      setFinished(true);
      const pulled = next.filter((a, k) => {
        const anch = anchors[k];
        const t = QS[k].truth;
        return anch > t ? a > t : a < t;
      }).length;
      onDone({
        gameId: "anchoring",
        score: Math.round((pulled / QS.length) * 100),
        headline: `${pulled} of ${QS.length} estimates were dragged toward the wheel's number`,
        playedAt: Date.now(),
      });
    }
  };

  if (finished) {
    const pulled = answers.filter((a, k) => (anchors[k] > QS[k].truth ? a > QS[k].truth : a < QS[k].truth)).length;
    return (
      <div className="ba-reveal">
        <p className="ba-verdict">
          {pulled} of {QS.length} of your estimates landed on the <strong>wheel's side</strong> of the
          true answer.
        </p>
        <p>
          The wheel was rigged: it alternated numbers far above and far below the truth, and the
          "higher or lower?" question existed only to make you <em>touch</em> the number. That's{" "}
          <strong>anchoring</strong> (Tversky &amp; Kahneman, 1974): a value you know is arbitrary
          still drags your estimate toward it — in the original experiment, a wheel of fortune moved
          people's answers by 20 points.
        </p>
        <p>
          In markets, the anchors come pre-installed: the price <em>you</em> paid, the stock's
          52-week high, a round number like Dow 40,000. None of them says anything about value —
          and all of them tug on "it's cheap now" and "I'll sell when it gets back to even."
        </p>
        <details className="ba-answers">
          <summary>Your numbers vs the truth</summary>
          <ol>
            {QS.map((qq, k) => (
              <li key={qq.id}>
                Wheel said {anchors[k]}, you said {answers[k]}, truth: {qq.note}
              </li>
            ))}
          </ol>
        </details>
      </div>
    );
  }

  return (
    <div className="ba-play">
      <p className="ba-progress">Question {i + 1} of {QS.length}</p>
      {phase === "spin" ? (
        <>
          <p className="ba-instruction">A completely arbitrary number, before each question. Ready?</p>
          <div className="ba-wheel" aria-hidden="true">🎡 The wheel lands on… <strong>{anchor}</strong></div>
          <p className="ba-question">{q.question}</p>
          <p className="ba-instruction">First: is the answer <strong>higher or lower</strong> than {anchor}?</p>
          <div className="ba-choicerow">
            <button type="button" className="wl-btn" onClick={() => setPhase("estimate")}>Higher</button>
            <button type="button" className="wl-btn" onClick={() => setPhase("estimate")}>Lower</button>
          </div>
        </>
      ) : (
        <>
          <p className="ba-question">{q.question}</p>
          <div className="ba-rangerow">
            <label>
              Your estimate <input type="number" inputMode="decimal" value={est} onChange={(e) => setEst(e.target.value)} aria-label="Estimate" />
            </label>
            <span className="ba-unit">{q.unit}</span>
          </div>
          <button type="button" className="wl-btn" disabled={est === ""} onClick={submit}>Lock it in →</button>
        </>
      )}
    </div>
  );
}
