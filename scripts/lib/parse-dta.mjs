/**
 * Minimal reader for Stata `.dta` files — enough to ingest the Jordà-Schularick-
 * Taylor Macrohistory Database (format 118, Stata 14+). Also handles format 117
 * (Stata 13). Both are the modern tag-delimited layout:
 *
 *   <stata_dta><header>…</header><map>…</map><variable_types>…</variable_types>
 *   <varnames>…</varnames> … <data> …fixed-width rows… </data> …</stata_dta>
 *
 * We locate the sections we need by their unique ASCII tags (types, varnames,
 * data) and decode the fixed-width data block. Value labels and strL blobs are
 * not needed for JST (its only strings are fixed str# country/ISO codes) and are
 * intentionally unsupported — parseDta throws if a strL column is encountered.
 *
 * Stata numeric "missing" sentinels (. and .a–.z live at the top of each type's
 * range) are decoded to `null`.
 */
import { readFileSync } from "node:fs";

// Stata type codes for the fixed numeric types; 1..2045 = str#, 32768 = strL.
const T_DOUBLE = 65526;
const T_FLOAT = 65527;
const T_LONG = 65528;
const T_INT = 65529;
const T_BYTE = 65530;
const T_STRL = 32768;

// Largest non-missing value for each integer type (above ⇒ missing).
const INT_MAX_OK = { [T_BYTE]: 100, [T_INT]: 32740, [T_LONG]: 2147483620 };

function tagPayload(buf, tag) {
  const i = buf.indexOf(tag, 0, "latin1");
  if (i < 0) throw new Error(`.dta: missing section ${tag}`);
  return i + Buffer.byteLength(tag, "latin1");
}

function readAsciiBetween(buf, open, close) {
  const a = buf.indexOf(open, 0, "latin1") + open.length;
  const b = buf.indexOf(close, a, "latin1");
  return buf.toString("latin1", a, b);
}

function typeWidth(t) {
  if (t >= 1 && t <= 2045) return t; // str#
  if (t === T_STRL) return 8;
  if (t === T_DOUBLE || t === T_LONG) return t === T_DOUBLE ? 8 : 4;
  if (t === T_FLOAT) return 4;
  if (t === T_INT) return 2;
  if (t === T_BYTE) return 1;
  throw new Error(`.dta: unknown type code ${t}`);
}

/**
 * @param {string} path
 * @returns {{ release:number, byteorder:string, nvar:number, nobs:number,
 *   columns:{name:string,type:number,kind:'string'|'numeric'}[],
 *   rows: Record<string, number|string|null>[] }}
 */
export function parseDta(path) {
  const buf = readFileSync(path);

  const release = parseInt(readAsciiBetween(buf, "<release>", "</release>"), 10);
  if (release !== 117 && release !== 118) {
    throw new Error(`.dta release ${release} unsupported (only 117/118).`);
  }
  const byteorder = readAsciiBetween(buf, "<byteorder>", "</byteorder>").trim();
  const le = byteorder === "LSF";
  const nameLen = release === 118 ? 129 : 33;

  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const i16 = (o) => (le ? buf.readInt16LE(o) : buf.readInt16BE(o));
  const i32 = (o) => (le ? buf.readInt32LE(o) : buf.readInt32BE(o));
  const f32 = (o) => (le ? buf.readFloatLE(o) : buf.readFloatBE(o));
  const f64 = (o) => (le ? buf.readDoubleLE(o) : buf.readDoubleBE(o));

  const nvar = u16(tagPayload(buf, "<K>"));
  const nObase = tagPayload(buf, "<N>");
  const nobs =
    release === 118
      ? Number(le ? buf.readBigUInt64LE(nObase) : buf.readBigUInt64BE(nObase))
      : le
        ? buf.readUInt32LE(nObase)
        : buf.readUInt32BE(nObase);

  // --- variable types ------------------------------------------------------
  let p = tagPayload(buf, "<variable_types>");
  const types = new Array(nvar);
  for (let k = 0; k < nvar; k++, p += 2) types[k] = u16(p);
  if (types.includes(T_STRL)) {
    throw new Error(".dta: strL columns present — not supported by this reader.");
  }

  // --- variable names (fixed nameLen bytes, null-terminated UTF-8) ----------
  p = tagPayload(buf, "<varnames>");
  const names = new Array(nvar);
  for (let k = 0; k < nvar; k++) {
    const start = p + k * nameLen;
    let end = start;
    while (end < start + nameLen && buf[end] !== 0) end++;
    names[k] = buf.toString("utf8", start, end);
  }

  // --- data (nobs rows of fixed-width records) ------------------------------
  const widths = types.map(typeWidth);
  const rowLen = widths.reduce((a, b) => a + b, 0);
  const dataStart = tagPayload(buf, "<data>");

  const decodeNum = (t, o) => {
    switch (t) {
      case T_BYTE: {
        const v = buf.readInt8(o);
        return v > INT_MAX_OK[T_BYTE] ? null : v;
      }
      case T_INT: {
        const v = i16(o);
        return v > INT_MAX_OK[T_INT] ? null : v;
      }
      case T_LONG: {
        const v = i32(o);
        return v > INT_MAX_OK[T_LONG] ? null : v;
      }
      case T_FLOAT: {
        const v = f32(o);
        // Stata's float missing codes (. and .a–.z) all sit above ~1.701e38;
        // 1e37 is a safe cutoff well above any real JST value.
        return !Number.isFinite(v) || v > 1e37 ? null : v;
      }
      case T_DOUBLE: {
        const v = f64(o);
        // Same idea for doubles: missing codes start at +8.988e307.
        return !Number.isFinite(v) || v >= 8.9e307 ? null : v;
      }
      default:
        return null;
    }
  };

  const rows = new Array(nobs);
  for (let r = 0; r < nobs; r++) {
    const base = dataStart + r * rowLen;
    const row = {};
    let off = base;
    for (let k = 0; k < nvar; k++) {
      const t = types[k];
      if (t >= 1 && t <= 2045) {
        let end = off;
        while (end < off + t && buf[end] !== 0) end++;
        row[names[k]] = buf.toString("utf8", off, end).replace(/\s+$/, "");
      } else {
        row[names[k]] = decodeNum(t, off);
      }
      off += widths[k];
    }
    rows[r] = row;
  }

  const columns = names.map((name, k) => ({
    name,
    type: types[k],
    kind: types[k] >= 1 && types[k] <= 2045 ? "string" : "numeric",
  }));

  return { release, byteorder, nvar, nobs, columns, rows };
}
