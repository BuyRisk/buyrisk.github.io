/**
 * Generic parser for Kenneth R. French Data Library CSV files.
 *
 * These files share one grammar but come in many shapes: the factor files are a
 * single table with an appended annual block; the portfolio/industry files stack
 * 6–10 tables (value-weighted returns, equal-weighted returns, annual variants,
 * number of firms, average size, characteristics) into one file. Every table is
 * introduced by a column-header line whose first cell is empty (e.g.
 * `,Mkt-RF,SMB,...` or `,NoDur,Durbl,...`), optionally preceded by a human title
 * line (e.g. `  Average Value Weighted Returns -- Monthly`).
 *
 * This parser is deliberately format-driven, not file-specific: give it the raw
 * text of ANY French file and it returns the list of blocks it contains.
 *
 * Conventions handled:
 *  - Preamble prose and the trailing `Copyright ...` line are ignored.
 *  - Period keys: 4 digits = annual (YYYY), 6 = monthly (YYYYMM),
 *    8 = daily/weekly (YYYYMMDD). `frequency` is inferred per block.
 *  - Missing-data sentinels -99.99 and -999 become `null`.
 *  - Values are kept verbatim as **percent per period** (French's units);
 *    downstream reducers decide how to convert.
 */

const MISSING = new Set([-99.99, -999, -99.99, -999.0]);

/** Is this line a column header? First CSV cell empty, 2+ fields. */
function isHeaderLine(line) {
  if (!/^\s*,/.test(line)) return false;
  const cells = line.split(",");
  return cells.length >= 2 && cells.slice(1).some((c) => c.trim() !== "");
}

/** First cell of a data row: 4/6/8 digit period key, then a comma. */
function periodOf(line) {
  const m = line.match(/^\s*(\d{4}|\d{6}|\d{8})\s*,/);
  return m ? m[1] : null;
}

function frequencyOf(periodKey) {
  if (periodKey.length === 4) return "annual";
  if (periodKey.length === 6) return "monthly";
  return "daily-or-weekly"; // 8 digits; caller disambiguates via filename
}

function toNumber(cell) {
  const t = cell.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return MISSING.has(n) ? null : n;
}

/**
 * Parse raw French CSV text into an array of blocks.
 * @param {string} text
 * @returns {Array<{title: string, columns: string[], frequency: string,
 *   rows: Array<{period: string, values: (number|null)[]}>,
 *   missing: number, span: [string, string] | null}>}
 */
export function parseFrench(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let lastText = ""; // most recent non-empty prose line (candidate title)
  let current = null;

  const close = () => {
    if (current && current.rows.length) {
      current.span = [
        current.rows[0].period,
        current.rows[current.rows.length - 1].period,
      ];
      blocks.push(current);
    }
    current = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim() === "") continue;
    if (/^copyright/i.test(line.trim())) {
      close();
      continue;
    }

    if (isHeaderLine(line)) {
      close();
      const columns = line
        .split(",")
        .slice(1)
        .map((c) => c.trim());
      // Some files (e.g. the daily momentum factor) have a trailing comma on
      // every line, producing a phantom empty column. Drop trailing blanks.
      while (columns.length && columns[columns.length - 1] === "") columns.pop();
      // A prose title only counts if it directly precedes this header and
      // isn't itself a full preamble sentence (those end in a period).
      const title =
        lastText && !/[.]\s*$/.test(lastText) ? lastText.trim() : "";
      current = { title, columns, frequency: null, rows: [], missing: 0 };
      lastText = "";
      continue;
    }

    const period = periodOf(line);
    if (period && current) {
      const cells = line.split(",");
      // Truncate to the real column count so trailing-comma artifacts (and any
      // ragged extra cells) don't leak into the parsed row.
      const values = cells.slice(1, 1 + current.columns.length).map(toNumber);
      current.missing += values.filter((v) => v === null).length;
      if (current.frequency === null) current.frequency = frequencyOf(period);
      current.rows.push({ period, values });
      continue;
    }

    // Anything else is prose — remember it as a possible next-block title.
    lastText = line;
  }
  close();
  return blocks;
}

/**
 * Convenience: find one block by a case-insensitive title substring and/or
 * frequency. Returns the first match or undefined.
 */
export function pickBlock(blocks, { title, frequency } = {}) {
  return blocks.find(
    (b) =>
      (title === undefined ||
        b.title.toLowerCase().includes(title.toLowerCase())) &&
      (frequency === undefined || b.frequency === frequency)
  );
}

/**
 * Reshape a block into column-keyed series: { period: string[],
 * series: { [column]: (number|null)[] } }. Handy for reducers.
 */
export function toColumns(block) {
  const period = block.rows.map((r) => r.period);
  const series = {};
  block.columns.forEach((col, i) => {
    series[col] = block.rows.map((r) => r.values[i]);
  });
  return { period, series };
}
