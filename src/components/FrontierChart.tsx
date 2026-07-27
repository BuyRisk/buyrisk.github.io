import { useId } from "react";
import { sharpe, type PortfolioPoint } from "../lib/portfolio";

/**
 * Shared efficient-frontier scatter/curve. Self-contained (all styling via
 * inline CSS variables) so it can drop into any tool page without extra CSS.
 * The Capital Market Line is optional — pass `riskFree` + `tangency` to show it.
 */

type XY = { vol: number; mu: number };

const paletteColor = (i: number) => `var(--pl-c${(i % 8) + 1})`;
const pctLabel = (x: number) => `${(x * 100).toFixed(0)}%`;

export default function FrontierChart({
  cloud,
  frontier,
  assetPoints,
  minVar,
  current,
  riskFree,
  tangency,
  ariaLabel = "Efficient frontier: portfolios plotted by risk and expected return",
}: {
  cloud: PortfolioPoint[];
  frontier: XY[];
  assetPoints: XY[];
  minVar: XY;
  current: XY;
  riskFree?: number;
  tangency?: XY;
  ariaLabel?: string;
}) {
  const clipId = useId();
  const showCml = riskFree != null && tangency != null;
  const rf = riskFree ?? 0;

  const width = 520;
  const height = 360;
  const pad = { top: 18, right: 18, bottom: 44, left: 54 };

  const vols = cloud.map((p) => p.vol).concat(assetPoints.map((a) => a.vol), current.vol);
  const rets = cloud
    .map((p) => p.mu)
    .concat(assetPoints.map((a) => a.mu), current.mu, showCml ? [rf] : []);
  const maxVol = Math.max(...vols, 0.01) * 1.1;
  const minRet = Math.min(...rets, 0);
  const maxRet = Math.max(...rets, 0.01) * 1.08;

  const x = (v: number) => pad.left + (v / maxVol) * (width - pad.left - pad.right);
  const y = (r: number) =>
    height - pad.bottom - ((r - minRet) / (maxRet - minRet)) * (height - pad.top - pad.bottom);

  const bestSharpe = Math.max(...cloud.map((p) => sharpe(p.mu, p.vol, rf)), 0.001);
  const frontierPath = frontier.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.vol)},${y(p.mu)}`).join(" ");
  const cmlEndR = showCml ? rf + sharpe(tangency!.mu, tangency!.vol, rf) * maxVol : 0;

  const axisText = {
    fill: "var(--color-muted)",
    fontFamily: "var(--font-sans)",
    fontSize: 11,
  } as const;
  const titleText = {
    fill: "var(--color-text-soft)",
    fontFamily: "var(--font-sans)",
    fontSize: 12,
    fontWeight: 600,
  } as const;
  const markerStroke = { stroke: "var(--color-surface)", strokeWidth: 2 } as const;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={pad.left}
            y={pad.top}
            width={width - pad.left - pad.right}
            height={height - pad.top - pad.bottom}
          />
        </clipPath>
      </defs>

      {Array.from({ length: 6 }, (_, i) => {
        const r = minRet + ((maxRet - minRet) / 5) * i;
        return (
          <g key={`y${i}`}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(r)}
              y2={y(r)}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text x={pad.left - 8} y={y(r) + 4} textAnchor="end" style={axisText}>
              {pctLabel(r)}
            </text>
          </g>
        );
      })}
      {Array.from({ length: 6 }, (_, i) => {
        const v = (maxVol / 5) * i;
        return (
          <text key={`x${i}`} x={x(v)} y={height - pad.bottom + 18} textAnchor="middle" style={axisText}>
            {pctLabel(v)}
          </text>
        );
      })}

      {/* Random portfolios, tinted by Sharpe ratio */}
      {cloud.map((p, i) => (
        <circle
          key={i}
          cx={x(p.vol)}
          cy={y(p.mu)}
          r={2}
          fill="var(--color-accent)"
          opacity={0.12 + 0.55 * Math.max(0, sharpe(p.mu, p.vol, rf) / bestSharpe)}
        />
      ))}

      <g clipPath={`url(#${clipId})`}>
        {showCml && (
          <line
            x1={x(0)}
            y1={y(rf)}
            x2={x(maxVol)}
            y2={y(cmlEndR)}
            stroke="var(--color-text)"
            strokeWidth={2}
            strokeDasharray="6 4"
            opacity={0.75}
          />
        )}
        {frontier.length > 1 && (
          <path d={frontierPath} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} strokeLinejoin="round" />
        )}
      </g>

      {showCml && (
        <>
          <circle cx={x(0)} cy={y(rf)} r={4} fill="var(--color-text-soft)" {...markerStroke} />
          <text x={x(0) + 8} y={y(rf) - 6} style={{ ...titleText, fontSize: 11 }}>rf</text>
        </>
      )}

      {/* Individual asset endpoints */}
      {assetPoints.map((a, i) => (
        <circle key={i} cx={x(a.vol)} cy={y(a.mu)} r={5} fill={paletteColor(i)} stroke="var(--color-surface)" strokeWidth={1.5} />
      ))}

      {/* Minimum-variance + optional tangency */}
      <circle cx={x(minVar.vol)} cy={y(minVar.mu)} r={6} fill="var(--color-link)" {...markerStroke} />
      {showCml && (
        <circle cx={x(tangency!.vol)} cy={y(tangency!.mu)} r={6} fill="var(--color-warn)" {...markerStroke} />
      )}

      {/* Current portfolio */}
      <circle cx={x(current.vol)} cy={y(current.mu)} r={8} fill="var(--color-accent)" {...markerStroke} />
      <circle cx={x(current.vol)} cy={y(current.mu)} r={13} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} opacity={0.5} />

      <text x={width / 2} y={height - 6} textAnchor="middle" style={titleText}>
        Risk — volatility →
      </text>
      <text x={-height / 2} y={15} textAnchor="middle" transform="rotate(-90)" style={titleText}>
        Expected return →
      </text>
    </svg>
  );
}
