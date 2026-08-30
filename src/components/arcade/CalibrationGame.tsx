import { useState } from "react";
import { FACTS } from "./facts";
import type { GameResult } from "./store";

/**
 * "How sure are you?" — the classic 90%-confidence-interval calibration test
 * (Alpert & Raiffa 1969; Russo & Schoemaker 1989). Ten questions; for each,
 * the player gives a LOW and HIGH bound they're 90% sure brackets the truth.
 * A calibrated player traps ~9 of 10. Most people trap 3–6: our confidence
 * intervals are far too narrow, which is overconfidence in its purest,
 * most measurable form.
 */

const QS = FACTS.calibration;

export default function CalibrationGame({ onDone }: { onDone: (r: GameResult) => void }) {
  const [i, setI] = useState(0);
  const [lo, setLo] = useState("");
  const [hi, setHi] = useState("");
  const [hits, setHits] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);

  const q = QS[i];
  const submit = () => {
    const l = parseFloat(lo);
    const h = parseFloat(hi);
    if (!Number.isFinite(l) || !Number.isFinite(h)) return;
    const hit = Math.min(l, h) <= q.truth && q.truth <= Math.max(l, h);
    const next = [...hits, hit];
    setHits(next);
    setLo("");
    setHi("");
    if (i + 1 < QS.length) {
      setI(i + 1);
    } else {
      setFinished(true);
      const n = next.filter(Boolean).length;
      const score = Math.round(Math.min(100, Math.max(0, ((0.9 - n / QS.length) / 0.9) * 100)));
      onDone({
        gameId: "calibration",
        score,
        headline: `${n} of ${QS.length} answers landed inside your "90% sure" ranges`,
        playedAt: Date.now(),
      });
    }
  };

  if (finished) {
    const n = hits.filter(Boolean).length;
    return (
      <div className="ba-reveal">
        <p className="ba-verdict">
          {n} of {QS.length} true answers landed inside your ranges — a calibrated
          forecaster traps <strong>9 of 10</strong>.
        </p>
        <p>
          This is the classic test of <strong>overconfidence</strong> (Alpert &amp; Raiffa, 1969):
          when people say "90% sure," reality typically shows up inside their range only about half
          the time. It isn't about knowing market trivia — wide honest ranges would have trapped
          everything. It's that our sense of what we know runs ahead of what we know.
        </p>
        <p>
          The investing cost: overconfident investors trade more and earn less (Barber &amp; Odean,
          2000 — the most active traders lagged the market by ~6.5 points a year). The remedy isn't
          more knowledge; it's <em>wider error bars</em> — which is what diversification and index
          funds are, in portfolio form.
        </p>
        <details className="ba-answers">
          <summary>The answers</summary>
          <ol>
            {QS.map((qq, k) => (
              <li key={qq.id}>
                {hits[k] ? "✅" : "❌"} {qq.note}
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
      <p className="ba-instruction">
        Give a range you're <strong>90% sure</strong> contains the answer. Don't look anything up —
        wide and honest beats narrow and brave.
      </p>
      <div className="ba-rangerow">
        <label>
          Low <input type="number" inputMode="decimal" value={lo} onChange={(e) => setLo(e.target.value)} aria-label="Low bound" />
        </label>
        <span className="ba-unit">to</span>
        <label>
          High <input type="number" inputMode="decimal" value={hi} onChange={(e) => setHi(e.target.value)} aria-label="High bound" />
        </label>
        <span className="ba-unit">{q.unit}</span>
      </div>
      <button type="button" className="wl-btn" disabled={lo === "" || hi === ""} onClick={submit}>
        {i + 1 < QS.length ? "Lock it in →" : "Lock in the last one"}
      </button>
    </div>
  );
}
