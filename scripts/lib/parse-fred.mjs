/**
 * Parser for FRED (Federal Reserve Economic Data) CSV exports.
 *
 * FRED single-series files are the simplest sources in the library: a header
 * row `observation_date,<SERIES_ID>` followed by `YYYY-MM-DD,value` rows. Values
 * may be blank (holidays on daily series, discontinued spans, or not-yet-released
 * months) — those become `null`. Frequency (monthly vs daily) is inferred from
 * the spacing of the dates.
 */
import { readFileSync } from "node:fs";

export function parseFred(pathOrText, isText = false) {
  const text = isText ? pathOrText : readFileSync(pathOrText, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = lines[0].split(",");
  const seriesId = (header[1] || "value").trim();

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, raw] = lines[i].split(",");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) continue;
    const t = (raw ?? "").trim();
    const value = t === "" || t === "." ? null : Number(t);
    rows.push({ date: date.trim(), value: Number.isFinite(value) ? value : null });
  }

  return {
    seriesId,
    frequency: inferFrequency(rows),
    rows,
    span: rows.length ? [rows[0].date, rows[rows.length - 1].date] : null,
    missing: rows.filter((r) => r.value === null).length,
  };
}

/** Monthly if the dates land on the first of each month; otherwise daily. */
function inferFrequency(rows) {
  if (rows.length < 3) return "unknown";
  const allFirstOfMonth = rows.slice(0, 12).every((r) => r.date.endsWith("-01"));
  return allFirstOfMonth ? "monthly" : "daily";
}
