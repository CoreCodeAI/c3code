# Agent maintenance

C3 Code is maintained by agents. They sync T3 Code into the fork, fix issues, review and merge
pull requests, and keep [LESSONS.md](../../LESSONS.md). A maintainer sets the rules, clears what an
agent stops on, and approves releases. This runbook says what each agent does, where it runs, what
it may touch, and when it must stop.

## The agents

| Agent   | Runs                        | Skill                                                                      | Produces                                                            |
| ------- | --------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Triage  | every 30 min                | [`contribution-triage`](../../.agents/skills/contribution-triage/SKILL.md) | A closed PR with a reason, `agent-review`, or `needs-maintainer`    |
| Fix     | every 30 min, one at a time | [`issue-fix`](../../.agents/skills/issue-fix/SKILL.md)                     | A PR for an issue labeled `agent:fix`                               |
| Review  | every 30 min                | [`pr-review`](../../.agents/skills/pr-review/SKILL.md)                     | A merge, a review comment, or `needs-maintainer`                    |
| Sync    | daily, 04:00 Asia/Shanghai  | [`upstream-sync`](../../.agents/skills/upstream-sync/SKILL.md)             | A `sync/upstream-<date>` PR                                         |
| Lessons | daily, 03:30 Asia/Shanghai  | [`nightly-lessons`](../../.agents/skills/nightly-lessons/SKILL.md)         | A PR to `LESSONS.md` and [review standards](07_review-standards.md) |

Each run is one headless Claude Code session that starts from a fresh worktree of `origin/main`,
loads its skill, and ends. A run that cannot finish leaves its branch unpushed or its PR open with a
comment saying where it stopped; the next run starts from GitHub's state, not from the last run's
memory. The writer of a change and its reviewer are always separate sessions.

Sync runs daily because T3 Code merges more than 200 commits on a busy day. A week of them is one
merge too large to review.

## Where they run

The agents run on a dedicated agent host, not in GitHub Actions, the way magpie's run outside its
CI. CI stays plain: [`ci.yml`](../../.github/workflows/ci.yml) and
[Fork invariants](../../.github/workflows/c3-fork-invariants.yml) on GitHub-hosted runners, with no
secrets.

- **The host is never an Actions runner for this repository.** This repository is public, so a
  self-hosted runner would run any fork's PR code on the host. The agents pull work through the
  GitHub API instead.
- **The host holds no CoreCode production access.** It has no service account roles, its own
  network with no route to the relay or the databases, and no workload identity binding.
- **A session never holds a write token.** Each session runs in a container started with an empty
  environment, the model key, and a GitHub App token minted for that run with read permissions
  only. Everything the session runs (installs, builds, tests, the PR's own code) runs there, so a
  postinstall script, a hostile PR, or a prompt injected through an issue can at most read public
  data and spend the model key's capped budget.
- **Writes go through the outbox.** A session asks for each write by appending it to its outbox
  with `c3-outbox`. When the session ends, a script on the host (no model involved) checks each
  request against [the gate below](#what-the-outbox-checks) and performs it with a token minted for
  that one write. The skills say which request each step makes; a maintainer running a skill by
  hand uses `gh` instead.
- **Tokens are short-lived.** Every GitHub token is an App installation token that expires within
  an hour. The model key is CoreCode's own API with a daily spending cap.

The host's deployment, its timers and the scripts that start each run belong to
[corecode-infra](https://github.com/CoreCodeAI/corecode-infra); this repository holds the rules the
agents follow.

## What the outbox checks

| Request                                 | The host performs it when                                                                                                                                                        | With                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `pr`: push a branch, open a PR          | the branch is not `main`, the push is a new branch or a fast-forward, and the PR targets `main`                                                                                  | writer                                  |
| `comment`, `label`, `close`             | the issue or PR is open, the labels are from [Labels](#labels), and none removes `needs-maintainer`                                                                              | writer, or reviewer for PRs it reviewed |
| `review` with `merge`                   | every merge-gate check below passes on the recorded head, `node scripts/harm-report.ts` run on the host from `origin/main` has no stop, and the author may be merged by an agent | reviewer                                |
| `review` with `changes` or `maintainer` | always                                                                                                                                                                           | reviewer                                |

A session makes each request with one line; the body is always a file the session wrote:

```sh
c3-outbox pr --branch <name> --title <title> --body-file <file> [--label <label>]...
c3-outbox comment <number> --body-file <file>
c3-outbox label <number> [--add <label>]... [--remove <label>]...
c3-outbox close <number> --body-file <file>
c3-outbox review <number> --head <sha> --verdict merge|changes|maintainer --body-file <file>
```

An agent may merge a PR whose author is the writer App, the maintainer, or someone listed in
[VOUCHED.td](../../.github/VOUCHED.td). For anyone else, a passing review ends at
`needs-maintainer` with "ready to merge" and the maintainer merges it. The host rejects any request
it cannot check and reports it in the run's log.

## Identities

| Identity                 | Can                                                                    | Cannot                      |
| ------------------------ | ---------------------------------------------------------------------- | --------------------------- |
| C3 writer (GitHub App)   | Push branches other than `main`, open PRs, comment, label              | Approve, merge, push `main` |
| C3 reviewer (GitHub App) | Review, set the `c3/agent-review` status, merge, close, label, comment | Push code                   |
| Maintainer               | Everything; the only code owner                                        |                             |

Neither App has the Administration or Secrets permission, so no agent can change the merge rules
or read a secret. Both have Workflows permission only because a sync carries T3's workflow changes.

## The merge gate

`main` takes changes only through a PR that has all of these. GitHub enforces each one through the
branch ruleset; the agents do not rely on remembering them.

1. CI and Fork invariants green on the head commit.
2. The `c3/agent-review` commit status set to success on that same head, by the reviewer App.
   A push after the review moves the head, and the new head has no status.
3. For a file in [CODEOWNERS](../../.github/CODEOWNERS), an approval from the maintainer.

The reviewer merges with `gh pr merge <number> --squash --match-head-commit <reviewed sha>`, so a
push during the review stops the merge. A sync PR merges with `--merge` instead, which keeps T3's
history and lets the next sync start from it.

CODEOWNERS lists the files that guard the agents: the invariants script and its workflow, the
workflow rewrite, the harm report, the sync script, the review and sync skills, this runbook, the
review standards, and CODEOWNERS itself. They exist only in this fork, so a sync never touches them,
and the maintainer is asked only when an agent wants to change its own guard. That includes a
nightly lesson promoted into the review standards.

## What stops for the maintainer

An agent labels the PR or issue `needs-maintainer`, says in one comment what stopped it and what
it needs, and moves on. It does not argue, retry, or work around the stop.

- Anything on the harm list in [CONTRIBUTING.md](../../CONTRIBUTING.md#look-for-harm-first),
  except a sync whose `.github/` changes are exactly T3's, rewritten by
  [`fork-workflows.ts`](../../scripts/fork-workflows.ts).
  [`harm-report.ts`](../../scripts/harm-report.ts) with `--upstream` decides that.
- A sync that adds a `secrets.` reference or an action from a new owner.
- A product decision: a change in how C3 Code behaves that no maintainer has approved in an issue.
- A change that would undo a decision recorded in [AGENTS.md](../../AGENTS.md) or an internal doc.
- A release.

## Labels

| Label              | Set by                     | Means                                                                                      |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------ |
| `agent:fix`        | Maintainer                 | An agent may take this issue.                                                              |
| `agent-review`     | Triage, Fix, Sync, Lessons | Ready for the reviewer.                                                                    |
| `needs-maintainer` | Any agent                  | Stopped; the comment says why. Agents leave it alone until a maintainer removes the label. |
| `upstream-sync`    | Sync                       | A merge of T3 Code.                                                                        |
| `triage:closing`   | Triage                     | [pr-limits](../../.github/workflows/pr-limits.yml) closes the PR in 72 hours.              |

Only people with triage access can label, so a stranger cannot hand an issue to the Fix agent.

## Setup checklist

The maintainer does these once; an agent asks rather than doing any of them.

1. In the repository settings, enable Actions, Issues and Discussions (a fork starts with all three
   off), and create the labels above.
2. Create the writer and reviewer GitHub Apps with the permissions above, install both on
   `CoreCodeAI/c3code` only, and keep their private keys on the agent host.
3. Add a branch ruleset on `main`: require a PR, require the CI checks, Fork invariants and
   `c3/agent-review` (source: the reviewer App), require code owner review, block force pushes and
   deletion, and allow no bypass.
4. Provision the agent host from corecode-infra, with a CoreCode API key whose daily cap matches
   the budget.
5. Before release secrets exist, put them in a `release` environment that requires the
   maintainer's approval, so no workflow change can reach them unreviewed.

## Starting and stopping

Each agent is a systemd timer on the host. Stop one with `systemctl stop c3-<agent>.timer`; stop
all with `systemctl stop c3-agents.target`. To pause merges without stopping the host, remove the
reviewer App's installation; the writer keeps opening PRs and nothing lands.
