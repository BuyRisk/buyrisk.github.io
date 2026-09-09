/**
 * The CAPM data-generating process, shown as paths instead of a scatter.
 *
 * CapmLab simulates each period's returns as a = α + β·m + ε and plots the
 * (m, a) pairs as a cloud with a regression line through it. That shows
 * that β is a slope. It cannot show what β feels like to live through, so
 * this panel takes the SAME sample and cumulates it into three strips
 * sharing one clock:
 *
 *   1. the stock's walk, with the market's walk behind it for comparison;
 *   2. β × the market's walk: the part CAPM pays for;
 *   3. the stock's own jitter (α + ε): the part it does not.
 *
 * Strip 1 is strips 2 and 3 added together. Dragging β scales strip 2 and
 * leaves strip 3 alone; at β = 0 strip 2 flatlines and the stock's whole
 * ride is unpaid; below zero it mirrors the market. Diversification is what
 * averages strip 3 away across many stocks while leaving strip 2 intact.
 *
 * Scaling: the scatter treats each sample point as one period with annual
 * magnitudes. Paths read those points as months, so drifts are divided by
 * 12 and noise by √12 to keep a year of path consistent with a year of
 * scatter.
 */

type Point = { m: number; a: number };

const SQ12 = Math.sqrt(12);
const signedPct = (x: number, dp = 0) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(dp)}%`;

export default function CapmPaths({
  sample,
  beta,
  alpha,
  premium,
}: {
  sample: Point[];
  beta: number;
  alpha: number;
  /** Market risk premium per year; the market's drift above cash. */
  premium: number;
}) {
  const n = sample.length;
  const market: number[] = [0];
  const paid: number[] = [0];
  const own: number[] = [0];
  const stock: number[] = [0];
  for (const p of sample) {
    const mExc = premium / 12 + p.m / SQ12; // market excess return this month
    const eps = (p.a - alpha - beta * p.m) / SQ12; // the idiosyncratic draw
    const ownStep = alpha / 12 + eps;
    market.push(market[market.length - 1] + mExc);
    paid.push(paid[paid.length - 1] + beta * mExc);
    own.push(own[own.length - 1] + ownStep);
    stock.push(stock[stock.length - 1] + beta * mExc + ownStep);
  }

  const width = 440;
  // Each strip gets a title band above it, so a path that runs high never
  // collides with the words.
  const rowH = 84;
  const titleH = 22;
  const gap = 10;
  const pad = { top: 4, right: 62, bottom: 30, left: 44 };
  const height = pad.top + 3 * (titleH + rowH) + 2 * gap + pad.bottom;
  const plotW = width - pad.left - pad.right;

  const R = Math.max(0.05, ...[market, paid, own, stock].flat().map(Math.abs)) * 1.1;
  const x = (i: number) => pad.left + (i / n) * plotW;
  const rowTop = (r: number) => pad.top + titleH + r * (titleH + rowH + gap);
  const y = (r: number, v: number) => rowTop(r) + rowH / 2 - (v / R) * (rowH / 2);
  const path = (r: number, s: number[]) => s.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(r, v).toFixed(1)}`).join(" ");

  const rows: { title: string; series: { s: number[]; stroke: string; w: number; dash?: string }[]; end: number }[] = [
    {
      title: "The stock — and the market behind it",
      series: [
        { s: market, stroke: "var(--color-muted)", w: 1.4, dash: "4 3" },
        { s: stock, stroke: "var(--color-accent)", w: 2.2 },
      ],
      end: stock[n],
    },
    {
      title: `β × market — the part you're paid for (β = ${beta.toFixed(2)})`,
      series: [{ s: paid, stroke: "var(--pl-c1)", w: 2 }],
      end: paid[n],
    },
    {
      title: "Own jitter (α + ε) — the part you're not",
      series: [{ s: own, stroke: "var(--color-warn)", w: 2 }],
      end: own[n],
    },
  ];

  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 13 } as const;
  const years = n / 12;

  const lesson =
    Math.abs(beta) < 0.025
      ? "With β = 0 the middle strip is flat: this stock's whole ride is jitter, and CAPM pays for none of it. Its expected return is the risk-free rate, however wild the top strip looks."
      : beta < 0
        ? "With β below zero the paid strip mirrors the market: the stock zigs when the market zags. CAPM says it earns less than cash — insurance is something you pay for, not something you're paid for."
        : "Drag β: the middle strip is the market's walk scaled by β, the only part CAPM pays for. The bottom strip is what owning many stocks would average away. The top strip is the only one you ever see on a price chart.";

  return (
    <div className="cl-panel">
      <h3>The same returns, as paths</h3>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Three stacked cumulative-return paths over the same months: the stock against the market, beta times the market, and the stock's own idiosyncratic component">
        {rows.map((row, r) => (
          <g key={r}>
            <rect x={pad.left} y={rowTop(r)} width={plotW} height={rowH} fill="var(--color-surface-alt)" opacity={0.5} rx={4} />
            <line x1={pad.left} x2={pad.left + plotW} y1={y(r, 0)} y2={y(r, 0)} stroke="var(--color-border)" />
            {row.series.map((se, k) => (
              <path key={k} d={path(r, se.s)} fill="none" stroke={se.stroke} strokeWidth={se.w} strokeDasharray={se.dash} strokeLinejoin="round" />
            ))}
            <text x={pad.left} y={rowTop(r) - 7} style={{ ...axisText, fontSize: 14, fontWeight: 600, fill: "var(--color-text-soft)" }}>
              {row.title}
            </text>
            <text x={pad.left + plotW + 6} y={y(r, row.end) + 4} style={{ ...axisText, fontSize: 15, fontWeight: 700, fill: row.series[row.series.length - 1].stroke, fontVariantNumeric: "tabular-nums" }}>
              {signedPct(row.end)}
            </text>
            <text x={pad.left - 6} y={y(r, 0) + 4} textAnchor="end" style={axisText}>0</text>
          </g>
        ))}
        <text x={pad.left + plotW / 2} y={height - 8} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 14 }}>
          {n} months ({years % 1 === 0 ? years : years.toFixed(1)} years), cumulative excess return →
        </text>
      </svg>
      <div className="cl-legend">
        <span><span className="cl-key cl-key--fit" /> Stock</span>
        <span><span className="cl-key cl-key--true" /> Market</span>
        <span><span className="cl-key cl-key--paid" /> β × market</span>
        <span><span className="cl-key cl-key--own" /> Own jitter</span>
      </div>
      <p className="wl-fnote">{lesson}</p>
    </div>
  );
}
