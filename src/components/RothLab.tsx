import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";

/**
 * "Roth or Traditional? (+ the employer match)" — two of the most consequential,
 * least-understood decisions in a workplace retirement plan.
 *
 *  • Roth vs Traditional: the whole thing hinges on one comparison — your tax rate
 *    now vs. in retirement. Same pre-tax budget, they're mathematically identical
 *    when the rates match; Roth wins if your rate will be higher later, Traditional
 *    if lower. Everything else is noise.
 *  • Employer match: the closest thing to free money in all of investing — an
 *    instant, guaranteed return you should capture before anything else.
 *
 * Educational only, not advice.
 */

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function RothLab() {
  const [mode, setMode] = useState<"account" | "match">("account");

  // Roth vs Traditional
  const [contrib, setContrib] = useState(7_000); // pre-tax budget $/yr
  const [taxNow, setTaxNow] = useState(24);
  const [taxLater, setTaxLater] = useState(22);
  const [years, setYears] = useState(30);
  const [ret, setRet] = useState(5);

  // Employer match
  const [salary, setSalary] = useState(90_000);
  const [contribPct, setContribPct] = useState(6);
  const [matchRate, setMatchRate] = useState(50);
  const [matchLimit, setMatchLimit] = useState(6);

  const acct = useMemo(() => {
    const g = Math.pow(1 + ret / 100, years);
    const traditional = contrib * g * (1 - taxLater / 100); // full pre-tax in, taxed at withdrawal
    const roth = contrib * (1 - taxNow / 100) * g; // taxed going in, tax-free out
    const diff = roth - traditional;
    const winner = Math.abs(diff) < 1 ? "tie" : diff > 0 ? "roth" : "traditional";
    return { traditional, roth, diff: Math.abs(diff), winner, grossTraditional: contrib * g };
  }, [contrib, taxNow, taxLater, years, ret]);

  const match = useMemo(() => {
    const yourContrib = (salary * contribPct) / 100;
    const matchedPct = Math.min(contribPct, matchLimit);
    const employerAdds = (salary * matchedPct) / 100 * (matchRate / 100);
    const instantReturn = yourContrib > 0 ? employerAdds / yourContrib : 0;
    const leavingBehind = contribPct < matchLimit ? (salary * (matchLimit - contribPct)) / 100 * (matchRate / 100) : 0;
    // What the match alone grows to over the years used in the account tab.
    const g = Math.pow(1 + ret / 100, years);
    const matchFV = employerAdds * ((g - 1) / (ret / 100 || 1));
    return { yourContrib, employerAdds, instantReturn, leavingBehind, matchFV };
  }, [salary, contribPct, matchRate, matchLimit, ret, years]);

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton
          onReset={() => {
            setMode("account"); setContrib(7_000); setTaxNow(24); setTaxLater(22); setYears(30); setRet(5);
            setSalary(90_000); setContribPct(6); setMatchRate(50); setMatchLimit(6);
          }}
        />
        <div className="wl-simmode" role="group" aria-label="Mode">
          <button type="button" className={mode === "account" ? "active" : ""} aria-pressed={mode === "account"} onClick={() => setMode("account")}>
            Roth vs Traditional
          </button>
          <button type="button" className={mode === "match" ? "active" : ""} aria-pressed={mode === "match"} onClick={() => setMode("match")}>
            Employer match
          </button>
        </div>

        {mode === "account" ? (
          <>
            <label className="wl-slider">
              <span>
                Yearly contribution (pre-tax)
                <InfoTip text="The pre-tax dollars you're deciding how to shelter. For a fair comparison, Traditional invests all of it; Roth invests what's left after paying tax on it today." />{" "}
                <strong>{currency(contrib)}</strong>
              </span>
              <input type="range" min={1_000} max={23_000} step={500} value={contrib} onChange={(e) => setContrib(+e.target.value)} />
            </label>
            <label className="wl-slider">
              <span>
                Tax rate now
                <InfoTip text="Your marginal tax rate today — the rate on your last dollar of income. Contributing to Traditional saves you this rate now." />{" "}
                <strong>{taxNow}%</strong>
              </span>
              <input type="range" min={0} max={45} step={1} value={taxNow} onChange={(e) => setTaxNow(+e.target.value)} />
            </label>
            <label className="wl-slider">
              <span>
                Tax rate in retirement
                <InfoTip text="The marginal rate you expect when you withdraw. Traditional withdrawals are taxed at this rate; Roth withdrawals are tax-free. This vs. the rate today is the whole decision." />{" "}
                <strong>{taxLater}%</strong>
              </span>
              <input type="range" min={0} max={45} step={1} value={taxLater} onChange={(e) => setTaxLater(+e.target.value)} />
            </label>
            <label className="wl-slider">
              <span>
                Years to grow
                <InfoTip text="How long until you withdraw. Longer just scales both accounts equally — it doesn't change which wins." />{" "}
                <strong>{years}</strong>
              </span>
              <input type="range" min={5} max={45} step={1} value={years} onChange={(e) => setYears(+e.target.value)} />
            </label>
            <label className="wl-slider">
              <span>
                Real return
                <InfoTip text="Expected return above inflation." /> <strong>{ret}%</strong>
              </span>
              <input type="range" min={1} max={8} step={0.5} value={ret} onChange={(e) => setRet(+e.target.value)} />
            </label>

            <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
              <span className="ss-headline-label">
                {acct.winner === "tie" ? "With equal tax rates, it's a" : `${acct.winner === "roth" ? "Roth" : "Traditional"} comes out ahead by`}
              </span>
              <span className="ss-headline-value">{acct.winner === "tie" ? "dead heat" : currency(acct.diff)}</span>
              <span className="ss-headline-sub">
                {acct.winner === "tie"
                  ? <>same after-tax result either way — {currency(acct.roth)}</>
                  : acct.winner === "roth"
                    ? <>because your tax rate is <strong>higher later</strong> ({taxLater}%) than today ({taxNow}%)</>
                    : <>because your tax rate is <strong>lower later</strong> ({taxLater}%) than today ({taxNow}%)</>}
              </span>
            </div>

            <p className="wl-note" style={{ marginTop: "0.5rem" }}>
              Same {currency(contrib)} pre-tax budget in each. Traditional invests it all and is taxed on withdrawal;
              Roth is taxed today, then grows and withdraws tax-free. Educational only, not advice.
            </p>
          </>
        ) : (
          <>
            <label className="wl-slider">
              <span>
                Salary <InfoTip text="Your gross annual salary — the base the match percentages apply to." /> <strong>{currency(salary)}</strong>
              </span>
              <input type="range" min={30_000} max={300_000} step={5_000} value={salary} onChange={(e) => setSalary(+e.target.value)} />
            </label>
            <label className="wl-slider">
              <span>
                You contribute
                <InfoTip text="The share of your salary you put into the plan. To get the full match, this needs to be at least the match limit." />{" "}
                <strong>{contribPct}%</strong>
              </span>
              <input type="range" min={0} max={20} step={1} value={contribPct} onChange={(e) => setContribPct(+e.target.value)} />
            </label>
            <label className="wl-slider">
              <span>
                Employer matches
                <InfoTip text="How many cents the employer adds per dollar you contribute. A 50% match adds 50¢ per $1 — an instant 50% return." />{" "}
                <strong>{matchRate}%</strong>
              </span>
              <input type="range" min={0} max={100} step={5} value={matchRate} onChange={(e) => setMatchRate(+e.target.value)} />
            </label>
            <label className="wl-slider">
              <span>
                …up to this much of salary
                <InfoTip text="The match caps out once your contributions reach this share of salary. Contributing less than this leaves free money on the table." />{" "}
                <strong>{matchLimit}%</strong>
              </span>
              <input type="range" min={0} max={12} step={1} value={matchLimit} onChange={(e) => setMatchLimit(+e.target.value)} />
            </label>

            <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
              <span className="ss-headline-label">Your employer adds, free, every year</span>
              <span className="ss-headline-value">{currency(match.employerAdds)}</span>
              <span className="ss-headline-sub">
                an instant <strong>{(match.instantReturn * 100).toFixed(0)}% return</strong> on the {currency(match.yourContrib)} you put in
              </span>
            </div>

            <p className="wl-note" style={{ marginTop: "0.5rem" }}>
              {match.leavingBehind > 0
                ? `You're leaving ${currency(match.leavingBehind)}/yr on the table — bump your contribution to ${matchLimit}% to capture the full match.`
                : "You're capturing the full match. This is the one guaranteed, unbeatable return in investing — take it before anything else."}
            </p>
          </>
        )}
      </div>

      <div className="wl-stage">
        {mode === "account" ? (
          <>
            <div className="wl-frontier">
              <h3>After-tax money in your pocket at retirement</h3>
              <AccountBars traditional={acct.traditional} roth={acct.roth} />
              <p className="wl-fnote">
                Both bars start from the same pre-tax budget. The <em>only</em> thing that separates them is when the tax
                is paid — and at what rate. Move the two tax sliders to equal values and the bars snap to the same height.
              </p>
            </div>
            <div className="wl-lower">
              <div className="wl-readout">
                <dl className="ss-stats">
                  <div><dt>Traditional, after tax</dt><dd>{currency(acct.traditional)}</dd></div>
                  <div><dt>Roth, after tax</dt><dd>{currency(acct.roth)}</dd></div>
                  <div><dt>Traditional, before tax</dt><dd>{currency(acct.grossTraditional)}</dd></div>
                  <div><dt>The gap</dt><dd>{acct.winner === "tie" ? "—" : currency(acct.diff)}</dd></div>
                </dl>
                <p className="wl-saved">
                  The big Traditional balance is partly the government's — you still owe tax on every dollar you pull out.
                  Roth's smaller-looking contribution is already yours, free and clear. So the contest isn't about the
                  headline balance; it's <strong>only</strong> about your tax rate now versus later. Common tie-breakers:
                  Roth if you're early-career with room to grow into higher brackets, or want tax-free flexibility;
                  Traditional if you're in your peak-earning years and expect a lower rate in retirement. Educational only,
                  not advice.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="wl-frontier">
              <h3>Free money, compounded</h3>
              <MatchBars yourContrib={match.yourContrib} employerAdds={match.employerAdds} />
              <p className="wl-fnote">
                The blue slice is yours; the gold slice is your employer's, added the moment you contribute. No market
                return, no waiting, no risk — you cannot buy that anywhere.
              </p>
            </div>
            <div className="wl-lower">
              <div className="wl-readout">
                <dl className="ss-stats">
                  <div><dt>You put in / yr</dt><dd>{currency(match.yourContrib)}</dd></div>
                  <div><dt>Employer adds / yr</dt><dd>{currency(match.employerAdds)}</dd></div>
                  <div><dt>Instant return</dt><dd>{(match.instantReturn * 100).toFixed(0)}%</dd></div>
                  <div><dt>Match grows to ({years} yr)</dt><dd>{currency(match.matchFV)}</dd></div>
                </dl>
                <p className="wl-saved">
                  A {matchRate}% match is an instant, guaranteed {matchRate}% return — before the market does anything.
                  Nothing else in investing comes close, which is why "get the full match" sits at the very top of every
                  sensible priority list, ahead of paying down low-rate debt or investing anywhere else. Over {years} years,
                  that free money alone compounds into <strong>{currency(match.matchFV)}</strong>. Educational only, not advice.
                </p>
              </div>
            </div>
          </>
        )}

        <p className="wl-note">
          A clean model: real tax brackets are progressive (your <em>effective</em> rate differs from the marginal rate
          shown here), contribution limits and rules change, and state taxes matter. Use it to see the logic, not to file
          your taxes.
        </p>
      </div>
    </div>
  );
}

function AccountBars({ traditional, roth }: { traditional: number; roth: number }) {
  const width = 760;
  const height = 360;
  const pad = { top: 26, right: 18, bottom: 44, left: 66 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const bars = [
    { label: "Traditional", sub: "taxed at withdrawal", value: traditional, color: "var(--pl-c1)" },
    { label: "Roth", sub: "tax-free withdrawal", value: roth, color: "var(--color-accent)" },
  ];
  const maxV = Math.max(...bars.map((b) => b.value)) * 1.16;
  const y = (v: number) => pad.top + plotH - (v / maxV) * plotH;
  const bandW = plotW / bars.length;
  const barW = Math.min(150, bandW * 0.5);
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const money = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1000)}k`);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="After-tax retirement wealth: Traditional vs Roth">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad.left} x2={width - pad.right} y1={y(maxV * f)} y2={y(maxV * f)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(maxV * f) + 4} textAnchor="end" style={axisText}>{money(maxV * f)}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const cx = pad.left + bandW * i + bandW / 2;
        return (
          <g key={b.label}>
            <rect x={cx - barW / 2} y={y(b.value)} width={barW} height={pad.top + plotH - y(b.value)} rx={6} fill={b.color} />
            <text x={cx} y={y(b.value) - 10} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 700, fontSize: 16 }}>{money(b.value)}</text>
            <text x={cx} y={height - pad.bottom + 20} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 600, fontSize: 13 }}>{b.label}</text>
            <text x={cx} y={height - pad.bottom + 35} textAnchor="middle" style={axisText}>{b.sub}</text>
          </g>
        );
      })}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        After-tax dollars you actually get to spend
      </text>
    </svg>
  );
}

function MatchBars({ yourContrib, employerAdds }: { yourContrib: number; employerAdds: number }) {
  const width = 760;
  const height = 300;
  const pad = { top: 24, right: 18, bottom: 40, left: 66 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const total = yourContrib + employerAdds;
  const maxV = Math.max(total, 1) * 1.12;
  const y = (v: number) => pad.top + plotH - (v / maxV) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const money = (v: number) => `$${Math.round(v).toLocaleString()}`;
  const cx = pad.left + plotW / 2;
  const barW = 150;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Your contribution plus the employer match">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.left} x2={width - pad.right} y1={y(maxV * f)} y2={y(maxV * f)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(maxV * f) + 4} textAnchor="end" style={axisText}>{money(maxV * f)}</text>
        </g>
      ))}
      <rect x={cx - barW / 2} y={y(yourContrib)} width={barW} height={pad.top + plotH - y(yourContrib)} fill="var(--pl-c1)" />
      <rect x={cx - barW / 2} y={y(total)} width={barW} height={y(yourContrib) - y(total)} rx={0} fill="var(--pl-c2)" />
      <text x={cx} y={y(total) - 8} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 700, fontSize: 15 }}>{money(total)}/yr invested</text>
      <text x={cx + barW / 2 + 8} y={y(yourContrib / 2) + 4} style={{ ...axisText, fill: "var(--color-text-soft)" }}>you: {money(yourContrib)}</text>
      <text x={cx + barW / 2 + 8} y={y(yourContrib + employerAdds / 2) + 4} style={{ ...axisText, fill: "var(--color-text-soft)" }}>employer: {money(employerAdds)}</text>
      <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        What actually lands in your account each year
      </text>
    </svg>
  );
}
