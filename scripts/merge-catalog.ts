#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off globalConsole:off - A one-shot sync step; synchronous Node APIs keep it small.
// Resolves a conflicted GT translation catalog during an upstream sync. Catalogs key each string by
// a hash of its English text, so the fork's renames and T3's new strings touch different keys but
// adjacent lines, and git reports a conflict where none exists. This merges by key: the fork's
// catalog, plus every key T3 added, changed or removed since the merge base. A key both sides
// changed differently stays a conflict. `node scripts/fork-brand.ts --write` then rebuilds the
// catalogs from the merged source.
//
//   node scripts/merge-catalog.ts <path>...   merges each path from git's conflict stages
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";

type Catalog = Record<string, unknown>;

export function mergeCatalogs(
  base: Catalog,
  ours: Catalog,
  theirs: Catalog,
): { readonly merged: Catalog; readonly conflicts: readonly string[] } {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const merged: Catalog = { ...ours };
  const conflicts: string[] = [];
  for (const key of new Set([...Object.keys(base), ...Object.keys(theirs)])) {
    const inTheirs = Object.hasOwn(theirs, key);
    if (inTheirs && Object.hasOwn(base, key) && same(base[key], theirs[key])) continue;
    const oursChanged =
      Object.hasOwn(ours, key) !== Object.hasOwn(base, key) || !same(ours[key], base[key]);
    const agree = Object.hasOwn(ours, key) === inTheirs && same(ours[key], theirs[key]);
    if (oursChanged && !agree) {
      conflicts.push(key);
      continue;
    }
    if (inTheirs) merged[key] = theirs[key];
    else delete merged[key];
  }
  return { merged, conflicts };
}

const stage = (n: 1 | 2 | 3, path: string): Catalog => {
  try {
    return JSON.parse(
      NodeChildProcess.execFileSync("git", ["show", `:${n}:${path}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 256 * 1024 * 1024,
      }),
    ) as Catalog;
  } catch {
    return {};
  }
};

if (import.meta.main) {
  for (const path of process.argv.slice(2)) {
    const { merged, conflicts } = mergeCatalogs(stage(1, path), stage(2, path), stage(3, path));
    if (conflicts.length > 0) {
      console.error(`${path}: both sides changed ${conflicts.join(", ")}; left for the agent.`);
      process.exitCode = 1;
      continue;
    }
    NodeFS.writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`);
    console.log(`Merged ${path} by key.`);
  }
}
