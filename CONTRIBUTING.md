# Contributing

C3 Code is CoreCode's unofficial fork of [T3 Code](https://github.com/pingdotgg/t3code). It is not
affiliated with T3 Tools, Inc. Contribute to C3 Code here; a change that would help T3 Code as well
belongs upstream first.

We are bottlenecked by review capacity, not by ideas or code. Bug fixes are the most likely to be
merged. Put feature requests in
[Ideas discussions](https://github.com/CoreCodeAI/c3code/discussions/categories/ideas) before you
write them.

## What every change must keep

- **No data collection.** A change that adds analytics, crash or error reporting, usage events,
  install or device IDs, or a call home is closed. A new network call must serve the user directly
  and be listed in [Privacy and network calls](docs/user/privacy.md).
- **C3 branding.** Use the C3 name and mark, never T3 Code's. See [TRADEMARK.md](./TRADEMARK.md).
- **Links to this repository.** Install, release, update, issue, and docs links point at
  `CoreCodeAI/c3code`.

`scripts/check-fork-invariants.sh` checks these in CI.

## How PRs are reviewed

Agents triage, review and merge PRs here ([agent maintenance](docs/operations/06_agent-maintenance.md)).
A maintainer clears what they stop on.

<a id="look-for-harm-first"></a>

### Look for harm first

Before any PR is run, its diff is read for anything that reaches past its stated goal. Any one of
these stops the review until a maintainer has looked:

- It changes `.github/` (workflows, actions, permissions), a release, install or publish script,
  `packaging/`, or a Dockerfile.
- It adds a network address, an upload, telemetry, or sends a credential, token, cookie or file
  anywhere it did not go before.
- It reads or writes a credential file, keychain entry, or agent config the goal does not need.
- It adds a dependency, an install script, a binary, a minified or encoded blob, or code built from
  a string at run time.
- It adds a relay, reseller, or affiliate address.

The review says which line stopped it. A stopped PR's code is not run on a machine with real
accounts until a maintainer has cleared it.

<a id="closed-unreviewed"></a>

### Closed without a full review

A PR is closed with a short reason, without being run, when it changes a decision a maintainer made,
resubmits a PR closed for its idea with nothing new to answer the reason, or is one of several
near-identical PRs opened within minutes.

## Rules for a PR

These rules apply to every PR from outside the team, drafts included. A PR that follows them can
still be closed; we do not owe a review or a merge.

<a id="prior-approval"></a>

### Fix a bug, or link the approval

A PR fixes a bug: a crash, a regression, or a real performance problem. A change to how the product
behaves is a feature, even when the PR calls it a fix, and it needs a maintainer's approval in an
issue or discussion first. Link it.

<a id="vouched-features"></a>

Contributors a maintainer has vouched for can open a small, focused feature PR without approval.

<a id="one-problem"></a>

### One problem per PR

Fix one problem. Include every change that fix needs across contracts, server, clients, tests, and
docs. Cleanup, refactors, and a second fix go in their own PRs.

<a id="verification"></a>

### Show that it works

Say how you found the bug (or what your feature changes), how you checked it, and what you saw.
"Tests pass" is not evidence. UI changes need before and after screenshots, and a short video when
the change is about motion or timing. Upload them to the PR; do not commit them.

<a id="models"></a>

### Say which model wrote it

Name the model and tool that wrote the code in the PR body.

<a id="bans"></a>

## Bans

Spam, automation abuse, repeated pings, fights over a closure, and second accounts to get around a
rule get an account banned. So does three or more PRs closed as low-value with fewer than a third
merged, resubmitting after an explicit rejection twice, or hiding a change outside a PR's goal. An
agent proposes a ban with the PR numbers; a maintainer decides. A banned account's issues and PRs
are closed when they are opened.

<a id="closure-and-reconsideration"></a>

## When your PR is closed

A PR that breaks a rule gets a comment that names the rule. Fix the problem and comment on the PR,
or open a focused replacement PR that links the old one.

## Setup

See the [development runbook](docs/operations/00_development.md#first-checkout).
