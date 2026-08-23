import { useState } from "react";
import { FACTS } from "./facts";
import type { GameResult } from "./store";

/**
 * "The crowd" — an Asch-flavored conformity measure. For each question the
 * player commits a first-instinct answer, is then shown what "1,000 previous
 * players" supposedly averaged (rigged far from the truth, alternating high
 * and low), and may revise. The score is how far revisions moved toward the
 * fake consensus. In Asch's line experiments (1951–55), 75% of people
 * conformed to an obviously wrong group at least once.
 */

const QS = FACTS.herding;

/** Rigged "crowd averages": alternating far-high / far-low of the truth. */
const crowdFor = (i: number, truth: number) =>
  Math.max(1, Math.round((i % 2 === 0 ? truth * 2.4 : truth * 0.35) / 5) * 5);

export default function HerdingGame({ onDone }: { onDone: (r: GameResult) => void }) {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"first" | "revise">("first");
  const [input, setInput] = useState("");
  const [firsts, setFirsts] = useState<number[]>([]);
  const [finals, setFinals] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  const q = QS[i];
  const crowd = crowdFor(i, q.truth);

  const commitFirst = () => {
    const v = parseFloat(input);
    if (!Number.isFinite(v)) return;
    setFirsts([...firsts, v]);
    setInput(String(v));
    setPhase("revise");
  };

  const commitFinal = (keep: boolean) => {
    const v = keep ? firsts[i] : parseFloat(input);
    if (!Number.isFinite(v)) return;
    const nextFinals = [...finals, v];
    setFinals(nextFinals);
    setInput("");
    setPhase("first");
    if (i + 1 < QS.length) {
      setI(i + 1);
    } else {
      setFinished(true);
      // Susceptibility: mean fraction of the gap to the crowd that revisions closed.
      let pull = 0;
      for (let k = 0; k < QS.length; k++) {
        const gap = crowdFor(k, QS[k].truth) - firsts[k];
        if (Math.abs(gap) > 1e-9) pull += Math.max(0, Math.min(1, (nextFinals[k] - firsts[k]) / gap));
      }
      const score = Math.round((pull / QS.length) * 100);
      const moved = nextFinals.filter((f, k) => f !== firsts[k]).length;
      onDone({
        gameId: "herding",
        score,
        headline: moved === 0
          ? "You held your ground against the crowd on every question"
          : `The "crowd" pulled ${moved} of ${QS.length} answers, closing ${score}% of the gap`,
        playedAt: Date.now(),
      });
    }
  };

  if (finished) {
    const moved = finals.filter((f, k) => f !== firsts[k]).length;
    return (
      <div className="ba-reveal">
        <p className="ba-verdict">
          You revised <strong>{moved} of {QS.length}</strong> answers after seeing the crowd.
        </p>
        <p>
          There was no crowd. The "1,000 previous players" numbers were invented — rigged far
          above and far below the truth, alternating. Any pull you felt toward them is{" "}
          <strong>social proof</strong>: in Asch's classic experiments, 75% of people denied the
          evidence of their own eyes at least once to agree with a group, and information cascades
          (Bikhchandani, Hirshleifer &amp; Welch, 1992) show how rational-seeming copying snowballs
          into manias.
        </p>
        <p>
          Markets weaponize this: fund flows chase last year's winner, meme stocks run on
          visible crowds, and "everyone's buying" feels like information when it's mostly echo.
          The crowd sets the <em>price</em> — so following it means buying what's already expensive.
          Remedy: a written plan made in calm, and treating popularity itself as a cost. See{" "}
          <a href="/tools/behavioral-finance">the behavior gap</a> for the bill.
        </p>
        <details className="ba-answers">
          <summary>Your answers vs the truth</summary>
          <ol>
            {QS.map((qq, k) => (
              <li key={qq.id}>
                First instinct {firsts[k]}, "crowd" said {crowdFor(k, qq.truth)}, final {finals[k]}. Truth: {qq.note}
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
      <p className="ba-question">{q.question}</p>
      {phase === "first" ? (
        <>
          <p className="ba-instruction">Your first instinct — no pressure, nobody's watching yet.</p>
          <div className="ba-rangerow">
            <label>
              Your answer <input type="number" inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} aria-label="First answer" />
            </label>
            <span className="ba-unit">{q.unit}</span>
          </div>
          <button type="button" className="wl-btn" disabled={input === ""} onClick={commitFirst}>That's my answer →</button>
        </>
      ) : (
        <>
          <div className="ba-wheel">👥 1,000 previous players averaged <strong>{crowd}</strong>. You said <strong>{firsts[i]}</strong>.</div>
          <p className="ba-instruction">Want to revise, or stand your ground?</p>
          <div className="ba-rangerow">
            <label>
              Final answer <input type="number" inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Final answer" />
            </label>
            <span className="ba-unit">{q.unit}</span>
          </div>
          <div className="ba-choicerow">
            <button type="button" className="wl-btn" disabled={input === ""} onClick={() => commitFinal(false)}>Lock in this answer</button>
            <button type="button" className="wl-btn" onClick={() => commitFinal(true)}>Keep my first answer</button>
          </div>
        </>
      )}
    </div>
  );
}
