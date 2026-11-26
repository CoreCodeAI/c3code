# Product analytics

C3 Code has no product analytics. T3 Code's server sends usage events to PostHog under a hashed
install ID, its relay and mobile app send traces and crash reports to Axiom, and agent feedback
reports go to T3. This fork removed all of it, with the install ID and the account hashes, and
[`check-fork-invariants.sh`](../../scripts/check-fork-invariants.sh) fails CI if any of it comes
back. [Privacy and network calls](../user/privacy.md) lists every outbound connection that remains.

## Rules

- **Collect nothing.** Do not add usage events, crash or error reporting, or an install, device, or
  account identifier, in any client or in the server. A diagnostic stays on the machine unless the
  user sends it to a place they chose, such as the OpenTelemetry endpoints they enter in
  **Settings → Maintenance → Diagnostics**.
- **Identity never comes from a provider.** Do not read a provider's sign-in files or derive an id
  or owner from a user's OpenAI, Claude, or other provider account, even hashed: users did not sign
  in to those to be identified by C3 Code.
- **Agent feedback stays local.** `withAgentFeedbackOff` in
  [`serverSettings.ts`](../../apps/server/src/serverSettings.ts) holds the setting off whatever a
  settings file says, and [`FeedbackStore`](../../apps/server/src/feedback/FeedbackStore.ts)
  stores every report as unsent.
- **Name every new connection.** A change that adds an outbound call adds its row to the table in
  [Privacy and network calls](../user/privacy.md), with when it happens and what it sends.
- **Agent CLIs are asked to stay quiet.** `PROVIDER_TELEMETRY_OPT_OUT_ENV` in
  [`instanceEnvironment.ts`](../../packages/provider-core/src/server/instanceEnvironment.ts) sets
  each CLI's telemetry opt-out unless the user set the variable themselves.

## Upstream merges

A T3 Code merge can bring analytics code, a telemetry SDK, or a new call to a T3 service back.
Resolve the conflict by removing it again, and run `bash scripts/check-fork-invariants.sh` before
pushing; the script lists each rule it checks.
