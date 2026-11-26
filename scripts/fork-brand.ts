#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off globalConsole:off - A one-shot fork tool; synchronous Node APIs keep it small.
// Renames the product noun "T3" (T3 thread, T3 server, T3 home…) to "C3" in user-visible source
// strings, and carries every translation over to its renamed GT key. Leaves identifiers (the
// workflow global `T3`, PowerShell namespaces), comments, and names of T3's own things: T3 Code,
// T3 Connect, T3 Chat, T3 Tools, a T3 account, the T3 team.
//
//   node scripts/fork-brand.ts           fails, listing each line that still says T3
//   node scripts/fork-brand.ts --write   renames them and regenerates the GT catalogs
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

const SOURCE =
  /(?<![./`\w-])T3(?![\w-]|\.\w|;|:\s*\{|\s*$| Connect| Chat| Tools| [Aa]ccount| Code| team| feedback)/g;
// Tests also hold data that happens to read "T3" (monograms, window titles, paths): only prose.
const TEST = /(?<![./`\w-])T3(?=(?: [a-z]|'s ))(?! team| feedback)/g;
const SKIP_LINE =
  /^\s*(\/\/|\*|\/\*)|Namespace T3|\[T3\.Env\]|Unable to connect to the T3 server WebSocket/;
const EXCLUDE = [
  /^apps\/marketing\//,
  /\/translations\//,
  /\/_generated\//,
  /\/testkit\/fixtures\//,
];
const INCLUDE = /\.(ts|tsx|js|mjs)$/;
const LOCALE =
  /(?<![./`\w])T3(?![\w]| Connect|-Connect| Chat|-Chat| Tools| [Aa]ccount| team| feedback)/g;
const isTest = (file: string) => /\.test\.|\.spec\.|\/test\/|\/__tests__\/|\.e2e\./.test(file);

// Each app's command that writes its English GT catalog from the source.
const GENERATE: Record<string, readonly [string, ...string[]]> = {
  "apps/web": [process.execPath, "node_modules/gt/bin/main.js", "generate"],
  "apps/mobile": [process.execPath, "node_modules/gt/bin/main.js", "generate"],
  "apps/desktop": [process.execPath, "scripts/i18n-generate.mjs"],
};

type Catalog = Record<string, unknown>;
type GtConfig = { defaultLocale: string; locales: string[]; files: { gt: { output: string } } };
const readJson = <T>(file: string): T => JSON.parse(NodeFS.readFileSync(file, "utf8")) as T;

export function renameLine(line: string, pattern: RegExp): string {
  return SKIP_LINE.test(line) ? line : line.replace(pattern, "C3");
}
export function renameFile(file: string, text: string): string {
  const pattern = isTest(file) ? TEST : SOURCE;
  return text
    .split("\n")
    .map((line) => renameLine(line, pattern))
    .join("\n");
}

const root = NodePath.resolve(import.meta.dirname, "..");
const candidates = () =>
  NodeChildProcess.execFileSync(
    "git",
    ["grep", "-lIP", "(?<![./`\\w-])T3(?![\\w-])", "--", "apps", "packages"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\n")
    .filter((file) => file && INCLUDE.test(file) && !EXCLUDE.some((re) => re.test(file)));

function check(): number {
  let stale = 0;
  for (const file of candidates()) {
    const lines = NodeFS.readFileSync(NodePath.join(root, file), "utf8").split("\n");
    const pattern = isTest(file) ? TEST : SOURCE;
    lines.forEach((line, i) => {
      if (renameLine(line, pattern) === line) return;
      stale += 1;
      console.error(`${file}:${i + 1}: ${line.trim().slice(0, 160)}`);
    });
  }
  return stale;
}

function write() {
  const catalogs = Object.keys(GENERATE).map((app) => {
    const config = readJson<GtConfig>(NodePath.join(root, app, "gt.config.json"));
    const dir = NodePath.join(root, app, NodePath.dirname(config.files.gt.output));
    const oldEn = readJson<Catalog>(NodePath.join(dir, `${config.defaultLocale}.json`));
    return { app, config, dir, oldEn };
  });

  let changed = 0;
  for (const file of candidates()) {
    const path = NodePath.join(root, file);
    const before = NodeFS.readFileSync(path, "utf8");
    const after = renameFile(file, before);
    if (after === before) continue;
    NodeFS.writeFileSync(path, after);
    changed += 1;
  }
  console.log(`Renamed T3 to C3 in ${changed} files.`);

  // The renamed English text of each old key, so a renamed string keeps its translations.
  const renameEn = (value: unknown) => JSON.stringify(value).replace(SOURCE, "C3");
  for (const { app, config, dir, oldEn } of catalogs) {
    const [command, ...args] = GENERATE[app]!;
    const tmp = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "c3-i18n-"));
    const tmpConfig = NodePath.join(tmp, "gt.config.json");
    NodeFS.writeFileSync(
      tmpConfig,
      JSON.stringify({ ...config, locales: [], files: { gt: { output: `${tmp}/[locale].json` } } }),
    );
    const gt = NodeChildProcess.spawnSync(command, [...args, "--config", tmpConfig], {
      cwd: NodePath.join(root, app),
      encoding: "utf8",
    });
    if (gt.status !== 0) throw new Error(`${app}: gt generate failed\n${gt.stdout}${gt.stderr}`);
    const newEn = readJson<Catalog>(NodePath.join(tmp, `${config.defaultLocale}.json`));
    NodeFS.rmSync(tmp, { recursive: true, force: true });

    const byText = new Map<string, string>();
    for (const [key, value] of Object.entries(oldEn)) {
      const renamed = renameEn(value);
      if (renamed !== JSON.stringify(value) && !byText.has(renamed)) byText.set(renamed, key);
    }
    const origin = new Map<string, string>();
    for (const [key, value] of Object.entries(newEn)) {
      const from = Object.hasOwn(oldEn, key) ? key : byText.get(JSON.stringify(value));
      if (from !== undefined) origin.set(key, from);
    }
    NodeFS.writeFileSync(
      NodePath.join(dir, `${config.defaultLocale}.json`),
      `${JSON.stringify(newEn, null, 2)}\n`,
    );
    for (const locale of config.locales) {
      const file = NodePath.join(dir, `${locale}.json`);
      const old = readJson<Catalog>(file);
      const next: Catalog = {};
      for (const key of Object.keys(newEn)) {
        const from = origin.get(key);
        if (from === undefined || !Object.hasOwn(old, from)) continue;
        let value = JSON.stringify(old[from]).split("T3-Code").join("C3-Code");
        if (from !== key) value = value.replace(LOCALE, "C3");
        next[key] = JSON.parse(value);
      }
      NodeFS.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
    }
    const moved = [...origin].filter(([key, from]) => key !== from).length;
    const untranslated = Object.keys(newEn).length - origin.size;
    console.log(`${app}: ${moved} keys renamed, ${untranslated} new keys need translations.`);
  }
}

if (import.meta.main) {
  if (process.argv.includes("--write")) {
    write();
  } else {
    const stale = check();
    if (stale > 0) {
      console.error(
        `${stale} lines still call the product T3. Run \`node scripts/fork-brand.ts --write\`.`,
      );
      process.exitCode = 1;
    } else {
      console.log("No user-visible source string calls the product T3.");
    }
  }
}
