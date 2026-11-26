---
name: nightly-lessons
description: Review the C3 Code commits merged since LESSONS.md's reviewed-through marker for what had to be fixed again, merged too early, or was verified too thinly, and record the lessons. Use for the nightly Lessons run. Not for reviewing an open PR.
---

# Nightly lessons

[LESSONS.md](../../../LESSONS.md) is what recent merged work got wrong and the rule that would have
caught it. Each run reviews one day of merges and updates it.

## Collect

1. Read the marker on the first line: `<!-- reviewed-through: <sha> (<date>) -->`.
2. List `git log --first-parent <sha>..origin/main`. For each merged PR, read its review comments
   (especially `Lesson:` lines), any follow-up commit that fixed it again, and any revert.
3. For an upstream sync, look only at the fork's conflict resolutions and follow-up fixes, not at
   T3's commits.

Look for: a fix that needed a second fix, a change reverted, a review that missed what CI or a user
then caught, a check claimed but not run, and a fork rule (privacy, branding, identity) broken and
repaired.

## Record

- A pattern already in LESSONS.md: add the new evidence and bump `Seen` with the date.
- A new pattern: add a lesson under the closest heading. A lesson is one rule in bold, a sentence on
  why, the evidence as PR numbers and short SHAs, and `Seen 1× (<date>)`.
- A lesson seen on three separate days: move its rule into
  [review standards](../../../docs/operations/07_review-standards.md) and delete it here.
- A lesson that no longer applies: delete it.

Write rules, not stories. A day with nothing new changes only the marker.

## Finish

Set the marker to the last commit reviewed, commit on `docs/lessons-<short sha>`, and request the PR:

```sh
c3-outbox pr --branch docs/lessons-<short sha> --title "docs: lessons through <short sha>" \
  --body-file pr.md --label agent-review
```

The body lists each lesson added, extended, promoted, or removed. A promotion edits the review
standards, which CODEOWNERS covers, so that PR also waits for the maintainer's approval.
