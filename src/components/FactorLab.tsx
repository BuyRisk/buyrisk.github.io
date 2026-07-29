import { useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { FACTORS, FACTOR_PRESETS, RISK_FREE, type Loadings } from "../data/factors";

/**
 * Fama–French factor tool. Set a portfolio's factor loadings (or pick a style
 * preset), then see its expected return attributed to each factor, and how
 * moving from CAPM → 3-factor → 5-factor turns "unexplained alpha" into
 * explained factor exposure. Premia are real long-run Ken French figures.
 */

type Model = "capm" | "ff3" | "ff5";
const MODEL_KEYS: Record<Model, Set<string>> = {
  capm: new Set(["mkt"]),
  ff3: new Set(["mkt", "smb", "hml"]),
  ff5: new Set(["mkt", "smb", "hml", "rmw", "cma"]),
};
const MODEL_LABEL: Record<Model, string> = { capm: "CAPM", ff3: "3-factor", ff5: "5-factor" };

const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;
const signed1 = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;

export default function FactorLab() {
  const [loadings, setLoadings] = useState<Loadings>({ ...FACTOR_PRESETS[2].loadings });
  const [model, setModel] = useState<Model>("ff5");
  const [presetName, setPresetName] = useState(FACTOR_PRESETS[2].name);

  const active = MODEL_KEYS[model];
  const contrib = (key: string) => {
    const f = FACTORS.find((x) => x.key === key)!;
    return loadings[f.key] * f.premium;
  };
  const expectedExcess = FACTORS.filter((f) => active.has(f.key)).reduce((s, f) => s + contrib(f.key), 0);
  const capmExcess = loadings.mkt * FACTORS[0].premium;
  const ff5Excess = FACTORS.reduce((s, f) => s + contrib(f.key), 0);
  const factorAlpha = ff5Excess - capmExcess;
  const totalReturn = RISK_FREE + expectedExcess;

  const setLoad = (k: Factor2, v: number) => {
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

        <div className="fl-model" role="group" aria-label="Model">
          {(["capm", "ff3", "ff5"] as Model[]).map((m) => (
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
            current model.
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
              unexplained <em>alpha</em> — mysterious out-performance. Fama–French
              says it isn't skill at all: it's <strong>factor exposure</strong> you
              could have targeted on purpose. Switch the model above from CAPM to
              5-factor and watch the mystery turn into math.
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

type Factor2 = keyof Loadings;

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
  const rowH = 34;
  const height = FACTORS.length * rowH + 54;
  const pad = { top: 14, right: 16, bottom: 32, left: 96 };
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
            <text x={cx} y={height - pad.bottom + 14} textAnchor="middle" style={axisText}>{f.short}</text>
          </g>
        );
      })}
      <text x={pad.left + plotW / 2} y={height - 2} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Loading (β) on each factor
      </text>
    </svg>
  );
}
