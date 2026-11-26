<!-- reviewed-through: 794e72cf5 (2026-11-26) -->

# Lessons

What recent C3 Code work got wrong, and the rule that would have caught it. The
[`nightly-lessons`](.agents/skills/nightly-lessons/SKILL.md) run adds to this file from the commits
merged since the marker above. Agents read it before writing or reviewing a change.

Each lesson is a rule in bold, why it matters, the evidence, and how often it was seen. A lesson
seen on three separate days moves into [review standards](docs/operations/07_review-standards.md)
and leaves this file. A lesson that no longer applies is deleted.

## Fork

**Run every workflow on a runner the fork can use.** T3's workflows ask for Blacksmith runners,
which this repository has no access to, so their jobs queue until they time out and never report a
result. Evidence: the fork's first CI change; fixed by `scripts/fork-workflows.ts`. Seen 1×
(2026-11-26).

**Rename user-visible text through `scripts/fork-brand.ts`, not by hand.** The web, desktop and
mobile catalogs key each translation by a hash of its English text, so a hand-edited string loses
its translations in every other language at the next `i18n:generate`. Evidence: 794e72cf5. Seen 1× (2026-11-26).

**Search tests and fixtures for the old name, not only shipped code.** A test title still called a
C3 tool a T3 tool after the rename, and only the brand check found it. Evidence: 794e72cf5. Seen 1×
(2026-11-26).

## Checks

**Say what a check runs only after running it.** The review standards said
`check-fork-invariants.sh` included `fork-workflows.ts`; it never did, so a reviewer following them
would have skipped the workflow check. Evidence: 7278cc051, fixed in 4ac320624 with
`vp run fork:check`. Seen 1× (2026-11-26).
