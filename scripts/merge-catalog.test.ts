import { describe, expect, it } from "vite-plus/test";

import { mergeCatalogs } from "./merge-catalog.ts";

describe("mergeCatalogs", () => {
  const base = { kept: "Kept", renamed: "Open T3 home", dropped: "Old", edited: "Before" };

  it("keeps the fork's renames and takes T3's additions, edits and removals", () => {
    const ours = { kept: "Kept", renamedC3: "Open C3 home", dropped: "Old", edited: "Before" };
    const theirs = { kept: "Kept", renamed: "Open T3 home", edited: "After", added: "New" };
    expect(mergeCatalogs(base, ours, theirs)).toEqual({
      merged: { kept: "Kept", renamedC3: "Open C3 home", edited: "After", added: "New" },
      conflicts: [],
    });
  });

  it("accepts a change both sides made the same way", () => {
    const both = { ...base, edited: "After" };
    expect(mergeCatalogs(base, both, both).conflicts).toEqual([]);
  });

  it("reports a key both sides changed differently and leaves the fork's value", () => {
    const ours = { ...base, edited: "Fork" };
    const theirs = { ...base, edited: "T3" };
    expect(mergeCatalogs(base, ours, theirs)).toEqual({ merged: ours, conflicts: ["edited"] });
  });

  it("reports a key the fork removed and T3 changed", () => {
    const { renamed: _, ...ours } = base;
    const theirs = { ...base, renamed: "Open T3 home now" };
    expect(mergeCatalogs(base, ours, theirs).conflicts).toEqual(["renamed"]);
  });
});
