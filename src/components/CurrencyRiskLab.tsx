import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";

/**
 * "Currency Risk: Hedged vs. Unhedged" — when you own foreign assets you own
 * their currencies too, and those swings add volatility. Hedging strips the
 * currency out, leaving the local-currency return.
 *
 * The whole lesson is one ratio: currency volatility vs. the asset's own
 * volatility. For BONDS (low vol) the currency swings can dwarf the asset and
 * hedging roughly halves the risk — a near-free lunch (Perold-Schulman 1988).
 * For STOCKS (high vol) the same currency swing is a modest add and can even
 * diversify, so hedging is optional. This is the standard "hedge bonds, don't
 * sweat stocks" guidance, made visible.
 *
 * Illustrative model — no real FX data. σ_unhedged = √(σ_asset² + σ_fx² +
 * 2ρ σ_asset σ_fx). Educational only, not advice.
 */

const DEFAULTS = {
  stocks: { vol: 16, ret: 6 },
  bonds: { vol: 5, ret: 3 },
};
const pct = (x: number, dp = 1) => `${x.toFixed(dp)}%`;

/** Standard normal pdf. */
const pdf = (x: number, mu: number, sigma: number) =>
  Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));

export default function CurrencyRiskLab() {
  const [asset, setAsset] = useState<"stocks" | "bonds">("stocks");
  const [assetVol, setAssetVol] = useState(DEFAULTS.stocks.vol);
  const [ret, setRet] = useState(DEFAULTS.stocks.ret);
  const [fxVol, setFxVol] = useState(9);
  const [corr, setCorr] = useState(0);

  const setAssetType = (a: "stocks" | "bonds") => {
    setAsset(a);
    setAssetVol(DEFAULTS[a].vol);
    setRet(DEFAULTS[a].ret);
  };

  const calc = useMemo(() => {
    const a = assetVol, f = fxVol, r = corr;
    const hedged = a;
    const unhedged = Math.sqrt(a * a + f * f + 2 * r * a * f);
    const reduction = unhedged > 0 ? 1 - hedged / unhedged : 0;
    const diversifies = unhedged < Math.sqrt(a * a + f * f) - 0.01; // ρ<0 pulled it below the naive sum
    let verdict: { text: string; cls: string };
    if (reduction >= 0.25) verdict = { text: "Hedging meaningfully cuts risk for free — the standard advice for foreign bonds.", cls: "cl-up" };
    else if (reduction >= 0.12) verdict = { text: "Hedging helps some — a judgment call against its cost and complexity.", cls: "cl-fair" };
    else verdict = { text: "Hedging barely moves the needle — usually not worth it, the standard advice for foreign stocks.", cls: "cl-fair" };
    return { hedged, unhedged, reduction, diversifies, verdict };
  }, [assetVol, fxVol, corr]);

  const reset = () => { setAssetType("stocks"); setFxVol(9); setCorr(0); };

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />

        <div className="wl-simmode" role="group" aria-label="Asset type">
          <button type="button" className={asset === "stocks" ? "active" : ""} aria-pressed={asset === "stocks"} onClick={() => setAssetType("stocks")}>Foreign stocks</button>
          <button type="button" className={asset === "bonds" ? "active" : ""} aria-pressed={asset === "bonds"} onClick={() => setAssetType("bonds")}>Foreign bonds</button>
        </div>

        <label className="wl-slider">
          <span>
            The asset's own volatility
            <InfoTip text="How much the investment swings in its LOCAL currency, before any currency effect. Stocks are volatile (~15–20%); bonds are calm (~4–6%). This is what you're left with after hedging." />{" "}
            <strong>{pct(assetVol, 0)}</strong>
          </span>
          <input type="range" min={2} max={25} step={0.5} value={assetVol} onChange={(e) => setAssetVol(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Currency volatility
            <InfoTip text="How much the exchange rate between your currency and the asset's currency swings per year. Major-currency pairs run roughly 7–11%. This is the risk hedging removes." />{" "}
            <strong>{pct(fxVol, 0)}</strong>
          </span>
          <input type="range" min={0} max={18} step={0.5} value={fxVol} onChange={(e) => setFxVol(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Asset ↔ currency correlation
            <InfoTip text="Whether the asset and the currency tend to move together. Often near zero. When negative (a 'safe haven' currency that rises when markets fall), the currency can actually cushion losses — diversifying rather than adding risk." />{" "}
            <strong>{corr >= 0 ? "+" : ""}{corr.toFixed(2)}</strong>
          </span>
          <input type="range" min={-0.5} max={0.5} step={0.05} value={corr} onChange={(e) => setCorr(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Expected return <InfoTip text="Illustrative expected return. Hedging is roughly return-neutral over the long run, so both versions share this center — hedging changes the spread, not the average." /> <strong>{pct(ret, 0)}</strong>
          </span>
          <input type="range" min={0} max={10} step={0.5} value={ret} onChange={(e) => setRet(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">Leaving the currency unhedged raises your risk from {pct(calc.hedged, 0)} to</span>
          <span className="ss-headline-value">{pct(calc.unhedged)}</span>
          <span className="ss-headline-sub">
            volatility — {calc.reduction > 0 ? <>hedging would cut it by <strong>{pct(calc.reduction * 100, 0)}</strong></> : <>hedging wouldn't help here</>}
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          <strong>Method:</strong> illustrative, no real FX data. Total volatility combines the asset and currency swings:
          σ = √(σ_asset² + σ_fx² + 2ρ·σ_asset·σ_fx). Hedging removes the currency terms, leaving σ_asset. Educational
          only, not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>Same average, different spread</h3>
          <DistChart mu={ret} sigmaH={calc.hedged} sigmaU={calc.unhedged} />
          <div className="wl-flegend">
            <span><span className="wl-fdot" style={{ background: "var(--color-accent)" }} /> Hedged (currency stripped out)</span>
            <span><span className="wl-fdot" style={{ background: "var(--color-warn)" }} /> Unhedged (currency included)</span>
          </div>
          <p className="wl-fnote">
            Both bells sit on the same expected return — hedging is roughly return-neutral over the long run. It only
            changes the <em>width</em>: the wider orange curve is the extra range the currency adds.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>Hedged volatility</dt><dd>{pct(calc.hedged, 1)}</dd></div>
              <div><dt>Unhedged volatility</dt><dd>{pct(calc.unhedged, 1)}</dd></div>
              <div><dt>Currency adds</dt><dd>{pct(calc.unhedged - calc.hedged, 1)}</dd></div>
              <div><dt>Hedging cuts risk by</dt><dd>{calc.reduction > 0.005 ? pct(calc.reduction * 100, 0) : "—"}</dd></div>
            </dl>
            <p className={`cl-verdict ${calc.verdict.cls}`}>{calc.verdict.text}</p>
            <p className="wl-saved">
              It comes down to one ratio: currency volatility versus the asset's own. A currency swing of{" "}
              {pct(fxVol, 0)} is <strong>huge</strong> next to a calm bond and a <strong>rounding error</strong> next to a
              volatile stock — which is why the evidence-based rule of thumb is <strong>hedge your foreign bonds, and
              don't lose sleep over hedging foreign stocks.</strong>{" "}
              {calc.diversifies && <>Here the negative correlation even makes the currency a mild <em>cushion</em>, lowering risk below the asset alone. </>}
              Because hedging is close to free over the long run (Perold-Schulman called it a "free lunch"), the whole
              decision is about how much risk it removes. Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DistChart({ mu, sigmaH, sigmaU }: { mu: number; sigmaH: number; sigmaU: number }) {
  const width = 760, height = 360;
  const pad = { top: 18, right: 18, bottom: 42, left: 24 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const sMax = Math.max(sigmaH, sigmaU, 1);
  const xMin = mu - 3.4 * sMax, xMax = mu + 3.4 * sMax;
  const N = 120;
  const xs = Array.from({ length: N + 1 }, (_, i) => xMin + ((xMax - xMin) * i) / N);
  const peak = pdf(mu, mu, Math.max(0.5, sigmaH)); // tallest (narrowest) curve sets the y-scale
  const x = (v: number) => pad.left + ((v - xMin) / (xMax - xMin)) * plotW;
  const y = (d: number) => pad.top + plotH - (d / peak) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const curve = (sig: number) => xs.map((v, i) => `${i === 0 ? "M" : "L"}${x(v).toFixed(1)},${y(pdf(v, mu, Math.max(0.5, sig))).toFixed(1)}`).join(" ");
  const area = (sig: number) => `${curve(sig)} L${x(xMax).toFixed(1)},${y(0).toFixed(1)} L${x(xMin).toFixed(1)},${y(0).toFixed(1)} Z`;

  const ticks = [mu - 2 * sMax, mu - sMax, mu, mu + sMax, mu + 2 * sMax];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Return distribution: hedged (narrow) vs unhedged (wide)">
      <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke="var(--color-border)" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(0) + 5} stroke="var(--color-border)" />
          <text x={x(t)} y={y(0) + 18} textAnchor="middle" style={axisText}>{`${t >= 0 ? "" : "−"}${Math.abs(t).toFixed(0)}%`}</text>
        </g>
      ))}
      <path d={area(sigmaU)} fill="var(--color-warn)" opacity={0.16} />
      <path d={area(sigmaH)} fill="var(--color-accent)" opacity={0.16} />
      <path d={curve(sigmaU)} fill="none" stroke="var(--color-warn)" strokeWidth={2.4} />
      <path d={curve(sigmaH)} fill="none" stroke="var(--color-accent)" strokeWidth={2.6} />
      <line x1={x(mu)} x2={x(mu)} y1={pad.top} y2={y(0)} stroke="var(--color-muted)" strokeDasharray="3 3" opacity={0.5} />
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        One-year return · wider = more risk
      </text>
    </svg>
  );
}
