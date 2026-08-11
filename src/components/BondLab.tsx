import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { bondYields } from "../data/generated/bond-yields";

/**
 * "Bonds & Interest-Rate Risk", the one risk that surprises new bond investors:
 * when rates rise, bond PRICES fall, and the longer the bond, the harder it falls.
 *
 *  • "Rate risk": a par bond's price change for a given move in rates, across
 *    maturities. Pure bond math (present value of coupons + face). Shows why a
 *    30-year bond is a wild ride and a 2-year barely flinches. That sensitivity
 *    is duration.
 *  • "Today's rates": the current Treasury yield curve from FRED, plus the
 *    10-year decomposed into a real (TIPS) yield and expected inflation.
 *
 * Educational only, not advice.
 */

const MATS = [2, 5, 10, 30];
const pctText = (x: number, dp = 1) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(dp)}%`;

/** Price of a par-priced annual-coupon bond (face 100, coupon = start yield) at yield y. */
function price(y: number, maturity: number, coupon: number) {
  let p = 0;
  for (let t = 1; t <= maturity; t++) p += (coupon * 100) / (1 + y) ** t;
  p += 100 / (1 + y) ** maturity;
  return p;
}
/** Price change (%) if yield moves from y0 by dy. Bond is priced at par at y0. */
function priceChange(y0: number, dy: number, maturity: number) {
  return price(y0 + dy, maturity, y0) / price(y0, maturity, y0) - 1;
}
/** Modified duration ≈ % price change per 1% yield move. */
function modDuration(y0: number, maturity: number) {
  const e = 0.0001;
  return -(price(y0 + e, maturity, y0) - price(y0 - e, maturity, y0)) / (2 * e * price(y0, maturity, y0));
}

export default function BondLab() {
  const [mode, setMode] = useState<"risk" | "curve">("risk");
  const [startYield, setStartYield] = useState(Math.round(bondYields.tenYear.nominal * 10) / 10); // %
  const [rateMove, setRateMove] = useState(1); // percentage points
  const [focus, setFocus] = useState(10);

  const risk = useMemo(() => {
    const y0 = startYield / 100;
    const dy = rateMove / 100;
    const bars = MATS.map((m) => ({ m, change: priceChange(y0, dy, m) * 100, dur: modDuration(y0, m) }));
    const focused = bars.find((b) => b.m === focus)!;
    // Fix the y-axis to the most extreme ±3% move (the slider's max) for the
    // longest maturity, so dragging "rates move by" scales the bars within a
    // stable frame instead of rescaling the axis to fit each time.
    const maxMat = MATS[MATS.length - 1];
    const axisMag = Math.max(
      0.05,
      Math.max(Math.abs(priceChange(y0, 0.03, maxMat)), Math.abs(priceChange(y0, -0.03, maxMat))) * 1.08,
    );
    return { bars, focused, axisMag };
  }, [startYield, rateMove, focus]);

  const inverted = bondYields.curve[0].yield > bondYields.curve[bondYields.curve.length - 1].yield;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setMode("risk"); setStartYield(Math.round(bondYields.tenYear.nominal * 10) / 10); setRateMove(1); setFocus(10); }} />
        <div className="wl-simmode" role="group" aria-label="Mode">
          <button type="button" className={mode === "risk" ? "active" : ""} aria-pressed={mode === "risk"} onClick={() => setMode("risk")}>
            Rate risk
          </button>
          <button type="button" className={mode === "curve" ? "active" : ""} aria-pressed={mode === "curve"} onClick={() => setMode("curve")}>
            Today's rates
          </button>
        </div>

        {mode === "risk" ? (
          <>
            <label className="wl-slider">
              <span>
                Starting yield
                <InfoTip text="The bond's yield today. We price it at par (coupon equals yield), then see what a rate move does to its price." />{" "}
                <strong>{startYield}%</strong>
              </span>
              <input type="range" min={1} max={10} step={0.25} value={startYield} onChange={(e) => setStartYield(+e.target.value)} />
            </label>
            <label className="wl-slider">
              <span>
                Rates move by
                <InfoTip text="How much market interest rates change. Rates up → bond prices down (you're stuck with an old, lower coupon); rates down → prices up." />{" "}
                <strong>{rateMove > 0 ? "+" : ""}{rateMove}%</strong>
              </span>
              <input type="range" min={-3} max={3} step={0.25} value={rateMove} onChange={(e) => setRateMove(+e.target.value)} />
            </label>
            <div className="wl-field">
              <span className="wl-field-label">Focus maturity</span>
              <div className="wl-simmode wl-simmode--wrap" role="group" aria-label="Maturity">
                {MATS.map((m) => (
                  <button key={m} type="button" className={focus === m ? "active" : ""} aria-pressed={focus === m} onClick={() => setFocus(m)}>
                    {m}-yr
                  </button>
                ))}
              </div>
            </div>

            <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
              <span className="ss-headline-label">
                If rates move {rateMove > 0 ? "up" : "down"} {Math.abs(rateMove)}%, a {focus}-year bond's price
              </span>
              <span className="ss-headline-value">{pctText(risk.focused.change)}</span>
              <span className="ss-headline-sub">
                its duration is about <strong>{risk.focused.dur.toFixed(1)}</strong>: roughly {risk.focused.dur.toFixed(1)}% per 1% rate move
              </span>
            </div>

            <p className="wl-note" style={{ marginTop: "0.5rem" }}>
<strong>Method:</strong> pure present-value bond math: no historical data and no default risk assumed. (The
              "Today's rates" tab instead plots the current Treasury curve directly from FRED.) Par bonds, annual
              coupons; longer maturity = bigger price move = more interest-rate risk. Educational only, not advice.
            </p>
          </>
        ) : (
          <>
            <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
              <span className="ss-headline-label">The 10-year Treasury yields</span>
              <span className="ss-headline-value">{bondYields.tenYear.nominal}%</span>
              <span className="ss-headline-sub">
                ≈ <strong>{bondYields.tenYear.real}%</strong> real (TIPS) + <strong>{bondYields.tenYear.breakeven}%</strong> expected inflation
              </span>
            </div>
            <p className="wl-note" style={{ marginTop: "0.5rem" }}>
              The current US Treasury yield curve, {new Date(bondYields.asOf).toLocaleDateString("en-US", { year: "numeric", month: "long" })}. The
              curve is {inverted ? "inverted (short rates above long, often a recession signal)" : "upward-sloping (longer bonds pay more, the normal shape)"}.
              A nominal yield splits into a real return plus the inflation investors expect. Data: {bondYields.source}
            </p>
          </>
        )}
      </div>

      <div className="wl-stage">
        {mode === "risk" ? (
          <>
            <div className="wl-frontier">
              <h3>Same rate move, very different pain</h3>
              <RateRiskChart bars={risk.bars} focus={focus} rateMove={rateMove} mag={risk.axisMag} />
              <p className="wl-fnote">
                Every bar is the same {pctText(rateMove)} rate move, but the longer the bond, the more of its value sits
                in far-off payments that get repriced, so the bigger the price move. That sensitivity has a name: <strong>duration</strong>.
              </p>
            </div>
            <div className="wl-lower">
              <div className="wl-readout">
                <dl className="ss-stats">
                  {risk.bars.map((b) => (
                    <div key={b.m}><dt>{b.m}-year bond</dt><dd>{pctText(b.change)}</dd></div>
                  ))}
                </dl>
                <p className="wl-saved">
                  This is why "bonds are safe" needs an asterisk. They carry little <em>default</em> risk (Treasuries none),
                  but real <strong>interest-rate risk</strong>: in 2022, rates jumped and long Treasuries fell over 30%,
                  a stock-like loss from the "safe" sleeve. The fix isn't to avoid bonds; it's to match their duration to
                  when you need the money. Short bonds for near-term needs, longer for distant ones. Educational only, not advice.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="wl-frontier">
              <h3>Today's Treasury yield curve</h3>
              <CurveChart curve={bondYields.curve} />
              <p className="wl-fnote">
                Yield by maturity, from 3 months to 30 years. Its shape is one of the most-watched signals in finance: an
                upward slope is normal; an inversion (short above long) has preceded most recessions.
              </p>
            </div>
            <div className="wl-lower">
              <div className="wl-readout">
                <dl className="ss-stats">
                  {bondYields.curve.filter((p) => [0.25, 2, 10, 30].includes(p.years)).map((p) => (
                    <div key={p.label}><dt>{p.label}</dt><dd>{p.yield}%</dd></div>
                  ))}
                </dl>
                <p className="wl-saved">
                  A bond's nominal yield is really two things stacked: the <strong>real</strong> return you keep after
                  inflation, plus the <strong>inflation investors expect</strong>. Today the 10-year's {bondYields.tenYear.nominal}%
                  splits into a {bondYields.tenYear.real}% real yield and {bondYields.tenYear.breakeven}% expected inflation,
                  which is exactly what TIPS (inflation-protected Treasuries) let you lock in directly. Data: {bondYields.source}
                  Educational only, not advice.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RateRiskChart({ bars, focus, rateMove, mag }: { bars: { m: number; change: number; dur: number }[]; focus: number; rateMove: number; mag: number }) {
  const width = 760;
  const height = 380;
  const pad = { top: 30, right: 18, bottom: 46, left: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  // `mag` is fixed to the ±3% extreme (passed in), so the axis stays put.
  const y = (v: number) => pad.top + plotH / 2 - (v / mag) * (plotH / 2);
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const bandW = plotW / bars.length;
  const barW = Math.min(96, bandW * 0.5);
  const zero = y(0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Bond price change by maturity for the chosen rate move">
      {[mag, mag / 2, 0, -mag / 2, -mag].map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeDasharray={v === 0 ? "4 3" : undefined} />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{`${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(0)}%`}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const cx = pad.left + bandW * i + bandW / 2;
        const v = b.change / 100;
        const sel = b.m === focus;
        const up = v >= 0;
        const color = up ? "var(--pl-c2)" : "var(--pl-c3)";
        return (
          <g key={b.m}>
            <rect x={cx - barW / 2} y={up ? y(v) : zero} width={barW} height={Math.abs(y(v) - zero)} rx={5} fill={color} opacity={sel ? 1 : 0.42} />
            <text x={cx} y={(up ? y(v) : zero + Math.abs(y(v) - zero)) + (up ? -8 : 16)} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: sel ? 700 : 600, fontSize: sel ? 14 : 12 }}>
              {`${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}%`}
            </text>
            <text x={cx} y={height - pad.bottom + 18} textAnchor="middle" style={{ ...axisText, fontWeight: sel ? 700 : 400, fill: sel ? "var(--color-text)" : "var(--color-muted)" }}>{b.m}-yr</text>
          </g>
        );
      })}
      <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Price change for a {rateMove >= 0 ? "+" : "−"}{Math.abs(rateMove)}% rate move · longer maturity → bigger price move
      </text>
    </svg>
  );
}

function CurveChart({ curve }: { curve: { label: string; years: number; yield: number }[] }) {
  const width = 760;
  const height = 380;
  const pad = { top: 20, right: 24, bottom: 46, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const yields = curve.map((p) => p.yield);
  const yMax = Math.ceil(Math.max(...yields) + 0.5);
  const yMin = Math.max(0, Math.floor(Math.min(...yields) - 0.5));
  // Log-ish spacing by maturity so short end isn't crushed.
  const xs = curve.map((p) => Math.log(p.years + 0.4));
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const x = (i: number) => pad.left + ((xs[i] - xMin) / (xMax - xMin)) * plotW;
  const y = (v: number) => pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const line = curve.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.yield)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Current Treasury yield curve">
      {Array.from({ length: yMax - yMin + 1 }, (_, k) => yMin + k).map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{v}%</text>
        </g>
      ))}
      <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2.8} />
      {curve.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.yield)} r={4} fill="var(--color-accent)" />
          <text x={x(i)} y={y(p.yield) - 10} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 600 }}>{p.yield}%</text>
          <text x={x(i)} y={height - pad.bottom + 18} textAnchor="middle" style={axisText}>{p.label}</text>
        </g>
      ))}
      <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Maturity → yield (% per year)
      </text>
    </svg>
  );
}
