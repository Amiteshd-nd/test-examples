import { MIGRATIONS } from './migrations.ts';
import { CURRENT_SCHEMA_VERSION } from './version.ts';

// Migration runner (PRD §0.4 rule 4). A migration upgrades a raw document by exactly one
// version step; the runner chains steps from the file's `schema_version` to the current one.

export type RawDocument = Record<string, unknown>;

export interface Migration {
  from: string;
  to: string;
  migrate(doc: RawDocument): RawDocument;
}

export { MIGRATIONS };

export type MigrateResult =
  { ok: true; doc: RawDocument; from: string; applied: string[] } | { ok: false; error: string };

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const SEMVER = /^\d+\.\d+\.\d+$/;

export function migrate(
  input: unknown,
  migrations: readonly Migration[] = MIGRATIONS,
  target: string = CURRENT_SCHEMA_VERSION,
): MigrateResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'The file is not a plan document (expected a JSON object).' };
  }
  const from = (input as RawDocument).schema_version;
  if (typeof from !== 'string' || !SEMVER.test(from)) {
    return { ok: false, error: 'The plan has no valid "schema_version" (expected e.g. "1.0.0").' };
  }
  if (compareVersions(from, target) > 0) {
    return {
      ok: false,
      error: `The plan uses format ${from}, newer than this engine's ${target}. Update the app to open it.`,
    };
  }

  // Plans are plain JSON, so a JSON round trip is a full copy (structuredClone is a host API).
  let doc = JSON.parse(JSON.stringify(input)) as RawDocument;
  let version = from;
  const applied: string[] = [];
  while (version !== target) {
    const step = migrations.find((m) => m.from === version);
    if (!step) {
      return { ok: false, error: `No migration from format ${version} towards ${target}.` };
    }
    try {
      doc = step.migrate(doc);
    } catch (e) {
      return {
        ok: false,
        error: `The plan could not be upgraded from format ${step.from} to ${step.to}: ${e instanceof Error ? e.message : String(e)}.`,
      };
    }
    doc.schema_version = step.to;
    applied.push(`${step.from}→${step.to}`);
    version = step.to;
  }
  return { ok: true, doc, from, applied };
}
