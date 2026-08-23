/**
 * Shared SVG chart primitives — the pieces every hand-rolled lab chart was
 * duplicating. Deliberately tiny and unopinionated: styles and path builders
 * only, no components, so each lab keeps full control of its layout.
 *
 * Convention: new labs use these; existing labs migrate whenever they're next
 * touched (logged in docs/future-work.md). No charting library — the
 * zero-dependency, hand-rolled-SVG baseline stands.
 */

/** The standard axis/annotation text style (theme-aware via tokens). */
export const axisText = {
  fill: "var(--color-muted)",
  fontFamily: "var(--font-sans)",
  fontSize: 11,
} as const;

/** Bolder variant for captions under the plot. */
export const captionText = {
  ...axisText,
  fontWeight: 600,
  fill: "var(--color-text-soft)",
  fontSize: 12,
} as const;

/** SVG path through points via x/y scale functions. */
export function linePath<T>(pts: T[], x: (p: T, i: number) => number, y: (p: T, i: number) => number): string {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p, i).toFixed(1)},${y(p, i).toFixed(1)}`).join(" ");
}

/** Step path (previous value held until the next x) — marginal-rate style. */
export function stepPath<T>(pts: T[], x: (p: T, i: number) => number, y: (p: T, i: number) => number): string {
  let d = `M${x(pts[0], 0).toFixed(1)},${y(pts[0], 0).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L${x(pts[i], i).toFixed(1)},${y(pts[i - 1], i - 1).toFixed(1)} L${x(pts[i], i).toFixed(1)},${y(pts[i], i).toFixed(1)}`;
  }
  return d;
}

/** Evenly spaced gridline values from 0 to max (inclusive), `n` divisions. */
export function gridValues(max: number, n = 4): number[] {
  return Array.from({ length: n }, (_, i) => (max / n) * (i + 1));
}
