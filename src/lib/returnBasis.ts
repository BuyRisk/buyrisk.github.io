/**
 * One wording for the nominal/real distinction, shared by every tool that asks
 * for a return, so the site never explains the idea two different ways.
 *
 * The convention across the site:
 *  - Every return input carries its basis in the VISIBLE label — "(nominal)" or
 *    "(real)" — so a reader knows what they are typing without hovering.
 *  - The matching tooltip appends one of the strings below to whatever the tool
 *    needs to say about that particular input.
 *  - A tool whose figures are real states its outputs in "today's dollars"; a
 *    nominal tool's outputs are future dollars, and it says so where it matters.
 *
 * Which basis a tool uses is not a style choice, it follows the math: anything
 * that applies a tax rate, a bond yield, or a stated fee is working in nominal
 * terms, because those are all levied on nominal amounts. Anything that
 * compares purchasing power across decades works in real terms.
 */

/** For inputs measured before inflation. */
export const NOMINAL_TIP =
  "Nominal means before inflation — the headline number funds and accounts report. US stocks have averaged roughly 10% nominal, about 7% after inflation.";

/** For inputs measured after inflation. */
export const REAL_TIP =
  "Real means after inflation — what the money will actually buy, so results stay in today's dollars. US stocks have averaged roughly 7% real, about 10% before inflation.";
