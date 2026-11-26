# Privacy and network calls

C3 Code collects no usage data. It has no analytics, no crash or error reporting, and no install or
device IDs, and it sends nothing to the people who maintain it. Your prompts, code, and credentials
go only to the agents and services you set up.

C3 Code is an unofficial fork of [T3 Code](https://github.com/pingdotgg/t3code). It is not
affiliated with or endorsed by T3 Tools, Inc.

## What the fork removed

| T3 Code sends                                                                  | In C3 Code                                                                                                     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Product usage events to `ingest.t3.codes` (PostHog), under a hashed install ID | Removed, with the install ID and the account hashes                                                            |
| Relay connection traces to Axiom                                               | Removed                                                                                                        |
| Agent feedback reports                                                         | Removed: a report stays on the machine and is never sent                                                       |
| Mobile crash reports and connection traces (Expo Observe)                      | Removed                                                                                                        |
| Mobile over-the-air update checks against T3's Expo project                    | Off unless you build with your own Expo project                                                                |
| `npx t3` and the T3 installer, download page, and privacy policy links         | Point at this repository instead                                                                               |
| Copied thread, prompt, and pairing links on T3's hosted app (`app.t3.codes`)   | `t3-thread:` and `t3code:` links, and your server's own pairing URL, unless you build with your own hosted app |

C3 Code also asks every agent CLI it starts not to send its own telemetry: it sets `DO_NOT_TRACK`,
`DISABLE_TELEMETRY`, `DISABLE_ERROR_REPORTING`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, and
`OPENCODE_DISABLE_TELEMETRY` to `1`, and starts Antigravity with `--disable-telemetry`. A value you
set yourself wins. Each CLI decides what these switches cover; read its own privacy notes.

## What C3 Code connects to

Nothing below carries a usage event or an identifier for you or your machine.

| Connection                                                                                                             | When                                                                   | What it sends                                            |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Your agents' providers (Anthropic, OpenAI, Google, xAI, and others)                                                    | When an agent runs. The agent CLI makes the calls, not C3 Code         | What the agent sends, under your own account             |
| Plan usage limits (`api.anthropic.com`, `chatgpt.com`, xAI)                                                            | When C3 Code reads your plan limits, itself or through a hub you added | A request signed with your own credentials               |
| C3 Code releases on GitHub (`CoreCodeAI/c3code`)                                                                       | Update checks in the desktop app and the `t3` CLI                      | A plain request for the release list                     |
| The model list (`raw.githubusercontent.com/CoreCodeAI/c3code`)                                                         | At most hourly, while **Provider update checks** is on                 | A plain request for `model-manifest.json`                |
| Agent CLI versions (`registry.npmjs.org`, `releases.openai.com`, `downloads.claude.ai`, Antigravity's update manifest) | While **Provider update checks** is on                                 | A plain request for the latest version                   |
| Token prices (LiteLLM's price table on GitHub)                                                                         | At most daily, when the usage view estimates costs                     | A plain request for the price table                      |
| Theme search (`open-vsx.org`)                                                                                          | When you search for an editor theme                                    | Your search text                                         |
| Local dictation models (`huggingface.co`)                                                                              | When you download a speech model                                       | A plain request for the model file                       |
| Cloud dictation (OpenAI, xAI, or OpenRouter)                                                                           | Only with a provider and key you chose                                 | Your recording, under your key                           |
| Chrome for Testing (`storage.googleapis.com`)                                                                          | The first time the preview browser needs its headless Chrome           | A plain download request                                 |
| Expo (`api.expo.dev`)                                                                                                  | Only when you sign the device tools in with your Expo token            | Requests for your own Expo devices and builds            |
| Your git remotes and GitHub                                                                                            | When you fetch, push, or open a pull request                           | What git and the GitHub API need, under your credentials |
| T3 Connect                                                                                                             | Off in C3 Code builds. Only a relay and Clerk instance you configure   | See [Remote access](./remote-access.md)                  |
| Your OpenTelemetry receiver                                                                                            | Only to endpoints you enter (see below)                                | The server's own traces, metrics, and logs               |

Turn off **Settings → Maintenance → Provider update checks** to stop the model list and agent
version checks.

## Agent activity for mobile notifications

**Settings → Sharing & access → Publish agent activity** sends project and thread titles, model
names, and turn status to the T3 Connect relay for
[mobile notifications and live activities](./mobile-notifications.md). It needs a relay, so it does
nothing in a build without one.

## Export diagnostics to your own OpenTelemetry receiver

Open **Settings → Maintenance → Diagnostics** (per environment), enter OTLP HTTP endpoints (for
example `http://localhost:4318/v1/traces`), save, and restart the server. Use **Test** to check the
connection.

`T3CODE_OTLP_*_URL` and the standard `OTEL_EXPORTER_OTLP_*` variables override saved settings. Use
`T3CODE_OTLP_HEADERS` and `T3CODE_OTLP_PROTOCOL=http/protobuf`, or their `OTEL_EXPORTER_OTLP_*`
equivalents, for auth and protobuf.

## Report a security problem

See the [security policy](../../.github/SECURITY.md).
