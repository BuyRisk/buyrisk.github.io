import { useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { FACTORS, FACTOR_PRESETS, RISK_FREE, type Loadings, type FactorKey } from "../data/factors";
import { factorPremia, type LadderPortfolio, type LadderRung } from "../data/generated/factor-premia";

/**
 * Factor Lab — two co-equal views behind a segmented control.
 *
 *  1. "Explain a portfolio" (default): the alpha-decay ladder. Pick a real
 *     Fama–French test portfolio, then add legitimate risk factors one rung at a
 *     time (CAPM → FF3 → FF5 → +Momentum → +Quality → +Defensive → +Liquidity)
 *     and watch its apparent "alpha" melt as the return is re-explained as
 *     ordinary factor exposure. Alphas are REAL regression intercepts, shipped
 *     with a t-stat, so a portfolio's out-performance can be flagged as looking
 *     like skill (|t| ≥ 2) or indistinguishable from luck.
 *
 *  2. "Build your own tilt": set a hypothetical portfolio's factor loadings (or
 *     pick a style preset) and see its expected return attributed to each factor.
 *     Here "alpha" means "the return CAPM can't see" — a hypothetical, with no
 *     t-stat, because you're inventing the portfolio rather than measuring one.
 *
 * Premia are real long-run US figures; educational only, not financial advice.
 */

const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;
const signed1 = (x: number) => {
  // Round first, then normalize -0.0 → +0.0 so tiny negatives don't show "-0.0%".
  const p = Math.abs(x * 100) < 0.05 ? 0 : x * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
};

export default function FactorLab() {
  const [mode, setMode] = useState<"ladder" | "build">("ladder");
  return (
    <div className="fl-root">
      <div className="wl-simmode fl-modes" role="group" aria-label="Choose a view">
        <button type="button" className={mode === "ladder" ? "active" : ""} aria-pressed={mode === "ladder"} onClick={() => setMode("ladder")}>
          Explain a portfolio
        </button>
        <button type="button" className={mode === "build" ? "active" : ""} aria-pressed={mode === "build"} onClick={() => setMode("build")}>
          Build your own tilt
        </button>
      </div>
      <p className="fl-mode-hint">
        {mode === "ladder"
          ? "Watch a real portfolio's apparent skill get explained away as ordinary risk-factor exposure, one factor at a time."
          : "Dial in a hypothetical portfolio's factor exposures and see where its expected return comes from."}
      </p>
      {mode === "ladder" ? <LadderView /> : <BuildView />}
    </div>
  );
}

/* ======================================================================= *
 *  1. EXPLAIN A PORTFOLIO — the alpha-decay ladder
 * ======================================================================= */

const RUNG_COUNT = factorPremia.ladder[0].rungs.length; // 7
// Quick-jump labels → rung index into the nested ladder.
const QUICK_JUMPS: { label: string; idx: number; hint: string }[] = [
  { label: "CAPM", idx: 0, hint: "Market only" },
  { label: "FF3", idx: 1, hint: "+ Size, Value" },
  { label: "FF5", idx: 2, hint: "+ Profitability, Investment" },
  { label: "Extended", idx: RUNG_COUNT - 1, hint: "+ Momentum, Quality, Defensive, Liquidity" },
];

/** Which factors each rung adds (parallel to the reducer's RUNGS), for honesty copy.
 *  FF3 adds Size+Value together; FF5 adds Profitability+Investment together. */
const RUNG_FACTORS: FactorKey[][] = [[], ["smb", "hml"], ["rmw", "cma"], ["umd"], ["qmj"], ["bab"], ["liq"]];

function skillFlag(rung: LadderRung): { label: string; cls: string } {
  if (Math.abs(rung.tStat) < 2) return { label: "Indistinguishable from luck", cls: "fl-flag-luck" };
  if (rung.alpha >= 0) return { label: "Looks like genuine skill", cls: "fl-flag-skill" };
  return { label: "A real, persistent drag", cls: "fl-flag-drag" };
}

function LadderView() {
  const [portKey, setPortKey] = useState(factorPremia.ladder[0].key);
  const [rungIdx, setRungIdx] = useState(0);
  const port = factorPremia.ladder.find((p) => p.key === portKey)!;
  const rung = port.rungs[rungIdx];
  const flag = skillFlag(rung);

  const reset = () => {
    setPortKey(factorPremia.ladder[0].key);
    setRungIdx(0);
  };

  // Honesty-guard copy: did the factor(s) this rung added actually move alpha?
  const prevAlpha = rungIdx > 0 ? port.rungs[rungIdx - 1].alpha : rung.alpha;
  const deltaAlpha = rung.alpha - prevAlpha;
  const addedFactors = RUNG_FACTORS[rungIdx].map((k) => FACTORS.find((f) => f.key === k)!);
  const hasAdded = addedFactors.length > 0;
  const addedNames = addedFactors.map((f) => f.name).join(" and ");
  const addedShorts = addedFactors.map((f) => f.short).join(", ");
  const barelyMoved = rungIdx > 0 && Math.abs(deltaAlpha) < 0.004;

  // Does this portfolio's alpha shrink across the ladder, or grow? (Tech's grows.)
  const capmAlpha = port.rungs[0].alpha;
  const finalAlpha = port.rungs[port.rungs.length - 1].alpha;
  const alphaShrinks = Math.abs(finalAlpha) <= Math.abs(capmAlpha);

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />

        <label className="wl-slider">
          <span>
            Portfolio to explain
            <InfoTip text="Real Fama–French value-weighted portfolios. Each has a genuine long-run track record; the ladder asks how much of it is skill." />
          </span>
          <select
            className="wl-add"
            value={portKey}
            onChange={(e) => {
              setPortKey(e.target.value);
              setRungIdx(0);
            }}
          >
            {["Size & value", "Industry"].map((group) => (
              <optgroup key={group} label={group}>
                {factorPremia.ladder
                  .filter((p) => p.group === group)
                  .map((p) => (
                    <option key={p.key} value={p.key}>{p.name}</option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <p className="fl-port-blurb">{port.blurb}</p>

        <p className="fl-group">Jump to a model</p>
        <div className="fl-model fl-model--4" role="group" aria-label="Jump to a standard model">
          {QUICK_JUMPS.map((q) => (
            <button key={q.label} type="button" className={rungIdx === q.idx ? "active" : ""} aria-pressed={rungIdx === q.idx} title={q.hint} onClick={() => setRungIdx(q.idx)}>
              {q.label}
            </button>
          ))}
        </div>

        <p className="fl-group">Add factors, one rung at a time</p>
        <div className="fl-stepper">
          <button type="button" className="fl-step-btn" disabled={rungIdx === 0} onClick={() => setRungIdx((i) => Math.max(0, i - 1))} aria-label="Remove the last factor">
            ← Fewer
          </button>
          <span className="fl-step-now">{rung.add}</span>
          <button type="button" className="fl-step-btn" disabled={rungIdx === RUNG_COUNT - 1} onClick={() => setRungIdx((i) => Math.min(RUNG_COUNT - 1, i + 1))} aria-label="Add the next factor">
            More →
          </button>
        </div>
        <p className="wl-fnote">
          Alpha here is a <strong>real regression intercept</strong> with a{" "}
          <em>t</em>-statistic: the portfolio's average monthly excess return
          regressed on the factors, {factorPremia.span[0].slice(0, 4)}–
          {factorPremia.span[1].slice(0, 4)} ({factorPremia.nMonths} months).
        </p>
      </div>

      <div className="wl-stage">
        <div className="fl-headline">
          <span className="fl-headline-label">Unexplained alpha · {rung.add}</span>
          <span className="fl-headline-value">{signed1(rung.alpha)}<span className="fl-headline-unit"> / yr</span></span>
          <span className="fl-headline-sub">
            <span className={`fl-flag ${flag.cls}`}>{flag.label}</span>
            {" "}<em>t</em> = {rung.tStat.toFixed(1)} · R² = {rung.r2.toFixed(2)}
          </span>
        </div>

        <div className="wl-frontier">
          <h3>{alphaShrinks ? "Watch the alpha melt" : "Watch the alpha emerge"}</h3>
          <AlphaDecayChart port={port} rungIdx={rungIdx} onPick={setRungIdx} />
          <p className="wl-fnote">
            {alphaShrinks ? (
              <>Each rung adds a legitimate risk factor. As real factors soak up the
              returns, the leftover alpha — the part no known risk explains —
              shrinks toward zero.</>
            ) : (
              <>Each rung adds a legitimate risk factor — but here the leftover alpha
              actually <em>grows</em>: once you account for the factors this portfolio
              is tilted <em>against</em> (its size or value loadings can be negative),
              a real outperformance CAPM alone couldn't see is revealed.</>
            )}
            {" "}|<em>t</em>| ≥ 2 (bars past the dotted line)
            marks alpha that's statistically hard to write off as luck.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <h3>Where the return came from</h3>
            <ContributionStack rawExcess={port.rawExcess} alpha={rung.alpha} />
            <p className="wl-fnote">
              The portfolio actually delivered <strong>{pct1(port.rawExcess)}</strong>{" "}
              a year above T-bills. At this rung, {pct1(Math.max(0, port.rawExcess - rung.alpha))}{" "}
              of that is explained as ordinary factor exposure; {signed1(rung.alpha)}{" "}
              is left as alpha.
            </p>
          </div>

          <div className="wl-readout">
            <h3>The honesty check</h3>
            {barelyMoved && hasAdded ? (
              <p className="wl-saved">
                Adding <strong>{addedNames}</strong> barely moved the alpha
                ({signed1(deltaAlpha)}). That's the honest rule: a legitimate
                factor only explains returns <em>where the portfolio is actually
                exposed to it</em>. This portfolio has little {addedNames.toLowerCase()}{" "}
                exposure, so its {addedShorts} rung does almost nothing.
              </p>
            ) : rungIdx === 0 ? (
              <p className="wl-saved">
                To CAPM, this portfolio's whole excess over the market looks like
                mysterious skill. Start adding factors and watch how much of it
                was really just <strong>risk you could have targeted on purpose</strong>.
              </p>
            ) : hasAdded ? (
              <p className="wl-saved">
                Adding <strong>{addedNames}</strong> ({addedShorts})
                changed the alpha by <strong>{signed1(deltaAlpha)}</strong> — this
                portfolio really is exposed {addedFactors.length > 1 ? "to them" : "to it"}, so {addedFactors.length > 1 ? "they do" : "it does"} real
                explanatory work here. Skill, or paid-for risk?
              </p>
            ) : (
              <p className="wl-saved">Step through the factors and watch the alpha respond.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlphaDecayChart({ port, rungIdx, onPick }: { port: LadderPortfolio; rungIdx: number; onPick: (i: number) => void }) {
  const width = 720;
  const rowH = 30;
  const height = port.rungs.length * rowH + 46;
  const pad = { top: 12, right: 20, bottom: 30, left: 150 };
  const plotW = width - pad.left - pad.right;

  const maxAbs = Math.max(0.01, ...port.rungs.map((r) => Math.abs(r.alpha))) * 1.18;
  const cx = (v: number) => pad.left + ((v + maxAbs) / (2 * maxAbs)) * plotW;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  // Rough t≈2 threshold marker: alpha where |t| would cross 2, using this rung's
  // alpha/tStat ratio (SE proxy). Drawn only when the rung has a nonzero t.
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={`Alpha of ${port.name} at each rung of the factor ladder`}>
      <line x1={cx(0)} x2={cx(0)} y1={pad.top} y2={height - pad.bottom} stroke="var(--color-border)" />
      {port.rungs.map((r, i) => {
        const y = pad.top + i * rowH;
        const cur = i === rungIdx;
        const x0 = cx(0);
        const x1 = cx(r.alpha);
        const sig = Math.abs(r.tStat) >= 2;
        const fill = sig ? (r.alpha >= 0 ? "var(--color-accent)" : "var(--color-error)") : "var(--color-muted)";
        return (
          <g key={i} style={{ cursor: "pointer" }} onClick={() => onPick(i)} opacity={cur ? 1 : 0.62}>
            {cur && <rect x={2} y={y + 1} width={width - 4} height={rowH - 2} rx={4} fill="var(--color-accent-soft)" />}
            <text x={pad.left - 10} y={y + rowH / 2 + 4} textAnchor="end" style={{ ...axisText, fill: cur ? "var(--color-text)" : "var(--color-text-soft)", fontWeight: cur ? 700 : 400 }}>
              {r.add}
            </text>
            <rect x={Math.min(x0, x1)} y={y + 6} width={Math.max(1, Math.abs(x1 - x0))} height={rowH - 14} rx={2} fill={fill} />
            <text x={x1 + (r.alpha >= 0 ? 6 : -6)} y={y + rowH / 2 + 4} textAnchor={r.alpha >= 0 ? "start" : "end"} style={{ ...axisText, fill: "var(--color-text)", fontWeight: cur ? 700 : 400 }}>
              {signed1(r.alpha)}
            </text>
          </g>
        );
      })}
      {[-maxAbs, 0, maxAbs].map((v, i) => (
        <text key={i} x={cx(v)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{signed1(v)}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 3} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Annual alpha at each rung (click a rung) →
      </text>
    </svg>
  );
}

function ContributionStack({ rawExcess, alpha }: { rawExcess: number; alpha: number }) {
  const width = 440;
  const height = 96;
  const pad = { top: 30, right: 14, bottom: 30, left: 14 };
  const plotW = width - pad.left - pad.right;
  const explained = rawExcess - alpha;

  const lo = Math.min(0, rawExcess, explained);
  const hi = Math.max(0, rawExcess, explained);
  const span = hi - lo || 0.01;
  const x = (v: number) => pad.left + ((v - lo) / span) * plotW;
  const barY = pad.top;
  const barH = height - pad.top - pad.bottom;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  const alphaPos = alpha >= 0;
  // Explained segment 0→explained; alpha segment explained→rawExcess.
  const segExplained = { a: Math.min(x(0), x(explained)), b: Math.max(x(0), x(explained)) };
  const segAlpha = { a: Math.min(x(explained), x(rawExcess)), b: Math.max(x(explained), x(rawExcess)) };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Portfolio excess return split into factor-explained return and leftover alpha">
      <rect x={segExplained.a} y={barY} width={Math.max(0, segExplained.b - segExplained.a)} height={barH} rx={3} fill="var(--color-accent)" />
      <rect x={segAlpha.a} y={barY} width={Math.max(0, segAlpha.b - segAlpha.a)} height={barH} rx={3} fill={alphaPos ? "var(--pl-c5)" : "var(--color-error)"} />
      {/* actual delivered return tick */}
      <line x1={x(rawExcess)} x2={x(rawExcess)} y1={barY - 6} y2={barY + barH + 6} stroke="var(--color-text)" strokeWidth={1.5} />
      <text x={x(rawExcess)} y={barY - 10} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 600 }}>
        delivered {pct1(rawExcess)}
      </text>
      {x(0) > pad.left + 2 && <line x1={x(0)} x2={x(0)} y1={barY} y2={barY + barH} stroke="var(--color-border)" />}
      <text x={(segExplained.a + segExplained.b) / 2} y={barY + barH + 16} textAnchor="middle" style={axisText}>Explained by factors</text>
      <text x={(segAlpha.a + segAlpha.b) / 2} y={barY + barH + 16} textAnchor="middle" style={{ ...axisText, fill: alphaPos ? "var(--color-text-soft)" : "var(--color-error)" }}>
        alpha {signed1(alpha)}
      </text>
    </svg>
  );
}

/* ======================================================================= *
 *  2. BUILD YOUR OWN TILT — the hypothetical-loadings mechanic
 * ======================================================================= */

type Model = "capm" | "ff3" | "ff5" | "ext";
const MODEL_KEYS: Record<Model, Set<string>> = {
  capm: new Set(["mkt"]),
  ff3: new Set(["mkt", "smb", "hml"]),
  ff5: new Set(["mkt", "smb", "hml", "rmw", "cma"]),
  ext: new Set(FACTORS.map((f) => f.key)),
};
const MODEL_LABEL: Record<Model, string> = { capm: "CAPM", ff3: "3-factor", ff5: "5-factor", ext: "Extended" };

function BuildView() {
  const [loadings, setLoadings] = useState<Loadings>({ ...FACTOR_PRESETS[2].loadings });
  const [model, setModel] = useState<Model>("ff5");
  const [presetName, setPresetName] = useState(FACTOR_PRESETS[2].name);

  const active = MODEL_KEYS[model];
  const contrib = (key: FactorKey) => {
    const f = FACTORS.find((x) => x.key === key)!;
    return loadings[f.key] * f.premium;
  };
  const expectedExcess = FACTORS.filter((f) => active.has(f.key)).reduce((s, f) => s + contrib(f.key), 0);
  const capmExcess = loadings.mkt * FACTORS[0].premium;
  const factorAlpha = expectedExcess - capmExcess;
  const totalReturn = RISK_FREE + expectedExcess;

  const setLoad = (k: FactorKey, v: number) => {
    setLoadings((p) => ({ ...p, [k]: v }));
    setPresetName("");
  };
  const applyPreset = (name: string) => {
    const p = FACTOR_PRESETS.find((x) => x.name === name);
    if (p) {
      setLoadings({ ...p.loadings });
      setPresetName(name);
    }
  };

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton
          onReset={() => {
            setLoadings({ ...FACTOR_PRESETS[2].loadings });
            setModel("ff5");
            setPresetName(FACTOR_PRESETS[2].name);
          }}
        />
        <label className="wl-slider">
          <span>
            Portfolio style
            <InfoTip text="Pick a well-known equity style to load typical factor exposures, or drag the sliders to build your own." />
          </span>
          <select className="wl-add" value={presetName} onChange={(e) => applyPreset(e.target.value)}>
            <option value="">Custom tilt…</option>
            {FACTOR_PRESETS.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </label>

        <div className="fl-model fl-model--4" role="group" aria-label="Model">
          {(["capm", "ff3", "ff5", "ext"] as Model[]).map((m) => (
            <button key={m} type="button" className={model === m ? "active" : ""} aria-pressed={model === m} onClick={() => setModel(m)}>
              {MODEL_LABEL[m]}
            </button>
          ))}
        </div>

        <p className="fl-group">Factor loadings (β)</p>
        {FACTORS.map((f) => (
          <label className={`wl-slider ${active.has(f.key) ? "" : "fl-dim"}`} key={f.key}>
            <span>
              <span className="fl-dot" style={{ background: f.color }} /> {f.name} ({f.short})
              {f.extended ? <span className="fl-ext-tag">ext</span> : null}
              <InfoTip text={f.blurb} />{" "}
              <strong>{loadings[f.key].toFixed(2)}</strong>
            </span>
            <input type="range" min={-0.8} max={1.4} step={0.02} value={loadings[f.key]} onChange={(e) => setLoad(f.key, Number(e.target.value))} />
          </label>
        ))}
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>Where the return comes from</h3>
          <AttributionChart loadings={loadings} active={active} expectedExcess={expectedExcess} />
          <p className="wl-fnote">
            Each bar is a factor's contribution to expected return: your loading ×
            that factor's historical premium. Greyed factors are switched off in the
            current model. The four <span className="fl-ext-tag">ext</span> factors
            only count once you select the Extended model.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <div className="fl-headline">
              <span className="fl-headline-label">Expected return above T-bills ({MODEL_LABEL[model]})</span>
              <span className="fl-headline-value">{pct1(expectedExcess)}</span>
              <span className="fl-headline-sub">≈ {pct1(totalReturn)} total, adding a {pct1(RISK_FREE)} risk-free base</span>
            </div>
            <dl className="fl-stats">
              <div><dt>CAPM (market only) predicts</dt><dd>{pct1(capmExcess)}</dd></div>
              <div><dt>The other factors add</dt><dd>{signed1(factorAlpha)}</dd></div>
            </dl>
            <p className="wl-saved">
              To CAPM, that <strong>{signed1(factorAlpha)}</strong> looks like
              unexplained <em>alpha</em>: the return CAPM can't see. Fama–French
              and its extensions say it isn't skill at all — it's{" "}
              <strong>factor exposure</strong> you could have targeted on purpose.
              (Because you're inventing this portfolio, there's no <em>t</em>-stat
              here; for measured alpha with a t-stat, use "Explain a portfolio".)
            </p>
          </div>

          <div className="wl-readout">
            <h3>Your factor exposures</h3>
            <LoadingsChart loadings={loadings} active={active} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AttributionChart({
  loadings,
  active,
  expectedExcess,
}: {
  loadings: Loadings;
  active: Set<string>;
  expectedExcess: number;
}) {
  const width = 720;
  const rowH = 30;
  const height = FACTORS.length * rowH + 54;
  const pad = { top: 14, right: 16, bottom: 32, left: 100 };
  const plotW = width - pad.left - pad.right;

  const contribs = FACTORS.map((f) => ({ f, c: loadings[f.key] * f.premium }));
  const maxAbs = Math.max(0.02, ...contribs.map((x) => Math.abs(x.c)), Math.abs(expectedExcess)) * 1.15;
  const cx = (v: number) => pad.left + ((v + maxAbs) / (2 * maxAbs)) * plotW;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Contribution of each factor to expected return">
      <line x1={cx(0)} x2={cx(0)} y1={pad.top} y2={height - pad.bottom} stroke="var(--color-border)" />
      {contribs.map(({ f, c }, i) => {
        const y = pad.top + i * rowH;
        const on = active.has(f.key);
        const x0 = cx(0);
        const x1 = cx(c);
        return (
          <g key={f.key} opacity={on ? 1 : 0.28}>
            <text x={pad.left - 8} y={y + rowH / 2 + 4} textAnchor="end" style={{ ...axisText, fill: "var(--color-text-soft)" }}>{f.short}</text>
            <rect x={Math.min(x0, x1)} y={y + 5} width={Math.abs(x1 - x0)} height={rowH - 14} rx={2} fill={f.color} />
            <text x={x1 + (c >= 0 ? 6 : -6)} y={y + rowH / 2 + 4} textAnchor={c >= 0 ? "start" : "end"} style={{ ...axisText, fill: "var(--color-text)" }}>{signed1(c)}</text>
          </g>
        );
      })}
      {[-maxAbs, 0, maxAbs].map((v, i) => (
        <text key={i} x={cx(v)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{signed1(v)}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Contribution to expected annual return →
      </text>
    </svg>
  );
}

function LoadingsChart({ loadings, active }: { loadings: Loadings; active: Set<string> }) {
  const width = 440;
  const height = 200;
  const pad = { top: 12, right: 12, bottom: 30, left: 34 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const vals = FACTORS.map((f) => loadings[f.key]);
  const yMax = Math.max(1.2, ...vals) * 1.05;
  const yMin = Math.min(-0.4, ...vals) * 1.05;
  const bw = plotW / FACTORS.length;
  const y = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Factor loadings (betas) for the portfolio">
      {[-0.5, 0, 0.5, 1].filter((t) => t >= yMin && t <= yMax).map((t) => (
        <g key={t}>
          <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-border)" opacity={t === 0 ? 1 : 0.5} />
          <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" style={axisText}>{t}</text>
        </g>
      ))}
      {FACTORS.map((f, i) => {
        const on = active.has(f.key);
        const v = loadings[f.key];
        const cx = pad.left + i * bw + bw / 2;
        return (
          <g key={f.key} opacity={on ? 1 : 0.28}>
            <rect x={cx - bw * 0.3} y={Math.min(y(0), y(v))} width={bw * 0.6} height={Math.abs(y(v) - y(0))} rx={2} fill={f.color} />
            <text x={cx} y={height - pad.bottom + 14} textAnchor="middle" style={{ ...axisText, fontSize: 10 }}>{f.short}</text>
          </g>
        );
      })}
      <text x={pad.left + plotW / 2} y={height - 2} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Loading (β) on each factor
      </text>
    </svg>
  );
}
