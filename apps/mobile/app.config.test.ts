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
  [undefined, "com.t3tools.t3code"],
  ["development", "com.t3tools.t3code.dev"],
  ["preview", "com.t3tools.t3code.preview"],
  ["production", "com.t3tools.t3code"],
])("keeps the iOS and Android identifiers for APP_VARIANT=%j", async (value, identifier) => {
  const config = await loadConfig(value);
  expect(config.ios?.bundleIdentifier).toBe(identifier);
  expect(config.android?.package).toBe(identifier);
  expect(appleAppSiteAssociation.applinks.details[0]?.appIDs).toContain(
    `${config.ios?.appleTeamId}.${identifier}`,
  );
  expect(assetLinks.map((link) => link.target.package_name)).toContain(identifier);
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
