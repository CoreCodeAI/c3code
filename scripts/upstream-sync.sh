#!/usr/bin/env bash
# Starts a sync of T3 Code into C3 Code: a `sync/upstream-<date>` branch from origin/main with
# upstream/main merged in, then the fork's mechanical rewrites applied again. A conflicting
# workflow the fork only rewrote takes T3's version and is rewritten again; a conflicting
# translation catalog is merged by key (scripts/merge-catalog.ts); every other conflict is left for
# the agent, which follows .agents/skills/upstream-sync/SKILL.md.
#
# Exit 0: merged and committed. 2: conflicts remain (listed). 3: nothing to sync. 1: error.
# C3_SYNC_BASE overrides the base (default origin/main), to rehearse a sync on an unpushed branch.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "The worktree has uncommitted changes; start from a clean worktree of origin/main." >&2
  exit 1
fi
git remote get-url upstream >/dev/null 2>&1 ||
  git remote add upstream https://github.com/pingdotgg/t3code.git
git fetch --quiet origin main
git fetch --quiet upstream main

base=${C3_SYNC_BASE:-origin/main}
upstream=$(git rev-parse upstream/main)
short=$(git rev-parse --short upstream/main)
if git merge-base --is-ancestor "$upstream" "$base"; then
  echo "$base already contains T3 Code $short."
  exit 3
fi
last=$(git merge-base "$base" "$upstream")
count=$(git rev-list --count "$last..$upstream")

branch="sync/upstream-$(date -u +%Y%m%d)"
n=2
while git show-ref --quiet "refs/heads/$branch" ||
  git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; do
  branch="sync/upstream-$(date -u +%Y%m%d)-$n"
  n=$((n + 1))
done
git switch --quiet -c "$branch" "$base"
echo "Merging T3 Code $short ($count commits since $(git rev-parse --short "$last")) on $branch."

# True when the fork's copy of a workflow is exactly T3's copy at the last sync, rewritten.
only_rewritten() {
  node --input-type=module -e '
    import { execFileSync } from "node:child_process";
    const { rewriteWorkflow } = await import(`${process.cwd()}/scripts/fork-workflows.ts`);
    const [last, path, base] = process.argv.slice(1);
    const show = (ref) => {
      try {
        return execFileSync("git", ["show", `${ref}:${path}`], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch {
        return "";
      }
    };
    process.exit(rewriteWorkflow(path.split("/").pop(), show(last)) === show(base) ? 0 : 1);
  ' "$last" "$1" "$base"
}

message="Merge T3 Code $short into C3 Code

$count commits from pingdotgg/t3code since $(git rev-parse --short "$last")."
git -c rerere.enabled=true -c rerere.autoUpdate=true merge --no-ff --no-commit "$upstream" >/dev/null 2>&1 || true
if ! git rev-parse --quiet --verify MERGE_HEAD >/dev/null; then
  echo "git could not start the merge of $short." >&2
  exit 1
fi

while IFS= read -r path; do
  [ -n "$path" ] || continue
  case "$path" in
    .github/workflows/*.yml | .github/workflows/*.yaml)
      if only_rewritten "$path"; then
        if git cat-file -e "$upstream:$path" 2>/dev/null; then
          git show "$upstream:$path" >"$path"
          git add "$path"
        else
          git rm --quiet "$path"
        fi
        echo "Took T3's $path; the rewrite below adapts it."
      fi
      ;;
    apps/*/src/i18n/translations/*.json)
      if node scripts/merge-catalog.ts "$path"; then git add "$path"; fi
      ;;
  esac
done < <(git diff --name-only --diff-filter=U)

node scripts/fork-workflows.ts --write
git add .github/workflows

conflicts=$(git diff --name-only --diff-filter=U)
if [ -n "$conflicts" ]; then
  echo
  echo "Resolve these conflicts, then run \`node scripts/fork-brand.ts --write\` and commit:"
  printf '%s\n' "$conflicts" | sed 's/^/  /'
  printf '%s\n' "$message" >"$(git rev-parse --git-dir)/C3_SYNC_MESSAGE"
  exit 2
fi

node scripts/fork-brand.ts --write
git add -u
git commit --quiet -m "$message"
echo "Committed $(git rev-parse --short HEAD). Next: the checks in the upstream-sync skill."
