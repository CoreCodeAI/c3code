---
name: upstream-sync
description: Merge T3 Code's main into C3 Code on a sync branch, resolve conflicts by the fork's rules, verify, and open the sync PR. Use for the daily sync run or when a maintainer asks for a sync. Not for cherry-picking a single upstream fix.
---

# Upstream sync

Bring `pingdotgg/t3code` main into C3 Code without losing what makes the fork: no data collection,
C3 branding, its own app identity, and links to `CoreCodeAI/c3code`. Read
[AGENTS.md](../../../AGENTS.md) ("This is a fork"), [Product analytics](../../../docs/internals/08_product-analytics.md)
and the sync section of [review standards](../../../docs/operations/07_review-standards.md#upstream-syncs) first.

## Start

1. Work in a fresh worktree of `origin/main` inside the sandbox, with dependencies installed.
2. Run `bash scripts/upstream-sync.sh`.
   - Exit 3: nothing to sync. Stop and report that.
   - Exit 0: merged and committed. Go to Verify.
   - Exit 2: resolve the listed conflicts as below.
   - Exit 1: report the error and stop.
3. If a `sync/upstream-*` PR is already open, do not start another. Rebase nothing; report it.

## Resolve conflicts

For each conflicted file, read both sides and the fork's reason for its side
(`git log origin/main -- <file>`). Keep T3's change and the fork's rule together:

- **Telemetry, analytics, crash reporting, install or account ids.** Keep the fork's removal. If
  T3 extended the removed code, drop the extension too.
- **Branding.** Keep C3 wording and links to `CoreCodeAI/c3code`. Take T3's new logic around them.
- **App identity.** Keep the fork's ids, home directory, port and service names.
- **Translation catalogs.** The script merges them by key. A key it reports as changed on both
  sides keeps the fork's value; `fork-brand.ts --write` below rebuilds every catalog from the
  merged source.
- **Workflows.** Take T3's version, then `node scripts/fork-workflows.ts --write`. Re-apply a fork
  edit only if `git diff <last-sync>..origin/main -- <file>` shows one beyond the rewrite.
- **Everything else.** Take T3's version unless the fork changed the same lines for a reason above.

Never resolve by deleting a T3 feature to make the conflict go away. If a conflict needs a product
decision, finish the rest, commit, and stop at `needs-maintainer` with the question.

Then run `node scripts/fork-brand.ts --write`, `git add -u`, and
`git commit -F "$(git rev-parse --git-dir)/C3_SYNC_MESSAGE"`.

## Verify

Run each and record what it printed:

1. `bash scripts/check-fork-invariants.sh`
2. `node scripts/fork-brand.ts` and `node scripts/fork-workflows.ts`
3. `vp run i18n:check` (new T3 strings need their translations carried over or added)
4. `vp run typecheck` and `vp run lint`
5. `vp test run` on the test files of every conflicted file
6. `node scripts/harm-report.ts origin/main HEAD --upstream upstream/main`

Fix what fails in a follow-up commit on the branch. A failure that also fails on `upstream/main`
is T3's; note it in the PR body and do not fix it here.

## Open the PR

Request the PR to `CoreCodeAI/c3code` main:

```sh
c3-outbox pr --branch <sync branch> --title "chore: merge T3 Code <short sha>" --body-file pr.md \
  --label upstream-sync --label agent-review
```

The host pushes the branch and opens the PR. The body lists:

- the commit count and range;
- each conflict and how it was resolved, and any T3 change dropped, with the reason;
- new outbound hosts and how each was handled (listed in privacy.md, or removed);
- the checks above and their results;
- the harm report, verbatim.

If the harm report has stops, use `--label needs-maintainer` instead of `--label agent-review` and
say which stop needs a decision. End the body with the model and harness that did the work. A
maintainer running this skill by hand pushes and opens the PR with `gh`.
