# `PETAJISTO/` — Active Share panels (licensed, not committed)

**Source:** Antti Petajisto's active-share data, as distributed by the author.
**Status: LICENSED. The raw files are git-ignored and are not in this
repository** — see [`.gitignore`](.gitignore) in this directory.
**Citation:** Petajisto, A. (2013). "Active Share and Mutual Fund Performance."
*Financial Analysts Journal* 69(4): 73–93. See also Cremers, M., & Petajisto, A.
(2009), "How Active Is Your Fund Manager? A New Measure That Predicts
Performance," *Review of Financial Studies* 22(9): 3329–3365.

## Why it's here

Active share — the percentage of a fund's holdings that differ from its
benchmark — is what makes **closet indexing** measurable rather than rhetorical.
It powers the closet-indexing tool, which pairs a fund's fee against how much it
actually deviates from the index it charges to beat.

## The licence firewall

This directory follows the same rule as [`crsp/`](../crsp/README.md):

- The raw per-fund panels **never enter the repository** and never reach the
  browser.
- Only **universe-level aggregates** — distributions, bucket counts, medians by
  year — are written to `src/data/generated/`, and those are themselves
  non-redistributable (see [`src/data/generated/LICENSE`](../../../src/data/generated/LICENSE)).
- A fork will not have these files and cannot regenerate the aggregates without
  its own licensed copy. That is intended.

## Where the files actually live

In the shared local data library outside the repo, located via the `DATA_LIB`
environment variable (`$DATA_LIB/petajisto` and `$DATA_LIB/activeshare_nd`), as
described in [`data/sources/README.md`](../README.md).

Consumed by [`reduce-active-share.mjs`](../../../scripts/reduce-active-share.mjs).
