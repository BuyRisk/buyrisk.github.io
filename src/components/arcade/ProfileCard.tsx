import { useState } from "react";
import { GAMES, type GameResult } from "./store";

/**
 * Shareable bias-profile card: draws the radar + scores onto a canvas (theme
 * colors resolved at draw time) and offers it as a PNG download, plus a
 * plain-text summary for the clipboard. Hand-rolled canvas — no dependency,
 * per the site's per-flagship-libraries-only rule.
 */

const css = (name: string, fallback: string) =>
  (typeof getComputedStyle !== "undefined"
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : "") || fallback;

function drawCard(results: Record<string, GameResult>): HTMLCanvasElement {
  const played = GAMES.filter((g) => results[g.id]);
  const W = 900;
  const H = 560 + played.length * 34 + 90;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = css("--color-surface", "#ffffff");
  const text = css("--color-text", "#1c2b26");
  const soft = css("--color-muted", "#66736e");
  const warn = css("--color-warn", "#b4531f");
  const border = css("--color-border", "#dde4e0");
  const accent = css("--color-accent", "#1f6f54");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  ctx.fillStyle = text;
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("My Bias Profile", W / 2, 64);
  ctx.font = "400 19px system-ui, sans-serif";
  ctx.fillStyle = soft;
  ctx.fillText(`${played.length} of ${GAMES.length} experiments · higher = the classic result showed up stronger`, W / 2, 96);

  // Radar (all games as axes; unplayed at 0).
  const cx = W / 2, cy = 320, R = 165;
  const n = GAMES.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, r: number): [number, number] => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];

  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  for (const f of [0.33, 0.66, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const [x, y] = pt(i % n, R * f);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, R);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const g = GAMES[i % n];
    const r = results[g.id] ? Math.max((results[g.id].score / 100) * R, 4) : 4;
    const [x, y] = pt(i % n, r);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = warn + "44";
  ctx.fill();
  ctx.strokeStyle = warn;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.font = "600 14px system-ui, sans-serif";
  for (let i = 0; i < n; i++) {
    const g = GAMES[i];
    const [x, y] = pt(i, R + 30);
    ctx.fillStyle = results[g.id] ? text : soft;
    ctx.fillText(results[g.id] ? g.bias.split(" (")[0] : "?", x, y);
  }

  // Score list.
  ctx.textAlign = "left";
  let yy = 560;
  for (const g of played) {
    const r = results[g.id];
    ctx.fillStyle = text;
    ctx.font = "600 19px system-ui, sans-serif";
    ctx.fillText(`${g.bias.split(" (")[0]} — ${r.score}`, 70, yy);
    ctx.fillStyle = soft;
    ctx.font = "400 15px system-ui, sans-serif";
    const head = r.headline.length > 78 ? r.headline.slice(0, 77) + "…" : r.headline;
    ctx.fillText(head, 70, yy + 19);
    // score bar
    ctx.fillStyle = border;
    ctx.fillRect(620, yy - 14, 210, 12);
    ctx.fillStyle = r.score >= 50 ? warn : accent;
    ctx.fillRect(620, yy - 14, (210 * r.score) / 100, 12);
    yy += 34;
  }

  ctx.fillStyle = soft;
  ctx.font = "400 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Test your own biases: buyrisk.org/tools/behavioral-finance · ${new Date().toLocaleDateString()}`, W / 2, H - 34);

  return canvas;
}

export default function ProfileCard({ results }: { results: Record<string, GameResult> }) {
  const [copied, setCopied] = useState(false);

  const download = () => {
    const canvas = drawCard(results);
    const a = document.createElement("a");
    a.download = "my-bias-profile.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  const copy = async () => {
    const played = GAMES.filter((g) => results[g.id]);
    const lines = [
      `My Bias Profile (${played.length}/${GAMES.length} experiments):`,
      ...played.map((g) => `• ${g.bias.split(" (")[0]}: ${results[g.id].score}/100 — ${results[g.id].headline}`),
      "Test yours: buyrisk.org/tools/behavioral-finance",
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="ba-choicerow" style={{ marginTop: "0.6rem" }}>
      <button type="button" className="wl-chip" onClick={download}>⬇ Download profile card (PNG)</button>
      <button type="button" className="wl-chip" onClick={copy}>{copied ? "✓ Copied" : "📋 Copy text summary"}</button>
    </div>
  );
}
