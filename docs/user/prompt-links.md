# Prompt links

A prompt link opens C3 Code with a prefilled draft—useful for sharing prompts or adding one-click fixes in pull request comments.

Links **never** auto-send or change your permission mode, branch, or worktree. They only open a draft for you to review and send.

## Create a link

- **From the composer**: Open the command palette and choose **Copy prompt link** (or **Copy prompt link with repo and model** on GitHub projects).
- **From a sent message**: Click **Copy prompt link**.
- **By hand** (URL-encode the prompt, e.g. with `encodeURIComponent`):

```text
t3code://new?prompt=Rate%20my%20swearing
t3code://new?prompt=Fix%20the%20build&repo=owner/name&provider=codex&model=gpt-5.5
t3code://new?pr=owner/name/123&prompt=Fix%20the%20failing%20check
```

| Parameter  | Description                                                       |
| ---------- | ----------------------------------------------------------------- |
| `prompt`   | Draft text (up to 8,000 characters). Required unless `pr` is set. |
| `repo`     | GitHub repository (`owner/name` or URL).                          |
| `provider` | Provider ID (e.g. `codex`, `claude`).                             |
| `model`    | Model ID or name for that provider.                               |
| `pr`       | GitHub pull request (`owner/name/123` or URL).                    |

## How links open

A `t3code://` link opens the C3 Code desktop or mobile app. C3 Code runs no hosted web app, so it copies `t3code://` links; a build you configure with one (`VITE_HOSTED_APP_URL`) copies links on that app instead, which ask whether to use the desktop/mobile app, the current browser, or the download page (**Remember my choice** skips this next time). Links on T3 Code's `app.t3.codes` still open in C3 Code when they reach it, for example through [C3 Code as your default browser](./default-browser.md).

- **No `repo`**: Opens a no-project draft on your last-used machine.
- **`repo`**: Opens in your most recent project for that repo (or offers **Clone** / **Use without project**).
- **`provider` / `model`**: Applied if configured; otherwise falls back to your default with a notice.
- **`pr`**: Opens the thread linked to that PR, or prepares a new worktree draft on the PR branch after you confirm checkout.
- **Thread prompt link** (`t3code://threads/<environment>/<thread>?prompt=…`): Prefills that thread's composer (asks before overwriting an existing draft).

C3 Code strips invisible characters (such as zero-width and hidden tag characters) and warns you if a prompt contained them.

## Share a thread

**Copy thread** copies a thread link (`t3-thread://v2/<environment>/<thread>`) that pastes into any composer as a thread chip and opens from any C3 Code client's messages. A build with its own hosted web app copies a link on that app instead, which also opens from outside C3 Code. Only someone connected to the machine running that thread can view it.
