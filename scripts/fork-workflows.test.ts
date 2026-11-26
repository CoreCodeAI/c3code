import { describe, expect, it } from "vite-plus/test";

import { guardJobs, rewriteRunners, rewriteWorkflow } from "./fork-workflows.ts";

describe("rewriteRunners", () => {
  it("moves each Blacksmith label to the hosted runner of the same OS", () => {
    const text = [
      "    runs-on: blacksmith-8vcpu-ubuntu-2404",
      "    runs-on: blacksmith-4vcpu-ubuntu-2404-arm",
      "      runner: blacksmith-6vcpu-macos-27",
      "          - os: blacksmith-8vcpu-windows-2025",
    ].join("\n");
    expect(rewriteRunners(text)).toBe(
      [
        "    runs-on: ubuntu-24.04",
        "    runs-on: ubuntu-24.04-arm",
        "      runner: macos-26",
        "          - os: windows-2025",
      ].join("\n"),
    );
  });

  it("doubles the timeout of each job it moves, and only those", () => {
    const text = [
      "jobs:",
      "  test:",
      "    runs-on: blacksmith-8vcpu-ubuntu-2404",
      "    timeout-minutes: 10",
      "    steps:",
      "      - run: vp test",
      "        timeout-minutes: 5",
      "  notify:",
      "    runs-on: ubuntu-24.04",
      "    timeout-minutes: 5",
    ].join("\n");
    const moved = rewriteRunners(text);
    expect(moved).toContain("    runs-on: ubuntu-24.04\n    timeout-minutes: 20");
    expect(moved).toContain("        timeout-minutes: 5\n  notify:");
    expect(moved.endsWith("    timeout-minutes: 5")).toBe(true);
    expect(rewriteRunners(moved)).toBe(moved);
  });

  it("leaves comments, other keys and mirror paths alone", () => {
    const text = [
      "    runs-on: ubuntu-24.04 # blacksmith-8vcpu-ubuntu-2404",
      "      - uses: useblacksmith/stickydisk@v1",
      "          /etc/apt/blacksmith-ubuntu-mirrors.txt /etc/apt/sources.list.d/ubuntu.sources",
    ].join("\n");
    expect(rewriteRunners(text)).toBe(text);
  });
});

describe("guardJobs", () => {
  it("adds the guard to a block condition, a one-line condition and a job without one", () => {
    const text = [
      "jobs:",
      "  build:",
      "    if: >-",
      "      github.event.label.name == 'preview:mac'",
      "    runs-on: ubuntu-24.04",
      "  deploy:",
      "    if: ${{ github.event_name != 'pull_request_target' }}",
      "    runs-on: ubuntu-24.04",
      "  cleanup:",
      "    runs-on: ubuntu-24.04",
    ].join("\n");
    expect(guardJobs("x.yml", text, ["build", "deploy", "cleanup"])).toBe(
      [
        "jobs:",
        "  build:",
        "    if: >-",
        "      github.repository == 'pingdotgg/t3code' &&",
        "      github.event.label.name == 'preview:mac'",
        "    runs-on: ubuntu-24.04",
        "  deploy:",
        "    if: github.repository == 'pingdotgg/t3code' && (github.event_name != 'pull_request_target')",
        "    runs-on: ubuntu-24.04",
        "  cleanup:",
        "    if: github.repository == 'pingdotgg/t3code'",
        "    runs-on: ubuntu-24.04",
      ].join("\n"),
    );
  });

  it("is idempotent", () => {
    const once = rewriteWorkflow(
      "web-preview.yml",
      ["jobs:", "  deploy:", "    if: github.ref == 'refs/heads/main'", "    runs-on: x"].join(
        "\n",
      ),
    );
    expect(rewriteWorkflow("web-preview.yml", once)).toBe(once);
  });

  it("fails loudly when upstream renames a guarded job", () => {
    expect(() => guardJobs("web-preview.yml", "jobs:\n  ship:\n", ["deploy"])).toThrow(
      /job deploy not found/,
    );
  });
});
