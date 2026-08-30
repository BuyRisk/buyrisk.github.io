import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { currencySymbol, useCurrencyCode } from "../lib/currency";

/**
 * "Options Pricing, Demystified" — build intuition for what an option is
 * actually worth, from three levers: strike, time, and volatility.
 *
 *  • "Value & payoff": the classic hockey-stick payoff-at-expiration, plus the
 *    smooth Black–Scholes value TODAY sitting above it. The gap between them is
 *    time value — everything you pay beyond what the option is worth if it
 *    expired right now. Break-even, strike, and today's spot are all marked.
 *  • "Time & volatility": the two levers that make an option worth more. Hold
 *    everything else fixed and watch the premium rise with more time to expiry
 *    and with more volatility — the whole reason an option costs anything.
 *
 * Pure Black–Scholes (European, no dividends). Educational only, not advice.
 */

const DEFAULTS = { kind: "call" as "call" | "put", spot: 100, strike: 105, months: 6, vol: 30, rate: 4 };

/** Standard normal CDF via an Abramowitz–Stegun erf approximation. */
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-(x * x) / 2);
  const p =
    d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

type Greeks = { price: number; delta: number; intrinsic: number; timeValue: number; breakeven: number };

/** Black–Scholes price + delta for a European call/put on a non-dividend stock. */
function blackScholes(kind: "call" | "put", S: number, K: number, T: number, sigma: number, r: number): Greeks {
  const intrinsic = Math.max(kind === "call" ? S - K : K - S, 0);
  // Degenerate: no time or no vol → worth exactly its discounted intrinsic value.
  if (T <= 0 || sigma <= 0 || S <= 0) {
    const disc = kind === "call" ? Math.max(S - K * Math.exp(-r * T), 0) : Math.max(K * Math.exp(-r * T) - S, 0);
    const price = Math.max(disc, 0);
    return { price, delta: kind === "call" ? (S > K ? 1 : 0) : S < K ? -1 : 0, intrinsic, timeValue: price - intrinsic, breakeven: kind === "call" ? K : K, };
  }
  const vsT = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / vsT;
  const d2 = d1 - vsT;
  const price =
    kind === "call"
      ? S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2)
      : K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
  const delta = kind === "call" ? normCdf(d1) : normCdf(d1) - 1;
  const breakeven = kind === "call" ? K + price : K - price;
  return { price, delta, intrinsic, timeValue: price - intrinsic, breakeven };
}

export default function OptionsLab() {
  const code = useCurrencyCode();
  const sym = currencySymbol(code);
  const money = (n: number, dp = 2) => `${n < 0 ? "−" : ""}${sym}${Math.abs(n).toFixed(dp)}`;

  const [kind, setKind] = useState(DEFAULTS.kind);
  const [mode, setMode] = useState<"payoff" | "levers">("payoff");
  const [spot, setSpot] = useState(DEFAULTS.spot);
  const [strike, setStrike] = useState(DEFAULTS.strike);
  const [months, setMonths] = useState(DEFAULTS.months);
  const [vol, setVol] = useState(DEFAULTS.vol);
  const [rate, setRate] = useState(DEFAULTS.rate);

  const T = months / 12;
  const sigma = vol / 100;
  const r = rate / 100;

  const g = useMemo(() => blackScholes(kind, spot, strike, T, sigma, r), [kind, spot, strike, T, sigma, r]);

  // Curve of value-now and payoff-at-expiry across a range of stock prices.
  const curve = useMemo(() => {
    const xMax = Math.max(spot, strike) * 1.9;
    const n = 90;
    const xs = Array.from({ length: n + 1 }, (_, i) => (xMax * i) / n);
    const value = xs.map((x) => blackScholes(kind, x, strike, T, sigma, r).price);
    const payoff = xs.map((x) => Math.max(kind === "call" ? x - strike : strike - x, 0));
    const yMax = Math.max(...value, ...payoff) * 1.08 || 1;
    return { xs, value, payoff, xMax, yMax };
  }, [kind, strike, T, sigma, r, spot]);

  const moneyness =
    Math.abs(spot - strike) < 0.005 * strike
      ? "at the money"
      : (kind === "call") === spot > strike
        ? "in the money"
        : "out of the money";

  const reset = () => {
    setKind(DEFAULTS.kind); setMode("payoff"); setSpot(DEFAULTS.spot); setStrike(DEFAULTS.strike);
    setMonths(DEFAULTS.months); setVol(DEFAULTS.vol); setRate(DEFAULTS.rate);
  };

  const termLabel = months % 12 === 0 ? `${months / 12}-year` : `${months}-month`;
  const termHuman = months % 12 === 0 ? `${months / 12} year${months === 12 ? "" : "s"}` : `${months} months`;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />

        <div className="wl-simmode" role="group" aria-label="Option type">
          <button type="button" className={kind === "call" ? "active" : ""} aria-pressed={kind === "call"} onClick={() => setKind("call")}>Call</button>
          <button type="button" className={kind === "put" ? "active" : ""} aria-pressed={kind === "put"} onClick={() => setKind("put")}>Put</button>
        </div>

        <label className="wl-slider">
          <span>
            Stock price now
            <InfoTip text="The current price of the underlying stock (the 'spot' price). One option contract normally covers 100 shares; we price per share." />{" "}
            <strong>{money(spot, 0)}</strong>
          </span>
          <input type="range" min={20} max={200} step={1} value={spot} onChange={(e) => setSpot(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Strike price
            <InfoTip text="The price at which the option lets you buy (call) or sell (put) the stock. A call pays off when the stock rises above the strike; a put when it falls below." />{" "}
            <strong>{money(strike, 0)}</strong>
          </span>
          <input type="range" min={20} max={200} step={1} value={strike} onChange={(e) => setStrike(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Time to expiry
            <InfoTip text="How long until the option expires. More time means more chances for the stock to move your way — so more time is always worth more." />{" "}
            <strong>{termHuman}</strong>
          </span>
          <input type="range" min={1} max={36} step={1} value={months} onChange={(e) => setMonths(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Volatility
            <InfoTip text="How much the stock's price swings, per year (annualized standard deviation). Bigger swings mean a bigger chance of a big payoff — the single biggest driver of an option's price." />{" "}
            <strong>{vol}%</strong>
          </span>
          <input type="range" min={5} max={80} step={1} value={vol} onChange={(e) => setVol(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Risk-free rate
            <InfoTip text="The return on safe cash (short-term Treasuries). It nudges option prices through the time value of money, but it's a minor lever next to volatility and time." />{" "}
            <strong>{rate}%</strong>
          </span>
          <input type="range" min={0} max={8} step={0.25} value={rate} onChange={(e) => setRate(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">This {termLabel} {money(strike, 0)} {kind} is worth</span>
          <span className="ss-headline-value">{money(g.price)}</span>
          <span className="ss-headline-sub">
            per share ({money(g.price * 100, 0)} for one 100-share contract) · currently <strong>{moneyness}</strong>
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          <strong>Method:</strong> the Black–Scholes formula for a European option on a non-dividend stock. No live
          market data: change the levers and the fair price recomputes. Educational only, not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <div className="wl-simmode wl-simmode--wrap" role="group" aria-label="View" style={{ marginBottom: "var(--space-sm)" }}>
            <button type="button" className={mode === "payoff" ? "active" : ""} aria-pressed={mode === "payoff"} onClick={() => setMode("payoff")}>Value &amp; payoff</button>
            <button type="button" className={mode === "levers" ? "active" : ""} aria-pressed={mode === "levers"} onClick={() => setMode("levers")}>Time &amp; volatility</button>
          </div>

          {mode === "payoff" ? (
            <>
              <h3 style={{ marginTop: 0 }}>What it's worth now vs. at expiration</h3>
              <PayoffChart curve={curve} kind={kind} spot={spot} strike={strike} price={g.price} breakeven={g.breakeven} money={money} />
              <div className="wl-flegend">
                <span><span className="wl-fdot" style={{ background: "var(--color-accent)" }} /> Value today (Black–Scholes)</span>
                <span><span className="wl-fdot" style={{ background: "var(--color-muted)" }} /> Payoff at expiration</span>
                <span><span className="wl-fdot" style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent)" }} /> Time value</span>
              </div>
              <p className="wl-fnote">
                The straight kinked line is what the option pays if it expired <em>today</em>: nothing until it crosses the
                strike, then dollar-for-dollar. The curved line is its value <em>now</em>: for most options it sits above the
                payoff line, and that cushion — time value — melts to zero as expiration nears.
                {g.timeValue < -0.005 ? " The exception is a deep in-the-money European put like this one: its time value is negative, so the curve dips just below the payoff line — you can't collect the intrinsic value until expiry." : ""}
              </p>
            </>
          ) : (
            <>
              <h3 style={{ marginTop: 0 }}>The two levers that create value</h3>
              <div className="wl-lower" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <LeverChart title={kind === "put" && g.timeValue < 0 ? "More time → less value" : "More time → more value"} xLabel="Months to expiry" xMax={36} sample={(m) => blackScholes(kind, spot, strike, m / 12, sigma, r).price} cur={months} curLabel={`${months}m`} money={money} yRef={curve.yMax} />
                <LeverChart title="More volatility → more value" xLabel="Volatility (%/yr)" xMax={80} sample={(v) => blackScholes(kind, spot, strike, T, v / 100, r).price} cur={vol} curLabel={`${vol}%`} money={money} yRef={curve.yMax} />
              </div>
              <p className="wl-fnote">
                An option is a bet on movement. Both more <em>time</em> and more <em>volatility</em> widen the range of
                where the stock could land, and since your downside is capped at the premium but your upside isn't, a wider
                range is worth more. For almost every option that means it gets a little cheaper each day it survives — and
                it's why calm stocks have cheap options and wild ones have dear ones.
                {kind === "put" && g.timeValue < 0 ? " (One exception: a deep in-the-money European put, like this one, actually gains value as expiry nears — you're waiting to collect a payoff that's already locked in.)" : ""}
              </p>
            </>
          )}
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>Intrinsic value {" "}<InfoTip text="What the option is worth if it expired right now: max(stock − strike, 0) for a call, max(strike − stock, 0) for a put." /></dt><dd>{money(g.intrinsic)}</dd></div>
              <div><dt>Time value {" "}<InfoTip text="Everything you pay beyond intrinsic value — the price of the chance the stock keeps moving your way before expiry." /></dt><dd>{money(g.timeValue)}</dd></div>
              <div><dt>Break-even {" "}<InfoTip text="The stock price at expiration where you just recover the premium. Beyond it, the option turns a profit." /></dt><dd>{money(g.breakeven, 0)}</dd></div>
              <div><dt>Delta {" "}<InfoTip text="How much the option's price moves for a $1 move in the stock. Calls run 0 to +1, puts 0 to −1; near ±0.5 around the strike." /></dt><dd>{g.delta >= 0 ? "+" : "−"}{Math.abs(g.delta).toFixed(2)}</dd></div>
            </dl>
            <p className="wl-saved">
              An option's price splits cleanly in two: <strong>intrinsic value</strong> (what it's worth exercised today)
              plus <strong>time value</strong> (the premium for what might still happen). Deep in-the-money options are
              nearly all intrinsic and move almost like the stock; at-the-money options are nearly all time value and are
              the most sensitive to time and volatility. Options are powerful and unforgiving — most expire worthless.
              Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PayoffChart({
  curve, kind, spot, strike, price, breakeven, money,
}: {
  curve: { xs: number[]; value: number[]; payoff: number[]; xMax: number; yMax: number };
  kind: "call" | "put"; spot: number; strike: number; price: number; breakeven: number; money: (n: number, dp?: number) => string;
}) {
  const width = 760, height = 400;
  const pad = { top: 24, right: 20, bottom: 46, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (v: number) => pad.left + (v / curve.xMax) * plotW;
  const y = (v: number) => pad.top + plotH - (v / curve.yMax) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  const path = (arr: number[]) => curve.xs.map((xv, i) => `${i === 0 ? "M" : "L"}${x(xv).toFixed(1)},${y(arr[i]).toFixed(1)}`).join(" ");
  const area = `${path(curve.value)} L${x(curve.xs[curve.xs.length - 1]).toFixed(1)},${y(curve.payoff[curve.payoff.length - 1]).toFixed(1)} ` +
    [...curve.xs].map((xv, i) => `L${x(xv).toFixed(1)},${y(curve.payoff[i]).toFixed(1)}`).reverse().join(" ") + " Z";

  const yTicks = 5;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (curve.yMax * i) / yTicks);
  const inRange = breakeven >= 0 && breakeven <= curve.xMax;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={`${kind} option value and payoff by stock price`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{money(v, 0)}</text>
        </g>
      ))}
      {/* time-value shading between payoff and value */}
      <path d={area} fill="var(--color-accent-soft)" opacity={0.7} stroke="none" />
      {/* strike + spot guides */}
      <line x1={x(strike)} x2={x(strike)} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-border)" strokeDasharray="4 3" />
      <text x={x(strike)} y={pad.top + plotH + 30} textAnchor="middle" style={{ ...axisText }}>strike {money(strike, 0)}</text>
      {inRange && (
        <>
          <line x1={x(breakeven)} x2={x(breakeven)} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-warn)" strokeDasharray="2 3" opacity={0.8} />
          <text x={x(breakeven)} y={pad.top - 8} textAnchor="middle" style={{ ...axisText, fill: "var(--color-warn)", fontWeight: 700 }}>break-even {money(breakeven, 0)}</text>
        </>
      )}
      {/* payoff (muted) and value (accent) */}
      <path d={path(curve.payoff)} fill="none" stroke="var(--color-muted)" strokeWidth={2} strokeDasharray="6 4" />
      <path d={path(curve.value)} fill="none" stroke="var(--color-accent)" strokeWidth={2.8} strokeLinejoin="round" />
      {/* current spot marker on the value curve */}
      <line x1={x(spot)} x2={x(spot)} y1={y(price)} y2={pad.top + plotH} stroke="var(--color-accent)" strokeWidth={1} opacity={0.35} />
      <circle cx={x(spot)} cy={y(price)} r={5} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={1.5} />
      <text x={x(spot)} y={pad.top + plotH + 18} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 700 }}>now {money(spot, 0)}</text>
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Stock price → · option value on the y-axis
      </text>
    </svg>
  );
}

function LeverChart({
  title, xLabel, xMax, sample, cur, curLabel, money, yRef,
}: {
  title: string; xLabel: string; xMax: number; sample: (x: number) => number; cur: number; curLabel: string; money: (n: number, dp?: number) => string; yRef: number;
}) {
  const width = 340, height = 210;
  const pad = { top: 22, right: 14, bottom: 34, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const n = 60;
  const xs = Array.from({ length: n + 1 }, (_, i) => (xMax * i) / n);
  const ys = xs.map(sample);
  const yMax = Math.max(...ys, yRef * 0.25) * 1.1 || 1;
  const x = (v: number) => pad.left + (v / xMax) * plotW;
  const y = (v: number) => pad.top + plotH - (v / yMax) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 10 } as const;
  const line = xs.map((xv, i) => `${i === 0 ? "M" : "L"}${x(xv).toFixed(1)},${y(ys[i]).toFixed(1)}`).join(" ");
  const curY = sample(cur);

  return (
    <div style={{ minWidth: 0 }}>
      <div className="wl-bar-label" style={{ marginBottom: 4, fontWeight: 700, color: "var(--color-text)" }}>{title}</div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={title}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.left} x2={width - pad.right} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--color-border)" />
            <text x={pad.left - 5} y={y(yMax * f) + 4} textAnchor="end" style={axisText}>{money(yMax * f, 0)}</text>
          </g>
        ))}
        <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2.4} strokeLinejoin="round" />
        <line x1={x(cur)} x2={x(cur)} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-text)" strokeDasharray="3 3" opacity={0.4} />
        <circle cx={x(cur)} cy={y(curY)} r={4.5} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={1.5} />
        <text x={x(cur)} y={y(curY) - 9} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 700 }}>{money(curY)}</text>
        <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text-soft)", fontWeight: 600 }}>{xLabel} (now {curLabel})</text>
      </svg>
    </div>
  );
}
