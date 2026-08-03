import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { GLOBAL_MARKET_CAP } from "../data/global-market-cap";

/**
 * "Home Bias: How Much of the World Do You Own?" — the counterweight to the
 * US-specific tools, and a core piece of the global-investing push.
 *
 * A market-cap-weighted global investor holds each country in proportion to its
 * size. Almost nobody does: we pile into our home market far beyond its weight
 * in the world (home bias). This tool lets a reader anywhere pick their home
 * market and see (a) how small a slice of the world it really is, and (b) what
 * their chosen home tilt does to that split — with the honest caveat that
 * leadership rotates between countries and nobody can predict the next winner.
 *
 * US weight comes from the same FTSE-anchored data as /info/global-market-cap;
 * the other country weights are approximate shares of the global index (VT /
 * FTSE Global All Cap), for illustration. Educational only, not advice.
 */

const US_WEIGHT = GLOBAL_MARKET_CAP.regions.find((r) => r.key === "us")!.ofGlobal; // 62.2, kept in sync with the data

type Market = { name: string; weight: number };
// Approximate share of the whole investable world, by home market (VT / FTSE
// Global All Cap, ~2026). Illustrative — the lesson is the size, not the decimal.
const MARKETS: Market[] = [
  { name: "United States", weight: US_WEIGHT },
  { name: "Japan", weight: 5.3 },
  { name: "United Kingdom", weight: 3.4 },
  { name: "China", weight: 2.9 },
  { name: "Canada", weight: 2.7 },
  { name: "France", weight: 2.3 },
  { name: "India", weight: 2.2 },
  { name: "Switzerland", weight: 2.1 },
  { name: "Germany", weight: 2.0 },
  { name: "Taiwan", weight: 1.9 },
  { name: "Australia", weight: 1.7 },
  { name: "A smaller market (≈1% of the world)", weight: 1.0 },
];

const round = (n: number, dp = 0) => n.toFixed(dp);

export default function HomeBiasLab() {
  const [homeName, setHomeName] = useState("United States");
  const [tilt, setTilt] = useState(0); // 0 = pure market weight, 100 = all home

  const home = MARKETS.find((m) => m.name === homeName)!;
  const calc = useMemo(() => {
    const w = home.weight;
    const homeAlloc = w + (tilt / 100) * (100 - w);
    const intlAlloc = 100 - homeAlloc;
    const marketIntl = 100 - w;
    const overweight = homeAlloc - w;
    return { w, homeAlloc, intlAlloc, marketIntl, overweight };
  }, [home, tilt]);

  const reset = () => { setHomeName("United States"); setTilt(0); };
  const shortHome = home.name.replace(/ \(.*\)/, "");

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />

        <div className="wl-field">
          <span className="wl-field-label">
            Where do you invest from?
            <InfoTip text="Your home stock market. A globally diversified investor holds it at its share of the world; most people hold far more (home bias)." />
          </span>
          <select className="wl-select" value={homeName} onChange={(e) => { setHomeName(e.target.value); }}>
            {MARKETS.map((m) => (
              <option key={m.name} value={m.name}>{m.name} — {round(m.weight, m.weight < 10 ? 1 : 0)}% of the world</option>
            ))}
          </select>
        </div>

        <label className="wl-slider">
          <span>
            Tilt toward home
            <InfoTip text="0% is the neutral, market-cap weight — your home at its true size in the world. 100% is an all-home portfolio. Slide to see your home bias." />{" "}
            <strong>{tilt}%</strong>
          </span>
          <input type="range" min={0} max={100} step={5} value={tilt} onChange={(e) => setTilt(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">At global market weight, {shortHome} is only</span>
          <span className="ss-headline-value">{round(calc.w, calc.w < 10 ? 1 : 0)}%</span>
          <span className="ss-headline-sub">
            of the world's stocks — the other <strong>{round(calc.marketIntl, calc.marketIntl < 10 ? 1 : 0)}%</strong> is abroad
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          Wherever you live, this tool is the same — no country is the whole market. US weight tracks the FTSE-anchored
          data behind our market-cap page; other weights are approximate world shares (VT / FTSE Global All Cap).
          Educational only, not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>Your portfolio vs. the whole world</h3>
          <SplitBars homeName={shortHome} w={calc.w} homeAlloc={calc.homeAlloc} />
          <div className="wl-flegend">
            <span><span className="wl-fdot" style={{ background: "var(--color-accent)" }} /> {shortHome} (home)</span>
            <span><span className="wl-fdot" style={{ background: "var(--color-link)" }} /> Rest of the world</span>
          </div>
          <p className="wl-fnote">
            The top bar is a market-cap-weighted global portfolio (what a single fund like VT holds). The bottom bar is
            yours at a {tilt}% home tilt. The gap between the two green slices is your home bias.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>Your home allocation</dt><dd>{round(calc.homeAlloc)}%</dd></div>
              <div><dt>Your international</dt><dd>{round(calc.intlAlloc)}%</dd></div>
              <div><dt>Market weight for home</dt><dd>{round(calc.w, calc.w < 10 ? 1 : 0)}%</dd></div>
              <div><dt>Overweight home by</dt><dd>{calc.overweight <= 0.05 ? "—" : `+${round(calc.overweight)} pts`}</dd></div>
            </dl>
            <p className="wl-saved">
              {calc.overweight <= 0.05 ? (
                <>You're at <strong>global market weight</strong> — humble and hard to argue with, since it makes no bet on which country wins next. </>
              ) : (
                <>You're overweight {shortHome} by <strong>{round(calc.overweight)} points</strong> versus its size in the world. </>
              )}
              Some home tilt is normal and defensible — you spend in your home currency, and home stocks can carry lower
              costs and friendlier taxes. But a <em>big</em> tilt is a concentrated bet, and the catch is that{" "}
              <strong>leadership rotates</strong>: the US led the 2010s, international led the 2000s, Japan dominated then
              collapsed. Nobody reliably calls the next decade's winner, which is exactly why owning the whole world in
              proportion is the humble default. Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SplitBars({ homeName, w, homeAlloc }: { homeName: string; w: number; homeAlloc: number }) {
  const width = 760, height = 300;
  const pad = { top: 40, right: 18, bottom: 30, left: 110 };
  const plotW = width - pad.left - pad.right;
  const rowH = 54, gap = 46;
  const rows = [
    { label: "Global market weight", home: w, y: pad.top },
    { label: "Your portfolio", home: homeAlloc, y: pad.top + rowH + gap },
  ];
  const x = (p: number) => (p / 100) * plotW;
  const axisText = { fontFamily: "var(--font-sans)", fontSize: 12 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={`${homeName} vs. rest of world, market weight vs. your portfolio`}>
      {rows.map((r) => (
        <g key={r.label}>
          <text x={pad.left - 10} y={r.y + rowH / 2 + 4} textAnchor="end" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 600 }}>{r.label}</text>
          {/* home slice */}
          <rect x={pad.left} y={r.y} width={Math.max(0, x(r.home))} height={rowH} fill="var(--color-accent)" rx={2} />
          {/* international slice */}
          <rect x={pad.left + x(r.home)} y={r.y} width={Math.max(0, plotW - x(r.home))} height={rowH} fill="var(--color-link)" rx={2} />
          {/* labels inside/over slices */}
          <text x={pad.left + x(r.home) / 2} y={r.y + rowH / 2 + 4} textAnchor="middle" style={{ ...axisText, fill: "var(--color-surface)", fontWeight: 700 }}>
            {r.home >= 12 ? `${r.home.toFixed(0)}%` : ""}
          </text>
          <text x={pad.left + x(r.home) + (plotW - x(r.home)) / 2} y={r.y + rowH / 2 + 4} textAnchor="middle" style={{ ...axisText, fill: "var(--color-surface)", fontWeight: 700 }}>
            {(100 - r.home) >= 12 ? `${(100 - r.home).toFixed(0)}%` : ""}
          </text>
        </g>
      ))}
      {/* header labels */}
      <text x={pad.left} y={pad.top - 12} style={{ ...axisText, fill: "var(--color-accent)", fontWeight: 700, fontSize: 13 }}>{homeName}</text>
      <text x={pad.left + plotW} y={pad.top - 12} textAnchor="end" style={{ ...axisText, fill: "var(--color-link)", fontWeight: 700, fontSize: 13 }}>Rest of the world</text>
    </svg>
  );
}
