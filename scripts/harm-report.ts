#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off globalConsole:off - A one-shot review check; synchronous Node APIs keep it small.
// Lists what a diff reaches on the harm list in CONTRIBUTING.md#look-for-harm-first, so the agent
// reviewer stops on it before running anything. Exit 1 means a maintainer must look first.
//
//   node scripts/harm-report.ts <base> <head>                     a PR
//   node scripts/harm-report.ts <base> <head> --upstream <ref>    a sync that merged <ref>
//
// In a sync, a protected file may change when the change is T3's alone: the fork's own edits to
// that file, measured against T3's version rewritten by fork-workflows.ts, are the same before and
// after the merge.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { rewriteWorkflow } from "./fork-workflows.ts";

const PROTECTED: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\.github\//, "GitHub workflows, actions or settings"],
  [/^packaging\//, "packaging"],
  [/(^|\/)Dockerfile[^/]*$/, "a Dockerfile"],
  [
    /^scripts\/(install[^/]*|.*release[^/]*|build-npm-launcher\.ts|npm-launcher\/.*)$/,
    "a release, install or publish script",
  ],
  [/^scripts\/(check-fork-invariants\.sh|fork-workflows\.ts|harm-report\.ts)$/, "a fork guard"],
  [/^\.agents\/skills\/(pr-review|contribution-triage)\//, "the reviewer's own rules"],
];
const SHIPPED = /^(apps\/(?!marketing\/)|packages\/)/;
const NOT_SHIPPED =
  /\.(test|spec|browser\.test)\.[cm]?[jt]sx?$|\/(test|tests|__tests__|fixtures|testkit|translations)\//;
const URL_HOST = /https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi;
const LOCAL_HOST =
  /(^|\.)(localhost|example\.(com|org|net)|invalid|test|local)$|^127\.|^0\.0\.0\.0$/;
const CREDENTIAL =
  /\.ssh\/|\.aws\/|\.netrc|[Kk]eychain|\bcookies?\b|auth\.json|\.claude\.json|credentials/;
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
const INSTALL_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"];

const git = (...args: string[]) =>
  NodeChildProcess.execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
const show = (ref: string, path: string) => {
  try {
    return git("show", `${ref}:${path}`);
  } catch {
    return "";
  }
};

// Lines changed from `from` to `to`, without positions, so an edit that moved stays the same edit.
function lineDelta(from: string, to: string): string {
  const dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "c3-harm-"));
  try {
    NodeFS.writeFileSync(NodePath.join(dir, "a"), from);
    NodeFS.writeFileSync(NodePath.join(dir, "b"), to);
    const result = NodeChildProcess.spawnSync(
      "git",
      ["diff", "--no-index", "--no-color", "-U0", NodePath.join(dir, "a"), NodePath.join(dir, "b")],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    return result.stdout
      .split("\n")
      .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
      .join("\n");
  } finally {
    NodeFS.rmSync(dir, { recursive: true, force: true });
  }
}

function forkDelta(forkRef: string, upstreamRef: string, path: string): string {
  const upstream = show(upstreamRef, path);
  const adapted = path.startsWith(".github/workflows/")
    ? rewriteWorkflow(NodePath.basename(path), upstream)
    : upstream;
  return lineDelta(adapted, show(forkRef, path));
}

// Every capture of `pattern` in the `.github` tree at `ref`.
const workflowRefs = (ref: string, pattern: RegExp) => {
  const found = new Set<string>();
  const files = git("ls-tree", "-r", "--name-only", ref, "--", ".github")
    .split("\n")
    .filter(Boolean);
  for (const path of files) {
    for (const match of show(ref, path).matchAll(new RegExp(pattern.source, "g")))
      found.add(match[1]!);
  }
  return found;
};

const packageDependencies = (ref: string, path: string) => {
  const text = show(ref, path);
  if (!text) return { names: new Set<string>(), scripts: new Map<string, string>() };
  const json = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
  const names = new Set(DEPENDENCY_FIELDS.flatMap((field) => Object.keys(json[field] ?? {})));
  const scripts = new Map(
    Object.entries(json.scripts ?? {}).filter(([name]) => INSTALL_SCRIPTS.includes(name)),
  );
  return { names, scripts };
};

export function harmReport(base: string, head: string, upstream: string | undefined) {
  const stops: string[] = [];
  const looks: string[] = [];
  const range = `${base}...${head}`;
  const changed = git("diff", "--name-only", "--no-renames", range).split("\n").filter(Boolean);
  const lastUpstream = upstream ? git("merge-base", base, upstream).trim() : undefined;

  for (const path of changed) {
    const rule = PROTECTED.find(([pattern]) => pattern.test(path));
    if (!rule) continue;
    if (
      upstream &&
      lastUpstream &&
      forkDelta(base, lastUpstream, path) === forkDelta(head, upstream, path)
    ) {
      looks.push(`\`${path}\` (${rule[1]}) changed in T3 only.`);
    } else {
      stops.push(`\`${path}\` changes ${rule[1]}.`);
    }
  }

  for (const [pattern, what] of [
    [/secrets\.([A-Za-z0-9_]+)/, "secret"],
    [/uses:\s*['"]?([A-Za-z0-9_.-]+)\//, "action owner"],
  ] as const) {
    const before = workflowRefs(base, pattern);
    for (const name of workflowRefs(head, pattern)) {
      if (!before.has(name)) stops.push(`Workflows reference a new ${what}: \`${name}\`.`);
    }
  }

  const privacy = show(head, "docs/user/privacy.md");
  const added = git("diff", "-U0", "--no-color", range, "--", "apps", "packages");
  let file = "";
  const hosts = new Map<string, string>();
  for (const line of added.split("\n")) {
    if (line.startsWith("+++ ")) file = line.slice("+++ b/".length);
    if (
      !line.startsWith("+") ||
      line.startsWith("+++") ||
      !SHIPPED.test(file) ||
      NOT_SHIPPED.test(file)
    ) {
      continue;
    }
    for (const match of line.matchAll(URL_HOST)) {
      const host = match[1]!.toLowerCase();
      if (!LOCAL_HOST.test(host) && !hosts.has(host)) hosts.set(host, file);
    }
    if (CREDENTIAL.test(line))
      looks.push(`\`${file}\` mentions a credential location: ${line.slice(1, 160).trim()}`);
    if (line.length > 2000)
      stops.push(`\`${file}\` adds a ${line.length}-character line (minified or encoded?).`);
  }
  for (const [host, where] of hosts) {
    let known = false;
    try {
      git("grep", "-q", "-F", "-i", host, base, "--", "apps", "packages");
      known = true;
    } catch {}
    if (known) continue;
    if (upstream && privacy.includes(host))
      looks.push(`New host \`${host}\` (${where}) is listed in privacy.md.`);
    else stops.push(`New network host \`${host}\` in \`${where}\`.`);
  }

  for (const path of changed.filter((p) => p.endsWith("package.json"))) {
    const before = packageDependencies(base, path);
    const after = packageDependencies(head, path);
    for (const name of after.names) {
      if (before.names.has(name)) continue;
      (upstream ? looks : stops).push(`\`${path}\` adds the dependency \`${name}\`.`);
    }
    for (const [name, script] of after.scripts) {
      if (before.scripts.get(name) !== script)
        stops.push(`\`${path}\` sets an install script: \`${name}: ${script}\`.`);
    }
  }

  for (const line of git("diff", "--numstat", "--no-renames", range).split("\n")) {
    const [adds, , path] = line.split("\t");
    if (adds === "-" && path) (upstream ? looks : stops).push(`\`${path}\` is a binary file.`);
  }

  return { stops: [...new Set(stops)], looks: [...new Set(looks)] };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--upstream");
  const upstream = at === -1 ? undefined : args[at + 1];
  const [base, head] = at === -1 ? args : args.filter((_, i) => i !== at && i !== at + 1);
  if (!base || !head || (at !== -1 && !upstream)) {
    console.error("Usage: node scripts/harm-report.ts <base> <head> [--upstream <ref>]");
    process.exit(2);
  }
  const { stops, looks } = harmReport(base, head, upstream);
  console.log(`## Harm report: ${base}...${head}${upstream ? ` (sync of ${upstream})` : ""}\n`);
  console.log(
    stops.length
      ? `### Stops for a maintainer\n\n${stops.map((s) => `- ${s}`).join("\n")}\n`
      : "No stops.\n",
  );
  if (looks.length)
    console.log(`### For the reviewer to check\n\n${looks.map((s) => `- ${s}`).join("\n")}`);
  process.exitCode = stops.length ? 1 : 0;
}
