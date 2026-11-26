#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off globalConsole:off - A one-shot CI check; synchronous Node APIs keep it small.
// Keeps C3 Code's workflows runnable on CoreCodeAI after a T3 Code merge. T3 runs CI on Blacksmith
// runners, which CoreCodeAI has none of, so those jobs would queue until they time out; and a few
// workflows deploy previews to T3's own services, so their entry jobs only run in pingdotgg/t3code.
// `node scripts/fork-workflows.ts` fails when a workflow needs either change; `--write` makes them.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

// Each pattern maps a Blacksmith label to the free GitHub-hosted runner of the same OS.
const RUNNERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/blacksmith-\d+vcpu-ubuntu-\d+-arm/g, "ubuntu-24.04-arm"],
  [/blacksmith-\d+vcpu-ubuntu-\d+/g, "ubuntu-24.04"],
  [/blacksmith-\d+vcpu-macos-\d+/g, "macos-26"],
  [/blacksmith-\d+vcpu-windows-\d+/g, "windows-2025"],
];
const RUNNER_LINE = /^(\s*-?\s*(?:runs-on|runner|os):\s*)(.*)$/;

const GUARD = "github.repository == 'pingdotgg/t3code'";
// Entry jobs of workflows that only deploy to T3's services; later jobs skip through `needs`.
// release.yml, deploy-relay.yml and the store builds already carry this guard upstream.
export const GUARDED_JOBS: Readonly<Record<string, readonly string[]>> = {
  "desktop-macos-preview-publish.yml": ["resolve", "cleanup"],
  "desktop-macos-preview.yml": ["build"],
  "mobile-eas-preview.yml": ["ios", "android"],
  "mobile-eas-preview-fork.yml": ["request"],
  "relay-preview.yml": ["deploy_preview"],
  "relay-preview-cleanup.yml": ["cleanup_pr", "list_closed_previews"],
  "web-preview.yml": ["deploy"],
};

// Hosted runners have fewer cores than the Blacksmith machines T3 sized its timeouts for.
const TIMEOUT_FACTOR = 2;

function rewriteRunnerLine(line: string): string {
  const match = RUNNER_LINE.exec(line);
  if (!match) return line;
  const [, key = "", value = ""] = match;
  // A trailing comment may name the label upstream used; leave it as written.
  const hash = value.indexOf(" #");
  const head = hash === -1 ? value : value.slice(0, hash);
  const tail = hash === -1 ? "" : value.slice(hash);
  return key + RUNNERS.reduce((acc, [pattern, label]) => acc.replace(pattern, label), head) + tail;
}

// Moves every job off Blacksmith and doubles the timeout of each job it moved.
export function rewriteRunners(text: string): string {
  const lines = text.split("\n");
  const jobStarts = lines.flatMap((line, i) => (/^ {2}[\w-]+:\s*$/.test(line) ? [i] : []));
  const blocks = [0, ...jobStarts, lines.length];
  const out: string[] = [];
  for (let b = 0; b < blocks.length - 1; b++) {
    const block = lines.slice(blocks[b], blocks[b + 1]);
    const moved = block.map(rewriteRunnerLine);
    const changed = moved.some((line, i) => line !== block[i]);
    out.push(
      ...moved.map((line) =>
        changed
          ? line.replace(
              /^( {4}timeout-minutes: )(\d+)$/,
              (_, key: string, minutes: string) => `${key}${Number(minutes) * TIMEOUT_FACTOR}`,
            )
          : line,
      ),
    );
  }
  return out.join("\n");
}

export function guardJobs(file: string, text: string, jobs: readonly string[]): string {
  const lines = text.split("\n");
  for (const job of jobs) {
    const start = lines.indexOf(`  ${job}:`);
    if (start === -1) throw new Error(`${file}: job ${job} not found; update GUARDED_JOBS.`);
    let end = lines.findIndex((line, i) => i > start && /^ {2}\S/.test(line));
    if (end === -1) end = lines.length;
    const at = lines.findIndex((line, i) => i > start && i < end && line.startsWith("    if:"));
    if (at === -1) {
      const runsOn = lines.findIndex((line, i) => i > start && i < end && /^ {4}\S/.test(line));
      lines.splice(runsOn, 0, `    if: ${GUARD}`);
      continue;
    }
    if (lines.slice(at, at + 4).some((line) => line.includes(GUARD))) continue;
    const condition = lines[at]!.slice("    if:".length).trim();
    if (condition === ">-" || condition === "|" || condition === ">") {
      lines.splice(at + 1, 0, `      ${GUARD} &&`);
    } else {
      const bare = condition.replace(/^\$\{\{\s*([\s\S]*?)\s*\}\}$/, "$1");
      lines[at] = `    if: ${GUARD} && (${bare})`;
    }
  }
  return lines.join("\n");
}

export function rewriteWorkflow(file: string, text: string): string {
  const jobs = GUARDED_JOBS[file];
  const runners = rewriteRunners(text);
  return jobs ? guardJobs(file, runners, jobs) : runners;
}

if (import.meta.main) {
  const write = process.argv.includes("--write");
  const dir = NodePath.resolve(import.meta.dirname, "../.github/workflows");
  const files = NodeFS.readdirSync(dir).filter((file) => /\.ya?ml$/.test(file));
  for (const file of Object.keys(GUARDED_JOBS)) {
    if (!files.includes(file)) {
      console.error(`${file} is gone from .github/workflows; update GUARDED_JOBS.`);
      process.exitCode = 1;
    }
  }
  const stale: string[] = [];
  for (const file of files.toSorted()) {
    const path = NodePath.join(dir, file);
    const before = NodeFS.readFileSync(path, "utf8");
    const after = rewriteWorkflow(file, before);
    if (after === before) continue;
    stale.push(file);
    if (write) NodeFS.writeFileSync(path, after);
  }
  if (write) {
    console.log(
      stale.length === 0 ? "Workflows already fit the fork." : `Rewrote ${stale.join(", ")}`,
    );
  } else if (stale.length > 0) {
    console.error(
      `These workflows use Blacksmith runners or reach T3's services unguarded: ${stale.join(", ")}\n` +
        "Run `node scripts/fork-workflows.ts --write` and review the diff.",
    );
    process.exitCode = 1;
  } else {
    console.log(`${files.length} workflows fit the fork.`);
  }
}
