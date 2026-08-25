import { useMemo, useState } from "react";
import { TREEMAP_SNAPSHOTS, CONCENTRATION } from "../data/generated/sp500-concentration";

/**
 * Animated S&P 500 concentration treemap. Each tile is a stock (the top 30 by
 * weight, plus one "Other" tile for the remaining ~470), sized by its share of
 * total index value. Scrub the year — or hit play — and watch the giants swell
 * and shrink: the 1950s AT&T/GM era, the long broadening, and the recent
 * Magnificent-Seven surge. Real CRSP data; index-level weights only.
 */

const KEYS = Object.keys(TREEMAP_SNAPSHOTS).sort(); // year-end month-ends, 'YYYY-MM'
const CONC = new Map(CONCENTRATION.map((d) => [d.date, d]));

type Tile = { name: string; value: number; other: boolean };
type Placed = Tile & { x: number; y: number; w: number; h: number };

/** Worst (largest) aspect ratio in a row of tile areas laid along `side`. */
function worst(areas: number[], side: number): number {
  const s = areas.reduce((a, v) => a + v, 0);
  const mx = Math.max(...areas);
  const mn = Math.min(...areas);
  const s2 = s * s;
  return Math.max((side * side * mx) / s2, s2 / (side * side * mn));
}

/** Squarified treemap (Bruls, Huizing & van Wijk) in a 0–100 × 0–100 box. */
function squarify(items: Tile[]): Placed[] {
  const vals = items.filter((it) => it.value > 0);
  const total = vals.reduce((s, it) => s + it.value, 0) || 1;
  const scale = (100 * 100) / total;
  const areas = vals.map((it) => it.value * scale);
  const out: Placed[] = [];
  let rect = { x: 0, y: 0, w: 100, h: 100 };
  let start = 0;
  while (start < areas.length) {
    const side = Math.min(rect.w, rect.h);
    let end = start + 1;
    let best = worst(areas.slice(start, end), side);
    while (end < areas.length) {
      const next = worst(areas.slice(start, end + 1), side);
      if (next > best) break;
      best = next;
      end++;
    }
    const rowAreas = areas.slice(start, end);
    const rowSum = rowAreas.reduce((a, v) => a + v, 0);
    if (rect.w >= rect.h) {
      const colW = rowSum / rect.h; // a column down the left, full height
      let cy = rect.y;
      for (let k = start; k < end; k++) {
        const th = areas[k] / colW;
        out.push({ ...vals[k], x: rect.x, y: cy, w: colW, h: th });
        cy += th;
      }
      rect = { x: rect.x + colW, y: rect.y, w: rect.w - colW, h: rect.h };
    } else {
      const rowH = rowSum / rect.w; // a row across the top, full width
      let cx = rect.x;
      for (let k = start; k < end; k++) {
        const tw = areas[k] / rowH;
        out.push({ ...vals[k], x: cx, y: rect.y, w: tw, h: rowH });
        cx += tw;
      }
      rect = { x: rect.x, y: rect.y + rowH, w: rect.w, h: rect.h - rowH };
    }
    start = end;
  }
  return out;
}

const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;
const pct0 = (x: number) => `${(x * 100).toFixed(0)}%`;

/**
 * Controlled: the year index and the play/pause state live in
 * IndexConcentrationLab, so this scrubber, the lab's own year slider, and the
 * play button are three handles on ONE timeline — move any of them and the
 * treemap, the line chart, the headline stats and the holdings list all follow.
 */
export default function ConcentrationTreemap({
  yi,
  onScrub,
  playing,
  onTogglePlay,
}: {
  yi: number;
  onScrub: (i: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const key = KEYS[yi];
  const year = key.slice(0, 4);
  const snap = TREEMAP_SNAPSHOTS[key];

  const tiles = useMemo<Tile[]>(() => {
    const hs: Tile[] = snap.holdings
      .filter((h) => h.weight > 0)
      .map((h) => ({ name: h.ticker || "—", value: h.weight, other: false }));
    if (snap.other > 0) hs.push({ name: "Other 470+", value: snap.other, other: true });
    return hs;
  }, [key]);
  const placed = useMemo(() => squarify(tiles), [tiles]);

  const maxW = snap.holdings[0]?.weight ?? 0.01;
  const top1 = snap.holdings[0]?.weight ?? 0;
  const top10 = snap.holdings.slice(0, 10).reduce((a, h) => a + h.weight, 0);
  const effN = CONC.get(key)?.effN;

  const tint = (t: Placed) =>
    t.other
      ? "var(--color-border)"
      : `color-mix(in srgb, var(--color-accent) ${Math.round(30 + 62 * (t.value / maxW))}%, var(--color-surface))`;

  return (
    <div className="ic-tm">
      <div className="ic-tm-controls">
        <button type="button" className="ic-tm-play" onClick={onTogglePlay} aria-label={playing ? "Pause" : "Play through the years"}>
          {playing ? "⏸" : "▶"} <span>{playing ? "Pause" : "Play"}</span>
        </button>
        <input
          type="range"
          min={0}
          max={KEYS.length - 1}
          step={1}
          value={yi}
          aria-label="Year"
          onChange={(e) => onScrub(Number(e.target.value))}
        />
        <strong className="ic-tm-year">{year}</strong>
      </div>

      <div
        className="ic-tm-map"
        style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "var(--color-surface)", borderRadius: 6, overflow: "hidden" }}
        onMouseLeave={() => setHover(null)}
      >
        {placed.map((t) => {
          const big = t.w > 6 && t.h > 9;
          const wide = t.w > 9 && t.h > 12;
          const isHover = hover === t.name;
          return (
            <div
              key={t.name}
              title={`${t.name} — ${pct1(t.value)}`}
              onMouseEnter={() => setHover(t.name)}
              style={{
                position: "absolute",
                left: `${t.x}%`,
                top: `${t.y}%`,
                width: `${t.w}%`,
                height: `${t.h}%`,
                background: tint(t),
                border: "1px solid var(--color-surface)",
                boxShadow: isHover ? "inset 0 0 0 2px var(--color-text)" : undefined,
                transition: "left .5s ease, top .5s ease, width .5s ease, height .5s ease, background .5s ease",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: 2,
                cursor: "default",
                zIndex: isHover ? 2 : 1,
              }}
            >
              {big && (
                <span style={{ fontFamily: "var(--font-sans)", fontSize: wide ? 12 : 10, fontWeight: 700, color: t.other ? "var(--color-text-soft)" : "#fff", textShadow: t.other ? "none" : "0 1px 2px rgba(0,0,0,.35)", lineHeight: 1.1, textAlign: "center" }}>
                  {t.name}
                  {wide && <><br /><span style={{ fontWeight: 500, opacity: 0.9 }}>{pct1(t.value)}</span></>}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="wl-fnote">
        In <strong>{year}</strong>, the S&amp;P 500's biggest stock was{" "}
        <strong>{snap.holdings[0]?.ticker || "—"}</strong> at {pct1(top1)}, the top 10 were{" "}
        <strong>{pct0(top10)}</strong> of the index
        {effN !== undefined && <> — so its {snap.n} stocks behaved like about <strong>{Math.round(effN)}</strong> equally-weighted ones</>}.
        {hover && hover !== "Other 470+" && <> Hovering <strong>{hover}</strong>.</>} Each tile is a stock, sized by its
        share of the whole index; the grey tile is every stock outside the top 30. Hit <em>play</em> to watch the giants
        swell through the 1950s peak, the long broadening, and the recent Magnificent-Seven surge. (Early decades show
        each company's most recent ticker — 1950's "XOM" is Standard Oil of New Jersey, the company that became Exxon.)
      </p>
    </div>
  );
}
