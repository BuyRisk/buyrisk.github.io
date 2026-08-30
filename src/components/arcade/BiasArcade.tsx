import { useEffect, useState } from "react";
import { GAMES, clearResults, loadResults, saveResult, type GameResult } from "./store";
import CalibrationGame from "./CalibrationGame";
import AnchorGame from "./AnchorGame";
import LossAversionGame from "./LossAversionGame";
import DispositionGame from "./DispositionGame";
import RealOrRandomGame from "./RealOrRandomGame";
import HerdingGame from "./HerdingGame";
import EndowmentGame from "./EndowmentGame";
import HindsightGame from "./HindsightGame";
import VignetteGame from "./VignetteGame";
import { FRAMING, OUTCOME, SUNK_COST } from "./vignettes";
import ProfileCard from "./ProfileCard";

/**
 * The Bias Arcade: eight short experiments that run the classic studies on
 * YOU before naming the bias — play first, diagnose second, remedy linked.
 * Results live only in this browser's localStorage and feed the bias-profile
 * radar. Everyone scores imperfectly; that's the finding, not a failing.
 */

export default function BiasArcade() {
  const [results, setResults] = useState<Record<string, GameResult>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0); // remount games on replay

  useEffect(() => setResults(loadResults()), []);

  const done = (r: GameResult) => setResults(saveResult(r));
  const played = GAMES.filter((g) => results[g.id]);

  const game = (id: string) => {
    switch (id) {
      case "calibration": return <CalibrationGame key={nonce} onDone={done} />;
      case "anchoring": return <AnchorGame key={nonce} onDone={done} />;
      case "loss": return <LossAversionGame key={nonce} onDone={done} />;
      case "disposition": return <DispositionGame key={nonce} onDone={done} />;
      case "patterns": return <RealOrRandomGame key={nonce} onDone={done} />;
      case "herding": return <HerdingGame key={nonce} onDone={done} />;
      case "endowment": return <EndowmentGame key={nonce} onDone={done} />;
      case "hindsight": return <HindsightGame key={nonce} onDone={done} />;
      case "framing": return <VignetteGame key={nonce} config={FRAMING} onDone={done} />;
      case "sunk": return <VignetteGame key={nonce} config={SUNK_COST} onDone={done} />;
      case "outcome": return <VignetteGame key={nonce} config={OUTCOME} onDone={done} />;
      default: return null;
    }
  };

  if (playing) {
    const meta = GAMES.find((g) => g.id === playing)!;
    const result = results[playing];
    return (
      <div className="ba">
        <div className="ba-topbar">
          <button type="button" className="wl-chip" onClick={() => setPlaying(null)}>← All games</button>
          <span className="ba-gametitle">{result ? `${meta.title} — ${meta.bias}` : meta.title}</span>
          {result && (
            <button type="button" className="wl-chip" onClick={() => { setNonce((n) => n + 1); }}>
              ↺ Play again
            </button>
          )}
        </div>
        {game(playing)}
      </div>
    );
  }

  return (
    <div className="ba">
      <p className="ba-intro">
        Eight two-minute experiments, adapted from the classic studies of behavioral economics.
        Each one measures a tendency <em>before</em> telling you what it was measuring — so play
        first, read after. There's no passing score: these reflexes are standard human equipment.
        The point is to feel them fire, because the same reflexes move real portfolios. Results
        stay in your browser only.
      </p>

      <div className="ba-grid">
        {GAMES.map((g) => {
          const r = results[g.id];
          return (
            <button key={g.id} type="button" className={`ba-card${r ? " ba-card--played" : ""}`} onClick={() => { setNonce((n) => n + 1); setPlaying(g.id); }}>
              <span className="ba-cardtitle">{g.title}</span>
              <span className="ba-cardteaser">{r ? r.headline : g.teaser}</span>
              <span className="ba-cardmeta">
                {r ? `Revealed: ${g.bias} · replay ↺` : `~${g.minutes} min · play to reveal the bias`}
              </span>
            </button>
          );
        })}
      </div>

      {played.length >= 3 && (
        <div className="ba-profile">
          <h3>Your bias profile</h3>
          <Radar results={results} />
          <p className="ba-profilenote">
            {played.length < GAMES.length
              ? `Based on the ${played.length} experiments you've played — the rest of the octagon fills in as you go.`
              : "All eight measured. Higher spokes mean the classic result showed up more strongly in your answers."}{" "}
            The remedies are the rest of this site: automation and index funds against overconfidence
            and pattern-seeking, written rules against framing and sunk costs, checking less against
            loss aversion, and a "would I buy it today?" habit against the disposition effect.
          </p>
          <ProfileCard results={results} />
          <button type="button" className="wl-chip" style={{ marginTop: "0.5rem" }} onClick={() => { clearResults(); setResults({}); }}>
            Clear my results
          </button>
        </div>
      )}
    </div>
  );
}

function Radar({ results }: { results: Record<string, GameResult> }) {
  const size = 420, cx = size / 2, cy = size / 2, R = 150;
  const n = GAMES.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, r: number) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 10.5 } as const;

  const poly = GAMES.map((g, i) => {
    const r = results[g.id] ? (results[g.id].score / 100) * R : 0;
    const [x, y] = pt(i, Math.max(r, 4));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: 460, height: "auto", display: "block", margin: "0 auto" }} role="img" aria-label="Radar chart of measured bias susceptibility across the eight games">
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={GAMES.map((_, i) => pt(i, R * f).join(",")).join(" ")} fill="none" stroke="var(--color-border)" />
      ))}
      {GAMES.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-border)" />;
      })}
      <polygon points={poly} fill="var(--color-warn)" opacity={0.25} stroke="var(--color-warn)" strokeWidth={2} />
      {GAMES.map((g, i) => {
        const [x, y] = pt(i, R + 24);
        const r = results[g.id];
        return (
          <text key={g.id} x={x} y={y} textAnchor="middle" style={{ ...axisText, fill: r ? "var(--color-text)" : "var(--color-muted)", fontWeight: r ? 700 : 400 }}>
            <tspan x={x} dy="0">{r ? g.bias.split(" (")[0] : "?"}</tspan>
            {r && <tspan x={x} dy="12">{r.score}</tspan>}
          </text>
        );
      })}
    </svg>
  );
}
