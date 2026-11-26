// C3 Code has no website: its privacy notes, security policy, license, and trademark notice live
// in the repository, so the legal screen shows them from GitHub.
const REPOSITORY_FILES_URL = "https://github.com/CoreCodeAI/c3code/blob/main/";

function repositoryDocumentUrl(path: string): string {
  return new URL(path, REPOSITORY_FILES_URL).toString();
}

export const LEGAL_URL = repositoryDocumentUrl("docs/user/privacy.md");
const SECURITY_POLICY_URL = repositoryDocumentUrl(".github/SECURITY.md");
const LICENSE_URL = repositoryDocumentUrl("LICENSE");
const TRADEMARK_URL = repositoryDocumentUrl("TRADEMARK.md");

const ALLOWED_LEGAL_DOCUMENT_URLS = [
  LEGAL_URL,
  SECURITY_POLICY_URL,
  LICENSE_URL,
  TRADEMARK_URL,
] as const;

function webDocumentIdentity(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.origin}${pathname}`;
  } catch {
    return null;
  }
}

const ALLOWED_LEGAL_DOCUMENT_IDENTITIES = new Set(
  ALLOWED_LEGAL_DOCUMENT_URLS.map(webDocumentIdentity).filter(
    (value): value is string => value !== null,
  ),
);

export function isLegalDocumentUrl(value: string): boolean {
  const identity = webDocumentIdentity(value);
  return identity !== null && ALLOWED_LEGAL_DOCUMENT_IDENTITIES.has(identity);
}
