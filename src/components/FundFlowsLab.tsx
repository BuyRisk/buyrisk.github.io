import {
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import InfoTip from "./InfoTip";
import {
  NSAR_FLOWS,
  NSAR_FIRST_YEAR,
  NSAR_LAST_YEAR,
  NSAR_PHASE_IN_MONTHS,
  nsarMonthLabel,
} from "../lib/nsarFlows";

/**
 * "Watch the money": the fund industry's own cash register, month by month.
 * Every US open-end mutual fund had to tell the SEC its monthly dollars in
 * (gross sales) and dollars out (redemptions) on Form N-SAR, 1993-2018. Two
 * lessons hide in that ledger. First, the churn: the industry shuffles far
 * more money than it keeps - tens of dollars traded for every net dollar
 * invested, and every shuffled dollar can ring a fee register. Second, the
 * verdict: in 2016, for the first time, more money left these funds than
 * arrived. Educational only, not advice.
 */

type Mode = "gross" | "net";

const N = NSAR_FLOWS.length;
const bn = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(2)} trillion` : `$${Math.round(v).toLocaleString()} billion`;

export default function FundFlowsLab() {
  const [mode, setMode] = useState<Mode>("gross");
  const [hover, setHover] = useState<number | null>(null);

  const view = useMemo(() => {
    let firstNegYear = 0;
    const byYear = new Map<number, { s: number; r: number }>();
    for (let i = 0; i < N; i++) {
      const y = NSAR_FIRST_YEAR + Math.floor(i / 12);
      const a = byYear.get(y) ?? { s: 0, r: 0 };
      a.s += NSAR_FLOWS[i][0];
      a.r += NSAR_FLOWS[i][1];
      byYear.set(y, a);
    }
    for (const [y, a] of byYear) {
      if (!firstNegYear && a.s < a.r) firstNegYear = y;
    }
    // Churn: gross dollars traded per net dollar kept, on the dense years.
    let g = 0;
    let net = 0;
    for (const [y, a] of byYear) {
      if (y >= 1996) {
        g += a.s + a.r;
        net += Math.abs(a.s - a.r);
      }
    }
    const last = byYear.get(NSAR_LAST_YEAR) ?? { s: 0, r: 0 };
    return { firstNegYear, churn: g / net, lastYearGross: last.s + last.r };
  }, []);

  const i = hover ?? N - 1;
  const [hs, hr] = NSAR_FLOWS[i];
  const hnet = hs - hr;

  return (
    <div className="wl">
      <div className="wl-controls">
        <div className="wl-field">
          <span className="wl-field-label">
            View
            <InfoTip text="Gross shows the two raw totals funds reported: all dollars buying in and all dollars cashing out each month. Net is the difference - what the industry actually kept or lost." />
          </span>
          <div className="wl-simmode" role="group" aria-label="Flow view">
            <button
              type="button"
              className={mode === "gross" ? "active" : ""}
              aria-pressed={mode === "gross"}
              onClick={() => setMode("gross")}
            >
              Money in &amp; out
            </button>
            <button
              type="button"
              className={mode === "net" ? "active" : ""}
              aria-pressed={mode === "net"}
              onClick={() => setMode("net")}
            >
              Net flow
            </button>
          </div>
        </div>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          {mode === "gross" ? (
            <>
              <span className="ss-headline-label">The churn: dollars traded per net dollar</span>
              <span className="ss-headline-value">~{Math.round(view.churn)} to 1</span>
              <span className="ss-headline-sub">
                Since 1996 the industry has moved about {Math.round(view.churn)} gross dollars in and
                out for every one dollar of net investment — {bn(view.lastYearGross)} shuffled in{" "}
                {NSAR_LAST_YEAR} alone. Every shuffled dollar is a chance for costs to bite.
              </span>
            </>
          ) : (
            <>
              <span className="ss-headline-label">The verdict</span>
              <span className="ss-headline-value">{view.firstNegYear}: money starts leaving</span>
              <span className="ss-headline-sub">
                After two decades of inflows, {view.firstNegYear} was the first year more money left
                US mutual funds than arrived — the great migration toward cheaper index funds and
                ETFs, visible in the industry's own filings.
              </span>
            </>
          )}
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          <strong>{nsarMonthLabel(i)}:</strong> {bn(hs)} in, {bn(hr)} out, net{" "}
          {hnet < 0 ? "−" : "+"}
          {bn(Math.abs(hnet))}. {hover === null ? "Hover the chart to explore any month." : ""}
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>{mode === "gross" ? "Money in and money out, every month" : "What the industry kept (or lost), every month"}</h3>
          <FlowChart mode={mode} hover={hover} onHover={setHover} />
          <p className="wl-fnote">
            {mode === "gross" ? (
              <>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>Money in</span> (gross
                sales) and <span style={{ color: "var(--pl-c3)", fontWeight: 700 }}>money out</span>{" "}
                (redemptions) of every US open-end mutual fund, in billions of dollars per month. The
                two lines hug each other — that near-overlap IS the churn. Includes money market
                funds, whose cash-parking traffic dominates the totals.
              </>
            ) : (
              <>
                Bars above zero: months the industry took in more than it paid out. Bars{" "}
                <span style={{ color: "var(--pl-c3)", fontWeight: 700 }}>below zero</span>: months
                money left. The long positive era ends around 2015; the blue cluster in 2016 is the
                turn.
              </>
            )}{" "}
            Shaded early years: SEC electronic filing was still phasing in, so totals understate the
            industry.
          </p>
        </div>
      </div>
    </div>
  );
}

function FlowChart({
  mode,
  hover,
  onHover,
}: {
  mode: Mode;
  hover: number | null;
  onHover: (i: number | null) => void;
}) {
  const width = 760;
  const height = 380;
  const pad = { top: 20, right: 16, bottom: 40, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (i / (N - 1)) * plotW;

  const axisText = {
    fill: "var(--color-muted)",
    fontFamily: "var(--font-sans)",
    fontSize: 11,
  } as const;

  const yearTicks: number[] = [];
  for (let y = 1995; y <= NSAR_LAST_YEAR; y += 2) yearTicks.push((y - NSAR_FIRST_YEAR) * 12);

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    const i = Math.round(((px - pad.left) / plotW) * (N - 1));
    onHover(Math.max(0, Math.min(N - 1, i)));
  };

  let body: ReactNode;
  let yGrid: ReactNode;
  if (mode === "gross") {
    const ymax = 3000;
    const y = (v: number) => pad.top + plotH * (1 - v / ymax);
    const path = (k: 0 | 1) =>
      NSAR_FLOWS.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join("");
    yGrid = [0, 1000, 2000, 3000].map((g) => (
      <g key={g}>
        <line x1={pad.left} x2={width - pad.right} y1={y(g)} y2={y(g)} stroke="var(--color-border)" strokeWidth={1} />
        <text x={pad.left - 8} y={y(g) + 4} textAnchor="end" style={axisText}>
          {g.toLocaleString()}
        </text>
      </g>
    ));
    body = (
      <>
        <path d={path(1)} fill="none" stroke="var(--pl-c3)" strokeWidth={2} strokeLinejoin="round" />
        <path d={path(0)} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && (
          <>
            <circle cx={x(hover)} cy={y(NSAR_FLOWS[hover][0])} r={4} fill="var(--color-accent)" />
            <circle cx={x(hover)} cy={y(NSAR_FLOWS[hover][1])} r={4} fill="var(--pl-c3)" />
          </>
        )}
      </>
    );
  } else {
    const lo = -200;
    const hi = 450;
    const y = (v: number) => pad.top + (plotH * (hi - v)) / (hi - lo);
    const bw = Math.max(1.4, plotW / N - 0.8);
    yGrid = [-200, 0, 200, 400].map((g) => (
      <g key={g}>
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={y(g)}
          y2={y(g)}
          stroke={g === 0 ? "var(--color-muted)" : "var(--color-border)"}
          strokeWidth={1}
        />
        <text x={pad.left - 8} y={y(g) + 4} textAnchor="end" style={axisText}>
          {g > 0 ? `+${g}` : g}
        </text>
      </g>
    ));
    body = (
      <>
        {NSAR_FLOWS.map((d, i) => {
          const v = Math.max(lo, Math.min(hi, d[0] - d[1]));
          return (
            <rect
              key={i}
              x={x(i) - bw / 2}
              y={Math.min(y(0), y(v))}
              width={bw}
              height={Math.max(0.5, Math.abs(y(v) - y(0)))}
              fill={v >= 0 ? "var(--color-accent)" : "var(--pl-c3)"}
              opacity={hover === null || hover === i ? 0.95 : 0.55}
            />
          );
        })}
      </>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "auto", display: "block", touchAction: "none" }}
      role="img"
      aria-label={
        mode === "gross"
          ? "Monthly gross sales and redemptions of US open-end mutual funds, 1993 to 2017"
          : "Monthly net flow of US open-end mutual funds, 1993 to 2017"
      }
      onPointerMove={onMove}
      onPointerLeave={() => onHover(null)}
    >
      {/* EDGAR phase-in band */}
      <rect
        x={x(0)}
        y={pad.top}
        width={x(NSAR_PHASE_IN_MONTHS) - x(0)}
        height={plotH}
        fill="var(--color-text)"
        opacity={0.06}
      />
      {yGrid}
      {yearTicks.map((i) => (
        <text key={i} x={x(i)} y={height - pad.bottom + 18} textAnchor="middle" style={axisText}>
          {NSAR_FIRST_YEAR + Math.floor(i / 12)}
        </text>
      ))}
      {body}
      {hover !== null && (
        <line
          x1={x(hover)}
          x2={x(hover)}
          y1={pad.top}
          y2={pad.top + plotH}
          stroke="var(--color-text)"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.5}
        />
      )}
      <text
        x={pad.left + plotW / 2}
        y={height - 6}
        textAnchor="middle"
        style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}
      >
        US$ billions per month, all open-end funds · SEC Form N-SAR Item 28
      </text>
    </svg>
  );
}
