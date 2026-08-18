# Commenting log

What has been commented, when, and how we checked the code actually works
first. Plain language on purpose.

| Date | File(s) | How we verified it runs | Notes |
|---|---|---|---|
| 2026-08-17 | scripts/lib/data-paths.mjs, parse-crsp.mjs, parse-dta.mjs, parse-fred.mjs, parse-french.mjs, read-xlsx.mjs, scripts/inspect-sources.mjs | Ran `npm run data:inspect` — it read every raw source (French, Damodaran, Shiller, FRED, JST) and finished cleanly, exit 0, before and after the edits. | These files already had thorough headers and inline notes, so we only added two small clarifications: what Stata's "missing number" cutoffs (1e37, 8.9e307) mean in parse-dta, and that FRED writes a missing value as a period in parse-fred. Nothing else needed. |
