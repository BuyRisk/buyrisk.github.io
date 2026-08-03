import { useMemo, useState } from "react";
import ResetButton from "./ResetButton";
import { historicalReturns } from "../data/generated/historical-returns";

/**
 * "Risk Tolerance Questionnaire" — a short set of questions that place you on
 * the risk/return spectrum and suggest a stock/bond starting point.
 *
 * Scored across the three classic dimensions the portfolio tools already invoke:
 *  • Ability   — can you afford a big drop? (horizon, income stability, cushion)
 *  • Willingness — can you stomach one? (reaction to a crash, experience)
 *  • Need      — how much growth does the goal actually require?
 *
 * The honest twist it surfaces: the binding constraint is usually the LOWER of
 * ability and willingness. A rock-solid balance sheet doesn't help if you'll
 * panic-sell at the bottom, and iron nerves don't help if you'll need the cash
 * next year. Outcome ranges are real US calendar-year history, not a promise.
 * Educational only — this is not personalized financial advice.
 */

type Dim = "ability" | "willingness" | "need";
type Question = { id: string; dim: Dim; q: string; options: string[] }; // options ordered low→high risk, scored 0..3

const QUESTIONS: Question[] = [
  { id: "horizon", dim: "ability", q: "When do you expect to start spending this money?",
    options: ["Within 3 years", "3–7 years", "8–15 years", "More than 15 years"] },
  { id: "drop", dim: "willingness", q: "Your portfolio drops 30% in a few months. You…",
    options: ["Sell everything to stop the losses", "Sell some to feel safer", "Do nothing and wait it out", "Invest more while it's cheap"] },
  { id: "income", dim: "ability", q: "How stable is your income?",
    options: ["Unpredictable / irregular", "Somewhat variable", "Stable", "Very stable and secure"] },
  { id: "cushion", dim: "ability", q: "If your income stopped tomorrow, your cash cushion would last…",
    options: ["Less than a month", "1–3 months", "3–6 months", "More than 6 months"] },
  { id: "experience", dim: "willingness", q: "How would you describe your investing experience?",
    options: ["New, and a bit nervous", "Some — still learning", "Comfortable with the ups and downs", "Seasoned; volatility doesn't rattle me"] },
  { id: "goal", dim: "need", q: "What is this money mainly for?",
    options: ["Protecting what I have", "Producing steady income", "Balanced long-term growth", "Maximum long-term growth"] },
];

const MAX: Record<Dim, number> = { ability: 9, willingness: 6, need: 3 };

/** Real (inflation-adjusted) annual stock & bond returns from history. */
const REALYR = historicalReturns.series.map((y) => ({
  s: (1 + y.stocks) / (1 + y.inflation) - 1,
  b: (1 + y.tbonds) / (1 + y.inflation) - 1,
}));
function mixStats(w: number) {
  const rs = REALYR.map((x) => w * x.s + (1 - w) * x.b);
  const avg = rs.reduce((a, b) => a + b, 0) / rs.length;
  return { avg, worst: Math.min(...rs), best: Math.max(...rs) };
}

function label(equity: number) {
  if (equity <= 30) return "Conservative";
  if (equity <= 45) return "Moderately conservative";
  if (equity <= 62) return "Balanced";
  if (equity <= 78) return "Moderately aggressive";
  return "Aggressive";
}

export default function RiskToleranceLab() {
  const [answers, setAnswers] = useState<Record<string, number | undefined>>({});

  const answeredCount = QUESTIONS.filter((q) => answers[q.id] !== undefined).length;
  const complete = answeredCount === QUESTIONS.length;

  const result = useMemo(() => {
    if (!complete) return null;
    const dimScore = (d: Dim) => QUESTIONS.filter((q) => q.dim === d).reduce((s, q) => s + (answers[q.id] ?? 0), 0);
    const abilityP = dimScore("ability") / MAX.ability;
    const willP = dimScore("willingness") / MAX.willingness;
    const needP = dimScore("need") / MAX.need;
    // Weighted blend, then pulled toward the lower of ability/willingness (the
    // binding constraint) so a mismatch doesn't over-state how much risk fits.
    const blend = 0.4 * abilityP + 0.4 * willP + 0.2 * needP;
    const binding = Math.min(abilityP, willP);
    const combined = 0.65 * blend + 0.35 * binding;
    const equity = Math.round((20 + combined * 75) / 5) * 5; // 20–95, to nearest 5
    const stats = mixStats(equity / 100);
    const mismatch = Math.abs(abilityP - willP) >= 0.34;
    const lower = abilityP < willP ? "ability" : "willingness";
    return { equity, abilityP, willP, needP, stats, mismatch, lower };
  }, [answers, complete]);

  return (
    <div className="wl">
      <div className="wl-controls rt-controls">
        <ResetButton onReset={() => setAnswers({})} />
        {QUESTIONS.map((q, i) => (
          <div key={q.id} className="rt-q">
            <span className="rt-q-label">
              <span className="rt-q-num">{i + 1}</span> {q.q}
            </span>
            <div className="rt-opts" role="group" aria-label={q.q}>
              {q.options.map((opt, idx) => (
                <button
                  key={opt}
                  type="button"
                  className={`rt-opt${answers[q.id] === idx ? " active" : ""}`}
                  aria-pressed={answers[q.id] === idx}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="wl-stage">
        {result ? (
          <>
            <div className="wl-frontier">
              <h3>Where you land</h3>
              <div className="ss-headline" style={{ marginBottom: "var(--space-md)" }}>
                <span className="ss-headline-label">A starting point to consider</span>
                <span className="ss-headline-value">{result.equity}% stocks / {100 - result.equity}% bonds</span>
                <span className="ss-headline-sub"><strong>{label(result.equity)}</strong> on the risk/return spectrum</span>
              </div>

              <Spectrum equity={result.equity} />

              <dl className="ss-stats" style={{ marginTop: "var(--space-md)" }}>
                <div><dt>Avg. real return / yr</dt><dd>{(result.stats.avg * 100).toFixed(1)}%</dd></div>
                <div><dt>Best year (history)</dt><dd>+{(result.stats.best * 100).toFixed(0)}%</dd></div>
                <div><dt>Worst year (history)</dt><dd>−{Math.abs(result.stats.worst * 100).toFixed(0)}%</dd></div>
                <div><dt>Your risk profile</dt><dd>{label(result.equity)}</dd></div>
              </dl>
              <p className="wl-fnote">
                Best/worst are the actual best and worst single calendar years for this mix in US history since
                {" "}{historicalReturns.span[0]} (real, after inflation). A reminder that the average is a smooth line the
                journey never is.
              </p>
            </div>

            <div className="wl-lower">
              <div className="wl-readout">
                <DimBars ability={result.abilityP} willingness={result.willP} need={result.needP} />
                {result.mismatch && (
                  <div className="rt-flag">
                    <strong>Your {result.lower} to take risk is the lower of the two.</strong> That's the one that binds:
                    a strong balance sheet doesn't help if you'll sell at the bottom, and steady nerves don't help if
                    you'll need the money soon. Lean toward the more cautious end until they line up.
                  </div>
                )}
                <p className="wl-saved">
                  This is a conversation starter, not a prescription. Real risk tolerance blends what you can afford to
                  lose (<strong>ability</strong>), what you can stomach (<strong>willingness</strong>), and what your goal
                  actually requires (<strong>need</strong>) — and the honest answer leans on the lowest of them. Take this
                  allocation into the{" "}
                  <a href="/tools/portfolio" style={{ color: "var(--color-accent)", fontWeight: 600 }}>Asset Allocation tool</a>{" "}
                  to see the risk/return trade-off in motion. <strong>Educational only — not personalized financial advice.</strong>
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="wl-frontier rt-placeholder">
            <h3>Answer the six questions</h3>
            <p className="wl-fnote" style={{ fontStyle: "normal" }}>
              You've answered <strong>{answeredCount}</strong> of {QUESTIONS.length}. Your risk profile and a suggested
              stock/bond starting point will appear here once all six are in.
            </p>
            <div className="rt-progress"><div className="rt-progress-fill" style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }} /></div>
          </div>
        )}
      </div>
    </div>
  );
}

function Spectrum({ equity }: { equity: number }) {
  return (
    <div>
      <div className="rt-spectrum">
        <div className="rt-spectrum-marker" style={{ left: `${equity}%` }} aria-hidden="true" />
      </div>
      <div className="rt-spectrum-ends">
        <span>Conservative</span>
        <span>Aggressive</span>
      </div>
    </div>
  );
}

function DimBars({ ability, willingness, need }: { ability: number; willingness: number; need: number }) {
  const rows = [
    { label: "Ability (can you afford risk?)", v: ability },
    { label: "Willingness (can you stomach it?)", v: willingness },
    { label: "Need (does the goal require it?)", v: need },
  ];
  return (
    <div style={{ marginBottom: "var(--space-sm)" }}>
      <p className="wl-diversify-title" style={{ marginBottom: "var(--space-sm)" }}>Your three dimensions of risk</p>
      {rows.map((r) => (
        <div key={r.label} className="wl-bar">
          <span className="wl-bar-label">{r.label}</span>
          <span className="wl-bar-value">{Math.round(r.v * 100)}%</span>
          <div className="wl-bar-track"><div className="wl-bar-fill wl-bar-fill--port" style={{ width: `${Math.max(4, r.v * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
