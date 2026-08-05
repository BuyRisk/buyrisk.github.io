/**
 * Resolves a raw-source provider directory to its on-disk location.
 *
 * Two-layer data model:
 *  • IN_REPO providers — small, freely-redistributable sources that stay
 *    committed inside the Buy Risk repo (a deliberate reproducibility feature).
 *  • Everyone else — licensed and/or large raw pulls that live in the shared
 *    cross-project library, deduplicated across projects. Override the library
 *    location per machine with the DATA_LIB env var (defaults to the E: layout).
 *
 * Only reduced aggregates ship; raw library files are never committed.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Shared raw-data library. Set DATA_LIB on each machine to point at its copy. */
export const DATA_LIB = process.env.DATA_LIB ?? "E:\\Finance\\data\\sources";

/** Committed-in-repo providers (small, redistributable). */
const IN_REPO = new Set(["french", "fred", "damodaran", "shiller", "ssa"]);

/** Library folder name where it differs from the provider key. */
const LIB_NAME = { crsp: "crsp_stock" };

let libOk = false;
function assertLib() {
  if (libOk) return;
  if (!existsSync(DATA_LIB)) {
    throw new Error(
      `Shared data library not found at "${DATA_LIB}".\n` +
        `Set DATA_LIB to this machine's copy, e.g. in PowerShell:\n` +
        `  $env:DATA_LIB = "E:\\Finance\\data\\sources"\n` +
        `(Committed providers [${[...IN_REPO].join(", ")}] don't need it.)`,
    );
  }
  libOk = true;
}

/** Absolute path to a provider's raw-source directory. */
export function srcDir(provider) {
  if (IN_REPO.has(provider)) return join(repoRoot, "data", "sources", provider);
  assertLib();
  return join(DATA_LIB, LIB_NAME[provider] ?? provider);
}
