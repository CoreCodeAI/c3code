#!/usr/bin/env bash
# Fails when a change breaks one of C3 Code's fork rules (see AGENTS.md, "This is a fork"):
# no data collection, no hosted T3 service or project baked in, no product link that sends
# users to T3 Code's site, npm package, installer, or store listings, and no T3 Code app id,
# home, port, or service name that would make the two collide on one machine. Runs on any
# checkout with git. Each check prints how many files it read; a check that reads none fails,
# so a renamed file cannot turn it into a silent pass.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 2
failures=0

fail() {
  printf 'fork invariant broken: %s\n' "$1" >&2
  if [ -n "${2:-}" ]; then printf '%s\n' "$2" | sed 's/^/  /' >&2; fi
  failures=$((failures + 1))
}

# Product code: what users run. The upstream marketing site, relay infrastructure, evals, tests,
# fixtures, and vendored GraphQL schemas are not shipped in the apps. A wildcard pathspec matches
# whole paths, so `packages/*/src` alone would match no file: it needs the trailing `/*`.
PRODUCT=(
  'apps/server/src' 'apps/web/src' 'apps/desktop/src' 'apps/mobile/src' 'apps/mobile/modules'
  'apps/mobile/app.config.ts' 'apps/mobile/plugins' 'packages/*/src/*' 'scripts/install.sh'
  'scripts/install.ps1'
  ':!*.test.*' ':!*.spec.*' ':!**/testkit/**' ':!**/fixtures/**' ':!**/__fixtures__/**'
  ':!**/*.graphql' ':!**/*.md'
)

# Counts the tracked files a pathspec names, and fails the check when it names none.
checked_files() {
  local description=$1
  shift
  local count
  count=$(git ls-files -- "$@" | wc -l | tr -d '[:space:]')
  printf '%5d files: %s\n' "$count" "$description"
  if [ "$count" -eq 0 ]; then fail "$description: the pathspec matches no file" "$*"; fi
}

no_match() {
  local description=$1 pattern=$2
  shift 2
  checked_files "$description" "$@"
  local hits
  hits=$(git grep -nIE "$pattern" -- "$@" 2>/dev/null | cut -c1-200)
  if [ -n "$hits" ]; then fail "$description" "$hits"; fi
}

# Fails unless every named file exists and contains the fixed string.
must_contain() {
  local description=$1 needle=$2
  shift 2
  checked_files "$description" "$@"
  local file
  for file in "$@"; do
    if [ ! -f "$file" ]; then
      fail "$description: $file is missing"
    elif ! grep -qF -- "$needle" "$file"; then
      fail "$description: $file no longer has $needle"
    fi
  done
}

# 1. No analytics, tracing, or crash-reporting SDKs among the dependencies.
no_match "a telemetry SDK is a dependency" \
  '"(posthog-js|posthog-node|posthog-react-native|expo-observe|@sentry/[a-z-]+|@bugsnag/[a-z-]+|@datadog/[a-z-]+|@axiomhq/[a-z-]+|mixpanel[a-z-]*|@amplitude/[a-z-]+|@segment/[a-z-]+)"[[:space:]]*:' \
  'package.json' 'apps/*/package.json' 'packages/*/package.json'

# 2. None of the removed collection pipelines come back.
no_match "a removed telemetry pipeline is back" \
  'ingest\.t3\.codes|T3CODE_TELEMETRY_ENABLED|telemetryId|relayTracing|posthog|expo-observe|ExpoObserve' \
  "${PRODUCT[@]}" ':!packages/contracts/src/relay.ts'

# 3. Agent feedback stays on the machine: a stored report never reads as sent.
if ! grep -q 'sent: 0,' apps/server/src/feedback/FeedbackStore.ts; then
  fail "FeedbackStore no longer stores every report as unsent (sent: 0)"
fi
if ! grep -q 'withAgentFeedbackOff(' apps/server/src/serverSettings.ts; then
  fail "serverSettings.ts no longer holds agent feedback off (withAgentFeedbackOff)"
fi

# 4. Agent CLIs are asked not to send their own telemetry.
for name in DO_NOT_TRACK DISABLE_TELEMETRY CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC; do
  if ! grep -q "$name: \"1\"" packages/provider-core/src/server/instanceEnvironment.ts; then
    fail "PROVIDER_TELEMETRY_OPT_OUT_ENV no longer sets $name"
  fi
done

# 5. Releases and update checks come from this repository.
if ! grep -q 'const CLI_RELEASE_REPOSITORY = "CoreCodeAI/c3code";' packages/shared/src/cliRelease.ts; then
  fail "CLI_RELEASE_REPOSITORY is not CoreCodeAI/c3code"
fi
if ! grep -q '^repo="CoreCodeAI/c3code"$' scripts/install.sh; then
  fail "scripts/install.sh does not install from CoreCodeAI/c3code"
fi

# 6. No T3 project, relay, or sign-in is baked into a build.
no_match "the mobile app pins an Expo project or owner" \
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|owner: "pingdotgg"' \
  'apps/mobile/app.config.ts' 'apps/mobile/eas.json'
no_match "a T3 Clerk publishable key is baked in" 'pk_live_[A-Za-z0-9]{10,}' "${PRODUCT[@]}"

# 7. Product links never send users to T3's site, npm package, installer, or store listings.
no_match "a product link points at T3 Code" \
  't3\.codes/(install\.(sh|ps1)|download|mobile|privacy-policy|security-policy|terms-of-service)|"npx t3 triage"|npx t3@\$\{|apps\.apple\.com/[^"]*t3-code|play\.google\.com/store/apps/details\?id=com\.t3tools|github\.com/pingdotgg/t3code|raw\.githubusercontent\.com/pingdotgg' \
  "${PRODUCT[@]}"

# 8. Copied thread, prompt, and pairing links name T3's hosted app only when a build sets one.
no_match "a copied link defaults to T3's hosted app (app.t3.codes)" \
  'origin = DEFAULT_HOSTED_APP_URL|origin \?\? DEFAULT_HOSTED_APP_URL|HOSTED_APP_URL\?\.trim\(\) \|\| DEFAULT_HOSTED_APP_URL|Effect\.as\(DEFAULT_HOSTED_APP_URL\)|HOSTED_APP_HOST = "app\.t3\.codes"' \
  "${PRODUCT[@]}"

# 9. C3 Code installs beside T3 Code: its own desktop app id, data home, port, and service names.
no_match "the desktop app uses T3 Code's app id (com.t3tools.t3code)" \
  'com\.t3tools\.(t3code|T3Code)' \
  'apps/desktop/scripts/electron-launcher.mjs' 'scripts/build-desktop-artifact.ts' \
  'apps/desktop/src/app/DesktopEnvironment.ts' 'apps/desktop/src/app/DesktopEarlyElectronStartup.ts' \
  'apps/mobile/app.config.ts' 'packages/shared/src/managedPolicyFile.ts'
must_contain "the desktop build and launcher use live.corecode.c3code" 'live.corecode.c3code' \
  'apps/desktop/scripts/electron-launcher.mjs' 'scripts/build-desktop-artifact.ts' \
  'apps/desktop/src/app/DesktopEnvironment.ts'
no_match "the default home is T3 Code's ~/.t3" '"\.t3"' \
  'apps/server/src/os-jank.ts' 'apps/desktop/src/app/DesktopStatePaths.ts'
must_contain "the default home is ~/.c3" '".c3"' \
  'apps/server/src/os-jank.ts' 'apps/desktop/src/app/DesktopStatePaths.ts'
no_match "a default port is T3 Code's 3773" \
  '(DEFAULT_PORT|DEFAULT_DESKTOP_BACKEND_PORT|DEFAULT_REMOTE_PORT) = 3773([^0-9]|$)' \
  'apps/server/src/config.ts' 'apps/desktop/src/app/DesktopApp.ts' 'packages/ssh/src/tunnel.ts'
must_contain "the server's default port is 3873" 'DEFAULT_PORT = 3873' 'apps/server/src/config.ts'
must_contain "the background service has C3 Code's names" 'BOOT_SERVICE_NAME = "c3code"' \
  'apps/server/src/cloud/bootService.ts'
must_contain "the background service's launchd label is C3 Code's" \
  'BOOT_SERVICE_LAUNCHD_LABEL = "live.corecode.c3code.service"' 'apps/server/src/cloud/bootService.ts'
must_contain "the Windows service task is C3 Code's" 'SERVICE_TASK_DIRECTORY = "c3code"' \
  'apps/server/src/serviceLauncher.ts'

if [ "$failures" -gt 0 ]; then
  printf '\n%d fork invariant(s) broken. See "This is a fork" in AGENTS.md.\n' "$failures" >&2
  exit 1
fi
echo "fork invariants hold"
