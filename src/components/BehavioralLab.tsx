import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { formatMoney, useCurrencyCode } from "../lib/currency";
import { marketDaily } from "../data/generated/market-daily";

/**
 * "Behavioral Finance: Your Own Worst Enemy" — the companion to the
 * can-you-beat-the-market tool. That one shows timing the market doesn't work;
 * this one shows WHY we try anyway, and what it costs.
 *
 *  • "The behavior gap": a buy-and-hold investor vs. an emotional one who
 *    panic-sells after a drawdown and only buys back once the coast looks clear,
 *    run over real daily US market history (1990–present, so it lives through
 *    the dot-com bust, 2008, and 2020). The emotional investor reliably ends up
 *    poorer — the gap between the return you earn and the return your
 *    investments earned.
 *  • "Why we do it": the cognitive biases (loss aversion, recency, herding…)
 *    that make the panic feel rational in the moment, each with the mistake it
 *    causes and a practical antidote.
 *
 * Educational only, not advice.
 */

const START_CAPITAL = 10_000;
const R = marketDaily.returns;
const YEARS = R.length / 252;
const START_YEAR = new Date(marketDaily.startDate).getFullYear();
const END_YEAR = new Date(marketDaily.endDate).getFullYear();

/** Simulate buy-and-hold vs. an emotional investor over the full daily series. */
function simulate(panicDrop: number, waitRise: number) {
  let mkt = 1, peak = 1, bh = 1, em = 1;
  let inMarket = true, sell = 0, panics = 0, daysOut = 0;
  const bhCurve: number[] = [], emCurve: number[] = [], outMask: boolean[] = [];
  for (const r of R) {
    mkt *= 1 + r;
    peak = Math.max(peak, mkt);
    bh *= 1 + r;
    if (inMarket) {
      em *= 1 + r;
      if (mkt / peak - 1 <= -panicDrop) { inMarket = false; sell = mkt; panics++; }
    } else {
      daysOut++;
      if (mkt / sell - 1 >= waitRise) inMarket = true; // wait for the "coast to clear"
    }
    bhCurve.push(bh); emCurve.push(em); outMask.push(!inMarket);
  }
  const bhCagr = bh ** (1 / YEARS) - 1;
  const emCagr = em ** (1 / YEARS) - 1;
  return { bh, em, bhCurve, emCurve, outMask, panics, daysOut, bhCagr, emCagr };
}

type Bias = { name: string; gist: string; mistake: string; fix: string };
const BIASES: Bias[] = [
  { name: "Loss aversion", gist: "A loss hurts about twice as much as an equal gain feels good.",
    mistake: "Selling in a crash just to stop the pain — locking in the loss right before the rebound.",
    fix: "Set your stock/bond mix in calm times and automate it, so a scary week can't renegotiate it for you." },
  { name: "Recency bias", gist: "We assume the recent past will simply continue.",
    mistake: "Piling into whatever just soared and fleeing whatever just fell — buying high, selling low.",
    fix: "Rebalance on a rule, not a feeling: trimming winners and topping up losers is the opposite of recency." },
  { name: "Herding", gist: "It feels safer to do what everyone else is doing.",
    mistake: "Chasing manias on the way up and joining the stampede for the exits on the way down.",
    fix: "Own the whole market once, cheaply, and ignore the crowd — a written plan beats a moving herd." },
  { name: "Overconfidence", gist: "Most of us rate our own skill and luck well above average.",
    mistake: "Overtrading and concentrating bets, certain we can pick winners and time entries.",
    fix: "Assume you can't out-trade the market (the evidence agrees) and let a low-cost index do the work." },
  { name: "Anchoring", gist: "We fixate on an arbitrary number, like what we paid.",
    mistake: "Refusing to sell a loser 'until it gets back to what I paid,' as if the market remembers your cost.",
    fix: "Judge a holding by its future prospects and your plan, never by your purchase price." },
  { name: "Confirmation bias", gist: "We seek out information that agrees with us.",
    mistake: "Reading only the bulls (or bears) that flatter a position, and missing the risks.",
    fix: "Deliberately seek the strongest case against your view — or sidestep the game by owning everything." },
];

export default function BehavioralLab() {
  useCurrencyCode();
  const [mode, setMode] = useState<"gap" | "biases">("gap");
  const [panicDrop, setPanicDrop] = useState(0.2);
  const [waitRise, setWaitRise] = useState(0.1);
  const [bias, setBias] = useState(0);

  const sim = useMemo(() => simulate(panicDrop, waitRise), [panicDrop, waitRise]);
  const money = (v: number) => formatMoney(v);
  const bhEnd = sim.bh * START_CAPITAL, emEnd = sim.em * START_CAPITAL;
  const gapPct = sim.bhCagr - sim.emCagr;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setMode("gap"); setPanicDrop(0.2); setWaitRise(0.1); setBias(0); }} />
        <div className="wl-simmode" role="group" aria-label="View">
          <button type="button" className={mode === "gap" ? "active" : ""} aria-pressed={mode === "gap"} onClick={() => setMode("gap")}>The behavior gap</button>
          <button type="button" className={mode === "biases" ? "active" : ""} aria-pressed={mode === "biases"} onClick={() => setMode("biases")}>Why we do it</button>
        </div>

        {mode === "gap" ? (
          <>
            <p className="wl-note" style={{ fontStyle: "normal", color: "var(--color-text-soft)" }}>
              Two investors put {money(START_CAPITAL)} in the whole US market in {START_YEAR}. One never touches it. The
              other panics in downturns. Set how the panicker behaves:
            </p>
            <label className="wl-slider">
              <span>
                Panic when the market falls
                <InfoTip text="How deep a drop from the recent peak triggers a sell. A lower number means a jumpier investor who bails at the first real scare." />{" "}
                <strong>{Math.round(panicDrop * 100)}%</strong>
              </span>
              <input type="range" min={0.1} max={0.4} step={0.01} value={panicDrop} onChange={(e) => setPanicDrop(+e.target.value)} />
            </label>
            <label className="wl-slider">
              <span>
                Won't buy back until it rises
                <InfoTip text="After selling, how far the market must climb back before they feel safe enough to reinvest. Waiting for the 'coast to clear' is exactly how you miss the sharp rebound." />{" "}
                <strong>{Math.round(waitRise * 100)}%</strong>
              </span>
              <input type="range" min={0} max={0.4} step={0.01} value={waitRise} onChange={(e) => setWaitRise(+e.target.value)} />
            </label>

            <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
              <span className="ss-headline-label">Panic-selling cost this investor</span>
              <span className="ss-headline-value">{money(bhEnd - emEnd)}</span>
              <span className="ss-headline-sub">
                a <strong>behavior gap</strong> of {(gapPct * 100).toFixed(1)}%/yr — they earned {(sim.emCagr * 100).toFixed(1)}% vs. the market's {(sim.bhCagr * 100).toFixed(1)}%
              </span>
            </div>

            <p className="wl-note" style={{ marginTop: "0.5rem" }}>
              <strong>Method:</strong> real daily US total returns, {START_YEAR}–{END_YEAR} (Fama–French). Cash earns
              nothing while out (a simplification). The point isn't the exact figure — it's the direction, which barely
              ever reverses. Educational only, not advice.
            </p>
          </>
        ) : (
          <>
            <p className="wl-note" style={{ fontStyle: "normal", color: "var(--color-text-soft)" }}>
              The behavior gap isn't stupidity — it's a handful of biases that make selling low feel smart in the moment.
              Tap one to see the mistake it causes and the fix:
            </p>
            <div className="bf-list" role="tablist" aria-label="Cognitive biases">
              {BIASES.map((b, i) => (
                <button key={b.name} type="button" role="tab" aria-selected={bias === i} className={`bf-item${bias === i ? " active" : ""}`} onClick={() => setBias(i)}>
                  {b.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="wl-stage">
        {mode === "gap" ? (
          <>
            <div className="wl-frontier">
              <h3>Staying put vs. selling the dips</h3>
              <GapChart bhCurve={sim.bhCurve} emCurve={sim.emCurve} outMask={sim.outMask} />
              <div className="wl-flegend">
                <span><span className="wl-fdot" style={{ background: "var(--color-accent)" }} /> Buy &amp; hold</span>
                <span><span className="wl-fdot" style={{ background: "var(--color-warn)" }} /> Panic-seller</span>
                <span><span className="wl-fdot" style={{ background: "var(--color-muted)", opacity: 0.35 }} /> Sitting in cash</span>
              </div>
              <p className="wl-fnote">
                The shaded stretches are when the panicker sat in cash, having sold near the bottom and waited to buy back.
                The market's best days cluster right next to its worst, so sitting out the rebound is what does the damage.
              </p>
            </div>
            <div className="wl-lower">
              <div className="wl-readout">
                <dl className="ss-stats">
                  <div><dt>Buy &amp; hold ends at</dt><dd>{money(bhEnd)}</dd></div>
                  <div><dt>Panic-seller ends at</dt><dd>{money(emEnd)}</dd></div>
                  <div><dt>Times they panicked</dt><dd>{sim.panics}</dd></div>
                  <div><dt>Years out of the market</dt><dd>{(sim.daysOut / 252).toFixed(1)}</dd></div>
                </dl>
                <p className="wl-saved">
                  This is the <strong>behavior gap</strong>: the distance between the return investments earn and the
                  lower return investors actually keep, because we buy after things feel good and sell after they feel
                  bad. Studies of real fund flows (Morningstar's "Mind the Gap," and DALBAR before it) find the average
                  investor gives up on the order of a percentage point or more a year to exactly this. The fix is almost
                  insultingly simple and almost impossibly hard: <strong>do nothing.</strong> Pick an allocation you can
                  hold through a crash, automate it, and stop watching. Educational only, not advice.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="wl-frontier">
            <h3>{BIASES[bias].name}</h3>
            <p className="bf-gist">{BIASES[bias].gist}</p>
            <div className="bf-detail">
              <div className="bf-cell bf-cell--bad">
                <span className="bf-cell-label">The mistake it causes</span>
                <p>{BIASES[bias].mistake}</p>
              </div>
              <div className="bf-cell bf-cell--good">
                <span className="bf-cell-label">The antidote</span>
                <p>{BIASES[bias].fix}</p>
              </div>
            </div>
            <p className="wl-saved">
              Notice the antidotes rhyme: <strong>decide in advance, automate, and own the whole market cheaply.</strong>{" "}
              Almost every behavioral trap is disarmed by removing the moment-to-moment decision — because the biases only
              bite when you let a feeling place a trade. The whole point of a written plan is to protect you from yourself.
              Educational only, not advice.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function GapChart({ bhCurve, emCurve, outMask }: { bhCurve: number[]; emCurve: number[]; outMask: boolean[] }) {
  const width = 760, height = 400;
  const pad = { top: 20, right: 18, bottom: 40, left: 58 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const n = bhCurve.length;
  const step = Math.max(1, Math.floor(n / 240)); // downsample for the polyline
  const idx: number[] = [];
  for (let i = 0; i < n; i += step) idx.push(i);
  if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
  const yMax = Math.max(...bhCurve) * START_CAPITAL * 1.05;
  const x = (i: number) => pad.left + (i / (n - 1)) * plotW;
  const y = (v: number) => pad.top + plotH - ((v * START_CAPITAL) / yMax) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const line = (arr: number[]) => idx.map((i, k) => `${k === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(arr[i]).toFixed(1)}`).join(" ");

  // Contiguous cash bands (day ranges where outMask is true).
  const bands: [number, number][] = [];
  let s = -1;
  for (let i = 0; i < n; i++) {
    if (outMask[i] && s < 0) s = i;
    else if (!outMask[i] && s >= 0) { bands.push([s, i]); s = -1; }
  }
  if (s >= 0) bands.push([s, n - 1]);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMax * f);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Buy-and-hold vs. panic-selling wealth over time">
      {bands.map(([a, b], k) => (
        <rect key={k} x={x(a)} y={pad.top} width={Math.max(1, x(b) - x(a))} height={plotH} fill="var(--color-muted)" opacity={0.14} />
      ))}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v / START_CAPITAL)} y2={y(v / START_CAPITAL)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v / START_CAPITAL) + 4} textAnchor="end" style={axisText}>{formatMoney(v, { compact: true })}</text>
        </g>
      ))}
      <path d={line(emCurve)} fill="none" stroke="var(--color-warn)" strokeWidth={2.2} strokeLinejoin="round" />
      <path d={line(bhCurve)} fill="none" stroke="var(--color-accent)" strokeWidth={2.6} strokeLinejoin="round" />
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        {START_YEAR} → {END_YEAR} · growth of {formatMoney(START_CAPITAL)}
      </text>
    </svg>
  );
}
