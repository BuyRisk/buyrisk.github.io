import { useMemo, useState } from "react";
import { assetStats } from "../data/generated/asset-stats";
import { axisText, linePath } from "../lib/chart";
import { mulberry32 } from "../lib/portfolio";

/**
 * The homepage's five-second demo: the site's entire thesis in one control.
 * Drag a risk level and read what a century of US markets actually paid for
 * bearing it — each dot a real asset class, the line the trade they sit on.
 *
 * A deliberately compact preview, not a lab: one slider, no tabs, no method
 * panel. It exists so a first-time visitor understands what this site *is*
 * before navigating anywhere, and it links straight to the full tool.
 * Same Damodaran data (and the same ladder fit) as RiskReturnLab.
 */

const A = assetStats.assets;
/**
 * Labels are spelled out — "Bonds" vs "Corporate" left it unclear that the
 * first meant Treasuries. `place` keeps the crowded low-volatility cluster
 * legible: those three sit within a few pixels horizontally, so their labels
 * go to the RIGHT of each dot (they separate vertically instead), while the
 * two right-hand dots label above.
 */
const DOTS = [
  { label: "Cash (T-bills)", ...A["tbills"], place: "right" },
  { label: "Treasury bonds", ...A["treasuries"], place: "right" },
  { label: "Corporate bonds", ...A["corporate-bonds"], place: "right" },
  { label: "US stocks", ...A["us-stocks"], place: "above" },
  { label: "Small-cap value", ...A["small-cap-value"], place: "above" },
] as const;

/** OLS of return on volatility across the risk ladder. */
const FIT = (() => {
  const n = DOTS.length;
  const mx = DOTS.reduce((s, p) => s + p.sigma, 0) / n;
  const my = DOTS.reduce((s, p) => s + p.mu, 0) / n;
  let cov = 0, varx = 0;
  for (const p of DOTS) { cov += (p.sigma - mx) * (p.mu - my); varx += (p.sigma - mx) ** 2; }
  const b = cov / varx;
  return { a: my - b * mx, b };
})();

const LO = 0.03, HI = 0.38; // spans cash → small-cap value, the real ladder

/**
 * The ride inset: ten simulated years at the chosen setting. One sequence of
 * monthly luck (seeded standard normals via Box–Muller) held FIXED while you
 * drag, so the slider morphs the SAME decade — drift comes from the ladder
 * fit, roughness from the chosen volatility. Deliberately a random path, not
 * a periodic wave: markets don't oscillate on a schedule, and a rhythmic
 * curve would imply the timeable cycles the Bias Arcade exists to debunk.
 * Around it, the ±1σ cone of ten-year outcomes: a thread at cash-like risk,
 * a funnel at the top of the ladder.
 *
 * "New decade" re-rolls the luck on demand. Keeping the two gestures separate
 * is the whole point: drag = same history, different exposure; roll = same
 * exposure, different history. A slider that reshuffled as you moved it would
 * confound the two and read as a randomize button.
 */
const RIDE_MONTHS = 120;
/** Log-wealth domain, fixed so amplitude changes stay visible instead of being
 *  renormalized away as the slider moves. */
const RIDE_YMIN = -1.2, RIDE_YMAX = 3.0;

function makeRide(seed: number): number[] {
  const rng = mulberry32(seed);
  const z: number[] = [];
  while (z.length < RIDE_MONTHS) {
    const u = Math.max(rng(), 1e-9), v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    z.push(r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v));
  }
  return z.slice(0, RIDE_MONTHS);
}

/**
 * A rolled decade has to stay on-canvas at EVERY slider position, not just the
 * one showing when you rolled it — otherwise dragging afterwards would run the
 * line into the frame and read as a bug. Checked across the ladder; the top is
 * the binding case. This does clip the wildest ~1-in-8 decades, so the rolled
 * sample is very slightly tamer than reality — a deliberate trade for a hero
 * figure, and the reason the domain above is generous rather than snug.
 */
function fitsFrame(z: number[]): boolean {
  for (const risk of [LO, 0.15, HI]) {
    const mu = FIT.a + FIT.b * risk;
    const k = (Math.log(1 + mu) - (risk * risk) / 2) / 12;
    const sm = risk / Math.sqrt(12);
    let cum = 0;
    for (const zi of z) {
      cum += k + sm * zi;
      if (cum < RIDE_YMIN + 0.06 || cum > RIDE_YMAX - 0.06) return false;
    }
  }
  return true;
}

/** Next usable seed after `from`. Sequential, so the roll order is repeatable. */
function nextSeed(from: number): number {
  for (let s = from + 1; s < from + 500; s++) if (fitsFrame(makeRide(s))) return s;
  return from + 1;
}

const RIDE_SEED0 = 105; // a typical decade: mid-path slump, on-trend finish
const mult = (logW: number) => `×${Math.exp(logW) >= 10 ? Math.exp(logW).toFixed(0) : Math.exp(logW).toFixed(1)}`;

function RideInset({ risk, mu }: { risk: number; mu: number }) {
  // Seeded (not Math.random) so the SSR pass and the first client render agree.
  const [seed, setSeed] = useState(RIDE_SEED0);
  const [rolls, setRolls] = useState(0);
  const ride = useMemo(() => makeRide(seed), [seed]);

  const W = 760, H = 190;
  const pad = { top: 16, right: 92, bottom: 26, left: 14 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const sm = risk / Math.sqrt(12); // monthly volatility
  /**
   * Volatility drag. The ladder fit gives an ARITHMETIC average return, but a
   * decade compounds, and compounding is driven by the log return — whose mean
   * is lower by σ²/2. Subtracting it here makes the dashed center line the
   * TYPICAL (median) decade and (1+mu)^10 the true average, instead of drawing
   * the average and calling it typical. At cash-like risk the correction is
   * invisible; at the top of the ladder it halves the typical ending, which is
   * the honest other half of "more risk pays more."
   */
  const k = (Math.log(1 + mu) - (risk * risk) / 2) / 12; // monthly MEDIAN log drift
  const drag = (sm * sm) / 2; // monthly gap between the average and the typical path

  const yMin = RIDE_YMIN, yMax = RIDE_YMAX;
  const x = (m: number) => pad.left + (m / RIDE_MONTHS) * plotW;
  const y = (logW: number) => pad.top + plotH - ((Math.min(Math.max(logW, yMin), yMax) - yMin) / (yMax - yMin)) * plotH;

  let cum = 0;
  const path = [0, ...ride.map((z) => (cum += k + sm * z))];
  const months = Array.from({ length: RIDE_MONTHS + 1 }, (_, m) => m);
  const trendEnd = k * RIDE_MONTHS;
  const bandEnd = sm * Math.sqrt(RIDE_MONTHS);
  const meanEnd = trendEnd + drag * RIDE_MONTHS; // === log(1 + mu) * 10
  /**
   * The average line fades in only once it has visibly separated from the
   * typical one. Below ~20% volatility the two are within a few pixels, where a
   * second label would be noise; a continuous fade avoids popping mid-drag.
   */
  const gapPx = drag * RIDE_MONTHS * (plotH / (yMax - yMin));
  const meanFade = Math.max(0, Math.min(1, (gapPx - 7) / 9));

  /**
   * Label de-collision. At cash-like risk the three endings land within ~6px of
   * each other — the correct *picture* (the endings agree) but unreadable text.
   * Push each label away from the bold "typical" anchor to a legible gap,
   * preserving order; at higher risk the real spacing already exceeds it and
   * nothing moves.
   */
  const MIN_GAP = 12;
  const away = (target: number, prev: number, dir: -1 | 1) =>
    dir < 0 ? Math.min(target, prev - MIN_GAP) : Math.max(target, prev + MIN_GAP);
  const yTypical = y(trendEnd);
  const yAverage = away(y(meanEnd), yTypical, -1);
  const yLucky = away(y(trendEnd + bandEnd), meanFade > 0 ? yAverage : yTypical, -1);
  const yUnlucky = away(y(trendEnd - bandEnd), yTypical, 1);
  const cone =
    months.map((m) => `${x(m).toFixed(1)},${y(k * m + sm * Math.sqrt(m)).toFixed(1)}`).join(" ") +
    " " +
    [...months].reverse().map((m) => `${x(m).toFixed(1)},${y(k * m - sm * Math.sqrt(m)).toFixed(1)}`).join(" ");

  return (
    <div className="hrr-ride">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img"
        aria-label="Ten simulated years at the chosen risk level: the same sequence of luck, scaled to the chosen volatility, inside the one-standard-deviation cone of outcomes. At higher volatility a second line separates, showing the average ending pulling above the typical one.">
        <polygon points={cone} fill="var(--color-accent)" opacity={0.13} />
        <path d={linePath(months, (m) => x(m), (m) => y(k * m))}
          fill="none" stroke="var(--color-text-soft)" strokeWidth={1.3} strokeDasharray="5 4" />
        <path d={linePath(months, (m) => x(m), (m) => y(path[m]))}
          fill="none" stroke="var(--color-warn)" strokeWidth={2} strokeLinejoin="round" />
        {/* The average curve, pulling away from the typical one as risk rises. */}
        {meanFade > 0 && (
          <g opacity={meanFade}>
            <path d={linePath(months, (m) => x(m), (m) => y(k * m + drag * m))}
              fill="none" stroke="var(--color-text-soft)" strokeWidth={1.1} strokeDasharray="2 3" />
            <text x={x(RIDE_MONTHS) + 8} y={yAverage + 4} style={{ ...axisText, fill: "var(--color-text-soft)" }}>
              {mult(meanEnd)} average
            </text>
          </g>
        )}
        <text x={x(RIDE_MONTHS) + 8} y={yLucky + 4} style={{ ...axisText, fill: "var(--color-muted)" }}>
          {mult(trendEnd + bandEnd)} lucky
        </text>
        <text x={x(RIDE_MONTHS) + 8} y={yTypical + 4} style={{ ...axisText, fontWeight: 700, fill: "var(--color-text)" }}>
          {mult(trendEnd)} typical
        </text>
        <text x={x(RIDE_MONTHS) + 8} y={yUnlucky + 4} style={{ ...axisText, fill: "var(--color-muted)" }}>
          {mult(trendEnd - bandEnd)} unlucky
        </text>
        <text x={pad.left} y={H - 6} style={{ ...axisText, fill: "var(--color-text-soft)", fontWeight: 600 }}>
          The ride behind that average: ten simulated years of $1 at your setting →
        </text>
      </svg>
      <div className="hrr-roll">
        {/* Functional updaters: React batches, so reading `seed` from the closure
            would make two fast clicks land on the same decade. */}
        <button type="button" onClick={() => { setSeed(nextSeed); setRolls((n) => n + 1); }}>
          ↻ New decade
        </button>
        <span aria-live="polite">
          {rolls === 0
            ? "Same market, different luck."
            : `Decade ${rolls + 1} — same market, different luck. Ending: ${mult(path[RIDE_MONTHS])}.`}
        </span>
      </div>
      <p className="hrr-note">
        The luck holds still while you drag, and only changes when you roll. The solid line is
        one possible decade; the cone is the ±1σ range of destinations. Where the cone is a thread,
        the ride is smooth and the endings agree. Where it's a funnel, the slope is real but so is
        the spread. Push the slider up and a second line splits off: volatility drags the{" "}
        <strong>typical</strong> decade below the <strong>average</strong> one, because a big loss
        needs a bigger gain to undo it. Both are true at once — an illustration, not a forecast.
      </p>
    </div>
  );
}
const pct = (x: number, dp = 0) => `${(x * 100).toFixed(dp)}%`;
const SPAN = `${assetStats.span[0]}–${assetStats.span[1]}`;

export default function HeroRiskReturn() {
  const [risk, setRisk] = useState(0.15);
  const expected = FIT.a + FIT.b * risk;

  const W = 620, H = 300;
  const pad = { top: 20, right: 20, bottom: 42, left: 62 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  // Must clear small-cap value (38% vol, 17.8% return) or it lands off-canvas.
  const xMax = 0.44, yMax = 0.20;
  const x = (v: number) => pad.left + (v / xMax) * plotW;
  const y = (v: number) => pad.top + plotH - (v / yMax) * plotH;

  return (
    <div className="hrr">
      <svg viewBox={`0 0 ${W} ${H}`} className="hrr-chart" role="img"
        aria-label="Real US asset classes plotted by risk and return: higher volatility has come with higher return.">
        {[0, 0.04, 0.08, 0.12, 0.16, 0.2].map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
            <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{pct(v)}</text>
          </g>
        ))}
        {/* y-axis title, rotated up the left edge */}
        <text
          transform={`rotate(-90 14 ${pad.top + plotH / 2}) translate(14 ${pad.top + plotH / 2})`}
          textAnchor="middle"
          style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)" }}
        >
          Average annual return
        </text>
        {/* the risk/return line the dots sit on */}
        <line x1={x(LO)} y1={y(FIT.a + FIT.b * LO)} x2={x(HI)} y2={y(FIT.a + FIT.b * HI)}
          stroke="var(--color-text-soft)" strokeWidth={1.5} strokeDasharray="5 4" />
        {DOTS.map((d) => {
          const right = d.place === "right";
          return (
            <g key={d.label}>
              <circle cx={x(d.sigma)} cy={y(d.mu)} r={5.5} fill="var(--color-accent)" />
              <text
                x={x(d.sigma) + (right ? 10 : 0)}
                y={y(d.mu) + (right ? 4 : -12)}
                textAnchor={right ? "start" : "middle"}
                style={{ ...axisText, fill: "var(--color-text-soft)", fontWeight: 600 }}
              >
                {d.label}
              </text>
            </g>
          );
        })}
        {/* the reader's chosen risk level */}
        <line x1={x(risk)} x2={x(risk)} y1={pad.top} y2={pad.top + plotH}
          stroke="var(--color-warn)" strokeWidth={1.4} strokeDasharray="3 3" />
        <circle cx={x(risk)} cy={y(expected)} r={8} fill="none" stroke="var(--color-warn)" strokeWidth={2.5} />
        <text x={pad.left + plotW / 2} y={H - 8} textAnchor="middle"
          style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)" }}>
          “Risk” (volatility — how much it bounced around) →
        </text>
      </svg>

      <div className="hrr-controls">
        <label className="hrr-slider">
          <span>How much volatility can you take? <strong>{pct(risk)}</strong></span>
          <input type="range" min={LO} max={HI} step={0.005} value={risk}
            aria-label="Risk level" onChange={(e) => setRisk(+e.target.value)} />
        </label>
        <p className="hrr-readout">
          Over {SPAN}, that much risk averaged about{" "}
          <strong>{pct(expected, 1)}/yr</strong> — through single years anywhere
          from about <strong>{pct(expected - 2 * risk, 0)}</strong> to{" "}
          <strong>+{pct(expected + 2 * risk, 0)}</strong>.
        </p>
        <p className="hrr-note">
          Real US asset classes, {SPAN}. Volatility is the <strong>standard
          deviation</strong> of annual returns; return is their average, and the
          range above is the ride that average hides — the slope only pays if
          you can sit through the left end of it. One more honesty note: this is
          the US, the century's best-performing major market, so treat these as
          upper bounds, <a href="/tools/global#us-vs-world">not entitlements</a>.{" "}
          <a href="/tools/factors">Open the full tool →</a>
        </p>
      </div>

      <RideInset risk={risk} mu={expected} />
    </div>
  );
}
