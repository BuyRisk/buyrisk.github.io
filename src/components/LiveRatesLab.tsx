import { useEffect, useMemo, useState } from "react";

/**
 * "Live Treasury Rates" — the one Info page that must be current, so it fetches
 * the daily US Treasury par yield curve straight from Treasury's public CSV feed
 * in the reader's browser (no API key, CORS-enabled). If the fetch fails for any
 * reason (offline, feed down, a browser blocking it), it falls back to the
 * static monthly snapshot baked into the repo, clearly labelled — the page is
 * never wrong, only sometimes a little stale.
 *
 * Treasury publishes the "Constant Maturity Treasury" (CMT) par yields near
 * 3:30pm each trading day. Educational only, not advice.
 */

type Pt = { label: string; years: number; yield: number };
type Fallback = { asOf: string; curve: Pt[] };

// Maturities we plot, and their position on the (log) time axis.
const WANT: [string, number][] = [
  ["1 Mo", 1 / 12], ["3 Mo", 0.25], ["6 Mo", 0.5], ["1 Yr", 1], ["2 Yr", 2],
  ["3 Yr", 3], ["5 Yr", 5], ["7 Yr", 7], ["10 Yr", 10], ["20 Yr", 20], ["30 Yr", 30],
];

const csvUrl = (year: number) =>
  `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&_format=csv`;

/** Parse the most recent data row of the daily-yield-curve CSV into a curve. */
function parseCsv(text: string): { date: string; curve: Pt[] } | null {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const header = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
  const cells = lines[1].split(","); // rows are sorted newest-first
  const date = cells[0]?.replace(/"/g, "").trim();
  if (!date) return null;
  const curve: Pt[] = [];
  for (const [label, years] of WANT) {
    const i = header.indexOf(label);
    if (i < 0) continue;
    const v = parseFloat(cells[i]);
    if (Number.isFinite(v)) curve.push({ label, years, yield: v });
  }
  return curve.length >= 5 ? { date, curve } : null;
}

async function fetchCurve(): Promise<{ date: string; curve: Pt[] } | null> {
  const now = new Date();
  // Try this year; early in January it may be empty, so fall back to last year.
  for (const year of [now.getFullYear(), now.getFullYear() - 1]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(csvUrl(year), { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const parsed = parseCsv(await res.text());
      if (parsed) return parsed;
    } catch {
      /* try next / fall back */
    }
  }
  return null;
}

const fmtLive = (mmddyyyy: string) => {
  const [m, d, y] = mmddyyyy.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
};
const fmtSnap = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const p = (x: number, dp = 2) => `${x.toFixed(dp)}%`;

export default function LiveRatesLab({ fallback }: { fallback: Fallback }) {
  const [state, setState] = useState<{ status: "loading" | "live" | "snapshot"; date: string; curve: Pt[] }>(
    { status: "loading", date: fallback.asOf, curve: fallback.curve },
  );

  useEffect(() => {
    let alive = true;
    fetchCurve().then((r) => {
      if (!alive) return;
      if (r) setState({ status: "live", date: r.date, curve: r.curve });
      else setState({ status: "snapshot", date: fallback.asOf, curve: fallback.curve });
    });
    return () => { alive = false; };
  }, []);

  const { status, curve } = state;
  const get = (label: string) => curve.find((c) => c.label === label)?.yield;
  const y2 = get("2 Yr"), y10 = get("10 Yr"), y3m = get("3 Mo"), y30 = get("30 Yr");
  const spread = y10 != null && y2 != null ? y10 - y2 : undefined;
  const inverted = spread != null && spread < 0;
  const dateLabel = status === "live" ? fmtLive(state.date) : fmtSnap(state.date);
  const maxY = useMemo(() => Math.max(...curve.map((c) => c.yield)) * 1.12, [curve]);

  const keyCards: { v?: number; label: string }[] = [
    { v: y3m, label: "3-month bill" },
    { v: y2, label: "2-year note" },
    { v: y10, label: "10-year note — the headline benchmark" },
    { v: y30, label: "30-year bond" },
  ];

  return (
    <div className="lr">
      <div className={`lr-status lr-status--${status}`} role="status">
        {status === "loading" && <>Fetching today's rates from the U.S. Treasury…</>}
        {status === "live" && <><span className="lr-dot" aria-hidden="true" /> Live · Treasury par yields as of <strong>{dateLabel}</strong></>}
        {status === "snapshot" && <>Live feed unavailable — showing the repo's monthly snapshot as of <strong>{dateLabel}</strong></>}
      </div>

      <ul className="ref-stats" style={{ marginTop: "var(--space-md)" }}>
        {keyCards.map((c) => (
          <li className="ref-stat" key={c.label}>
            <span className="ref-stat-value">{c.v != null ? p(c.v) : "—"}</span>
            <span className="ref-stat-label">{c.label}</span>
          </li>
        ))}
      </ul>

      {spread != null && (
        <div className="ref-callout" style={{ marginTop: "var(--space-md)" }}>
          <p>
            <strong>2s10s spread: {spread >= 0 ? "+" : "−"}{Math.abs(spread).toFixed(2)}%.</strong>{" "}
            {inverted
              ? "The curve is inverted — short rates above long. An inversion has preceded most US recessions, though the timing is loose."
              : "The curve is upward-sloping (longer maturities yield more), the normal, healthy shape."}
          </p>
        </div>
      )}

      <div className="lr-chartwrap">
        <CurveChart curve={curve} maxY={maxY} />
      </div>

      <div className="ref-tablewrap" style={{ marginTop: "var(--space-md)" }}>
        <table className="ref-table">
          <thead>
            <tr><th scope="col">Maturity</th><th scope="col" className="num">Yield</th><th scope="col">&nbsp;</th></tr>
          </thead>
          <tbody>
            {curve.map((pt) => (
              <tr key={pt.label}>
                <td className="strong">{pt.label}</td>
                <td className="num">{p(pt.yield)}</td>
                <td>
                  <span className="ref-track" aria-hidden="true">
                    <span className="ref-fill" style={{ width: `${(pt.yield / maxY) * 100}%`, background: "var(--pl-c3)" }} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CurveChart({ curve, maxY }: { curve: Pt[]; maxY: number }) {
  const width = 760, height = 340;
  const pad = { top: 20, right: 24, bottom: 44, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  if (curve.length < 2) return null;
  const yMax = Math.ceil(maxY);
  const xs = curve.map((c) => Math.log(c.years + 0.4));
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const x = (i: number) => pad.left + ((xs[i] - xMin) / (xMax - xMin)) * plotW;
  const y = (v: number) => pad.top + plotH - (v / yMax) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const line = curve.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c.yield).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Current US Treasury yield curve">
      {Array.from({ length: yMax + 1 }, (_, k) => k).map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{v}%</text>
        </g>
      ))}
      <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2.8} strokeLinejoin="round" />
      {curve.map((c, i) => (
        <g key={c.label}>
          <circle cx={x(i)} cy={y(c.yield)} r={3.5} fill="var(--color-accent)" />
          {["3 Mo", "2 Yr", "10 Yr", "30 Yr"].includes(c.label) && (
            <text x={x(i)} y={y(c.yield) - 9} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 700 }}>{c.yield.toFixed(2)}</text>
          )}
          <text x={x(i)} y={height - pad.bottom + 18} textAnchor="middle" style={axisText}>{c.label}</text>
        </g>
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Maturity → yield (% per year)
      </text>
    </svg>
  );
}
