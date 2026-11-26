import { afterEach, expect, it, vi } from "vite-plus/test";

import appleAppSiteAssociation from "../web/public/.well-known/apple-app-site-association.json";
import assetLinks from "../web/public/.well-known/assetlinks.json";

// Keep config parsing independent of local env files and build credentials.
vi.mock("../../scripts/lib/public-config.ts", () => ({
  loadRepoEnv: () => ({
    APP_VARIANT: process.env.APP_VARIANT,
    T3CODE_HOSTED_APP_URL: process.env.T3CODE_HOSTED_APP_URL,
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

async function loadConfig(variant: string | undefined, hostedAppUrl?: string) {
  vi.resetModules();
  vi.stubEnv("APP_VARIANT", variant);
  vi.stubEnv("T3CODE_HOSTED_APP_URL", hostedAppUrl);
  return (await import("./app.config.ts")).default;
}

it.each(["prod", ""])("rejects APP_VARIANT=%j before selecting production IDs", async (value) => {
  await expect(loadConfig(value)).rejects.toThrow(
    "APP_VARIANT must be development, preview, or production.",
  );
});

it.each([
  [undefined, "live.corecode.c3code"],
  ["development", "live.corecode.c3code.dev"],
  ["preview", "live.corecode.c3code.preview"],
  ["production", "live.corecode.c3code"],
])(
  "uses C3 Code's own iOS and Android identifiers for APP_VARIANT=%j",
  async (value, identifier) => {
    const config = await loadConfig(value);
    expect(config.ios?.bundleIdentifier).toBe(identifier);
    expect(config.android?.package).toBe(identifier);
  },
);

it("claims no sign-in domain or Apple team unless the build names them", async () => {
  const config = await loadConfig("production");
  expect(config.ios?.appleTeamId).toBeUndefined();
  expect(config.ios?.associatedDomains).toEqual([]);
});

it("lists no app in the web app's association files", () => {
  expect(appleAppSiteAssociation.applinks.details).toEqual([]);
  expect(assetLinks).toEqual([]);
});

it("claims no hosted app's thread links unless the build names one", async () => {
  const config = await loadConfig("production");
  expect(config.ios?.associatedDomains).not.toContain("applinks:app.t3.codes");
  expect(config.android?.intentFilters).toEqual([]);
});

it("opens a configured hosted app's thread links", async () => {
  const config = await loadConfig("production", "https://app.example.com");
  expect(config.ios?.associatedDomains).toContain("applinks:app.example.com");
  expect(config.android?.intentFilters?.[0]?.data).toEqual([
    { scheme: "https", host: "app.example.com", pathPrefix: "/threads/" },
  ]);
});
