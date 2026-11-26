# Review standards

What a change must show before an agent merges it, and what a reviewer checks. These rules come
from what reviews keep asking for; [LESSONS.md](../../LESSONS.md) feeds new ones in. A lesson seen on
three separate days moves here.

## Acceptance criteria

A PR is merged only when it shows each of these that applies. The PR body says which were run and
what they printed. A check that was not run is listed as not run, never left out.

1. **A test that fails without the change.** For a fix, put the old code back and run the new test:
   it must fail with an assertion that names the behavior. A compile error or a skipped test does
   not count. Then restore the change and run it green. See
   [bug-fix proof](../internals/15_testing.md).
2. **The changed checks.** `vp run check:changed`, plus `vp test run <files>` for each test the
   change touches. CI runs the full suite; a reviewer does not rerun it.
3. **The fork invariants.** `bash scripts/check-fork-invariants.sh` passes, which includes
   `node scripts/fork-workflows.ts`. A new outbound connection has its row in
   [Privacy and network calls](../user/privacy.md).
4. **Real use for what a user sees.** A change in the web or desktop UI gets one pass in a running
   app through `test-t3-app`, with before and after screenshots on the PR. A mobile change uses
   `test-t3-mobile`, or says it could not run.
5. **Tests stay off the real machine.** No test, script, or dev server reads or writes the live
   install's home or a real provider's sign-in files. Use a temporary home and copied data, as
   [AGENTS.md](../../AGENTS.md#the-three-ways-to-hurt-yourself) says.

## Reviewing a PR

Before anything below, read the diff against the harm list in
[CONTRIBUTING.md](../../CONTRIBUTING.md#look-for-harm-first) and run
`node scripts/harm-report.ts origin/main <head>`. Any stop ends the review.

- **Run it.** Check out the head merged onto current `main` in the sandbox and run the acceptance
  checks. Reading the diff alone is not a review.
- **Break it on purpose.** Revert the fix, or break the code it guards in two or three ways, and
  check that the new test catches each one.
- **Follow the whole path.** Trace the change from the user's action to the result, through
  contracts, server, web, desktop and mobile. Walk the [surfaces list](../../AGENTS.md#hit-every-surface)
  and note which entries applied.
- **Check the vendor, not the PR's account of it.** For a provider change, read the provider CLI's
  own source or docs for the behavior the PR relies on.
- **Classify narrowly.** An error class or status covers only the case it describes.
- **A preview writes nothing.** A dry run, plan or preview has no side effects.
- **Don't reverse deliberate decisions.** A change to something AGENTS.md, an internal doc, or
  `docs/user/privacy.md` decided is left for the maintainer.
- **Docs match the source.** Every link in a changed doc resolves, and every claim matches the code
  it names.
- **Keep the PR to its goal.** Unrelated refactors, tests and fixes go in a PR of their own.

The review ends in one of three outcomes: merge (set `c3/agent-review` on the reviewed head, then
`gh pr merge --match-head-commit`), a review comment naming each unmet rule, or `needs-maintainer`.

## Upstream syncs

A sync PR is reviewed like any other, plus:

- `node scripts/harm-report.ts origin/main <head> --upstream upstream/main` shows `.github/`
  changes that are only T3's, rewritten by `fork-workflows.ts`, no new `secrets.` reference, and
  no action from a new owner.
- Every new outbound host in shipped code is either a user-chosen provider endpoint, listed in
  [Privacy and network calls](../user/privacy.md), or removed. Telemetry, analytics and crash
  reporting are removed; see [Product analytics](../internals/08_product-analytics.md).
- New user-visible text says C3, not T3, where the fork renamed it, and keeps its translations.
- A conflict resolution that dropped a T3 change says why in the PR body.

## Commits

A commit title says what the user now sees, in plain words: `fix(web): new threads no longer spike
CPU`. The body says how it was verified and which test fails without it, and ends with the model and
harness that wrote it.
