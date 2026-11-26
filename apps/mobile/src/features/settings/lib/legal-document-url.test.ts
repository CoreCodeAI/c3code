import { describe, expect, it } from "vite-plus/test";

import { isLegalDocumentUrl, LEGAL_URL } from "./legal-document-url";

describe("isLegalDocumentUrl", () => {
  it.each([
    "https://example.com/legal",
    "javascript:alert(1)",
    "https://t3.codes/privacy-policy",
    "https://github.com/CoreCodeAI/c3code/blob/main/README.md",
  ])("rejects a URL outside the legal-document allowlist: %s", (url) => {
    expect(isLegalDocumentUrl(url)).toBe(false);
  });

  it.each([
    LEGAL_URL,
    `${LEGAL_URL}#what-c3-code-connects-to`,
    "https://github.com/CoreCodeAI/c3code/blob/main/.github/SECURITY.md",
    "https://github.com/CoreCodeAI/c3code/blob/main/LICENSE/",
    "https://github.com/CoreCodeAI/c3code/blob/main/TRADEMARK.md",
  ])("accepts the repository's own legal documents: %s", (url) => {
    expect(isLegalDocumentUrl(url)).toBe(true);
  });
});
