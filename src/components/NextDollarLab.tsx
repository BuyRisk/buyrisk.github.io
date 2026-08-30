import { useMemo, useState } from "react";
import ResetButton from "./ResetButton";
import MarginalRateLab from "./MarginalRateLab";

/**
 * "Your Next Dollar: Order of Operations" — the priority list for where each
 * new dollar should go, made interactive. Check off what you've already done and
 * the tool highlights the single next rung on the ladder, with the reason it
 * ranks where it does.
 *
 * This is the US "prime directive" order (Bogleheads / r/personalfinance): the
 * principle — free money, then guaranteed returns, then tax-advantaged space,
 * then taxable — travels anywhere, but the account names are American. Flagged
 * US-specific on the page.
 */

type Step = {
  id: string;
  label: string;
  tag: string;
  detail: string;
  /** Which "not applicable" flag skips this step, if any. */
  skip?: "noMatch" | "noHsa";
  /** The terminal destination: no checkbox, it's where everything else leads. */
  terminal?: boolean;
};

const STEPS: Step[] = [
  { id: "budget", label: "Spend less than you earn", tag: "Foundation",
    detail: "Every dollar you invest is the gap between what you make and what you spend. Widen that gap and everything below gets easier; without it, nothing else works." },
  { id: "starter", label: "Save a small starter emergency fund", tag: "Safety net",
    detail: "About one month of expenses in cash, so a surprise bill doesn't have to become high-interest debt while you build everything else." },
  { id: "match", label: "Grab the full employer 401(k) match", tag: "Free money", skip: "noMatch",
    detail: "A 50% match is an instant, guaranteed 50% return — the best deal in all of investing. Contribute at least enough to capture every cent before anything else." },
  { id: "highdebt", label: "Wipe out high-interest debt (≈7%+)", tag: "Guaranteed return",
    detail: "Paying off a debt is a risk-free return equal to its interest rate. A 20% credit card beats any investment you can reliably expect, so clear it before investing more." },
  { id: "efund", label: "Finish a full emergency fund (3–6 months)", tag: "Safety net",
    detail: "Enough cash for 3–6 months of expenses, so a job loss never forces you to sell investments at the worst possible moment." },
  { id: "hsa", label: "Max an HSA (if you have an HDHP)", tag: "Triple tax-free", skip: "noHsa",
    detail: "The only triple-tax-advantaged account: deductible going in, tax-free growth, tax-free out for medical costs. If you're eligible, it outranks even an IRA." },
  { id: "ira", label: "Max an IRA (Roth or Traditional)", tag: "Tax-advantaged",
    detail: "Low fees and the widest investment menu. Roth if you expect a higher tax rate later, Traditional if lower — the Retirement tool works that choice through." },
  { id: "k401", label: "Fill your 401(k) up to the limit", tag: "Tax-advantaged",
    detail: "With the IRA full, keep loading the 401(k) beyond the match, up to the annual limit, for more tax-sheltered compounding." },
  { id: "taxable", label: "Invest the rest in a taxable brokerage", tag: "No limits", terminal: true,
    detail: "No contribution caps and fully flexible. Once tax-advantaged space is maxed, additional investing lands here — hold tax-efficient index funds to keep the tax drag low." },
];

export default function NextDollarLab() {
  const [mode, setMode] = useState<"ladder" | "tax">("ladder");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [noMatch, setNoMatch] = useState(false);
  const [noHsa, setNoHsa] = useState(false);

  const isSkipped = (s: Step) => (s.skip === "noMatch" && noMatch) || (s.skip === "noHsa" && noHsa);

  const currentId = useMemo(() => {
    for (const s of STEPS) {
      if (isSkipped(s)) continue;
      if (s.terminal) return s.id;
      if (!done[s.id]) return s.id;
    }
    return "taxable";
  }, [done, noMatch, noHsa]);

  const current = STEPS.find((s) => s.id === currentId)!;
  const toggle = (id: string) => setDone((d) => ({ ...d, [id]: !d[id] }));
  const reset = () => { setMode("ladder"); setDone({}); setNoMatch(false); setNoHsa(false); };

  const modeTabs = (
    <div className="wl-simmode" role="group" aria-label="View" style={{ marginBottom: "var(--space-sm)" }}>
      <button type="button" className={mode === "ladder" ? "active" : ""} aria-pressed={mode === "ladder"} onClick={() => setMode("ladder")}>
        Where it should go
      </button>
      <button type="button" className={mode === "tax" ? "active" : ""} aria-pressed={mode === "tax"} onClick={() => setMode("tax")}>
        How it's taxed
      </button>
    </div>
  );

  if (mode === "tax") return <MarginalRateLab header={modeTabs} />;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />
        {modeTabs}
        <p className="wl-note" style={{ fontStyle: "normal", color: "var(--color-text-soft)" }}>
          Check off what you've already handled. The ladder highlights the single next place your money should go — and why
          it beats the steps below it.
        </p>

        <p className="br-group">Not applicable to me</p>
        <label className="pl-check"><input type="checkbox" checked={noMatch} onChange={(e) => setNoMatch(e.target.checked)} /> No employer 401(k) match</label>
        <label className="pl-check"><input type="checkbox" checked={noHsa} onChange={(e) => setNoHsa(e.target.checked)} /> Not HSA-eligible (no HDHP)</label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">Your next dollar goes to</span>
          <span className="ss-headline-value" style={{ fontSize: "var(--step-2)" }}>{current.label}</span>
          <span className="ss-headline-sub"><strong>{current.tag}</strong></span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          A widely-used priority order, not a personalized plan — your rates, goals, and situation can reshuffle it (e.g.
          a low-rate mortgage, or a match on Roth vs. pre-tax). Educational only, not financial advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>The order of operations</h3>
          <ol className="nd-ladder">
            {STEPS.map((s, i) => {
              const skipped = isSkipped(s);
              const isCurrent = s.id === currentId;
              const isDone = !skipped && !s.terminal && done[s.id];
              const status = skipped ? "skipped" : isCurrent ? "current" : isDone ? "done" : "upcoming";
              return (
                <li key={s.id} className={`nd-step nd-step--${status}`}>
                  <button
                    type="button"
                    className="nd-step-btn"
                    onClick={() => !skipped && !s.terminal && toggle(s.id)}
                    disabled={skipped || s.terminal}
                    aria-pressed={isDone}
                  >
                    <span className="nd-step-mark" aria-hidden="true">
                      {skipped ? "–" : isDone ? "✓" : isCurrent ? "→" : i + 1}
                    </span>
                    <span className="nd-step-body">
                      <span className="nd-step-label">{s.label}</span>
                      <span className="nd-step-tag">{skipped ? "Not applicable" : isCurrent ? `Next up · ${s.tag}` : s.tag}</span>
                    </span>
                  </button>
                  {isCurrent && <p className="nd-step-detail">{s.detail}</p>}
                </li>
              );
            })}
          </ol>
          <p className="wl-fnote">
            The logic runs top to bottom: capture free money first, then guaranteed returns (paying off dear debt), then
            tax-advantaged space, and finally the unlimited-but-taxable account. Educational only, not advice.
          </p>
        </div>
      </div>
    </div>
  );
}
