# CLI

```text
flow-reel init [folder] [--title <title>] [--description <text>] [--slug <name>] [--scripts <folder>] [--output <folder>]
flow-reel init [folder] --alias <name>
flow-reel compose <script.reel.ts> [--detach] [--out <dir>] [--no-sound] [--integration <name>] [--voice <name>]
                                   [--speaker <name>] [--language <name>] [--model <id>]
                                   [--api-key-env <variable>] [--base-url <url>] [--save-config]
flow-reel runs [--all]
flow-reel watch <run or script>
flow-reel wait <run or script>
flow-reel logs <run or script>
flow-reel cancel <run or script>
flow-reel resume <run or script> [--detach]
flow-reel clean [--all] [--yes]
flow-reel studio [--port <n>] [--no-open]
flow-reel verify <reel>
flow-reel compare <a.reel> <b.reel>
```

Run it with `npx flow-reel …` from a project that has flow-reel installed. Every command also takes `--json`, and then
prints JSON lines on its output.

## Exit codes

| Exit | |
|---|---|
| 0 | done |
| 1 | failed |
| 2 | wrong arguments, or not a reel |
| 3 | the run stopped: its process ended before it did |
| 4 | the run was cancelled |

`compose`, `resume`, `watch` and `wait` exit as their run ends. `--detach` exits 0 once the run has started.

## `init`

Makes a project a workspace: writes `flow-reel.json` and the scripts folder. In a terminal it asks for what the flags
leave out; elsewhere `--title` is needed. It takes over the settings of a 0.7 `flow-reel.json`
([Migration](../migration.md)).

| Flag | Does |
|---|---|
| `--title <title>` | The workspace's title. |
| `--description <text>` | What it is. |
| `--slug <name>` | Its name in commands, `shop` in `shop/12`. Made from the title by default. Unique on a computer. |
| `--scripts <folder>` | The scripts folder, `reels` by default. |
| `--output <folder>` | Where reels go, `<scripts>/out` by default. |
| `--alias <name>` | Another name for an existing workspace on this computer, when its slug is taken. |

## `compose`

Composes a script into a reel, as a [run](../guide/runs.md), in the composer image for the package's version and the
voice (see [Installation](../getting-started/installation.md)). It pulls the image the first time, or builds it locally
if it can't be pulled.

| Flag | Does |
|---|---|
| `--detach` | Starts the run and returns. |
| `--out <dir>` | Writes `<dir>/<name>.reel/` instead of into the output folder. |
| `--no-sound` | Mutes every sound. They stay in the event log. |
| `--integration <name>` | The E2E tool that runs the script: `playwright`. |
| `--voice <name>` | `qwen3-tts-0.6b`, `openai`, `gemini`, `openrouter`, `together`, `groq`, `elevenlabs`, `openai-compatible`. |
| `--speaker <name>` | The voice's speaker. |
| `--language <name>` | The voice's language. |
| `--model <id>` | A cloud voice's model. |
| `--api-key-env <variable>` | The environment variable holding a cloud voice's key. |
| `--base-url <url>` | A cloud voice's server. |
| `--save-config` | Writes this compose's integration and voice to `flow-reel.json`, if it succeeds. Not with `--detach`. |

Each flag can be given once. Flags win over `flow-reel.json`, and the file wins over the defaults
([Configure the composer](../guide/configuration.md)).

```sh
npx flow-reel compose reels/settings.reel.ts
npx flow-reel compose reels/settings.reel.ts --out /tmp/reels
npx flow-reel compose reels/settings.reel.ts --voice openai --speaker nova --detach
npx flow-reel compose reels/settings.reel.ts --voice openai-compatible --base-url http://localhost:8880/v1 --model kokoro
npx flow-reel compose reels/settings.reel.ts --speaker Serena --language english --save-config
```

## `runs`, `watch`, `wait`, `logs`, `cancel`, `resume`, `clean`

See [Runs](../guide/runs.md). A run is named by its script (`settings`), its number (`12`) or its id (`shop/12`).

| Command | Does | JSON lines |
|---|---|---|
| `runs` | Lists the workspace's runs, newest first. `--all`: every workspace's. | one per run: `run`, `script`, `startedAt`, `state`, what can be done, `files` |
| `watch` | Shows a run until it ends. | its journal's entries |
| `wait` | Waits until a run ends. | `run`, `state`, `why` |
| `logs` | Prints what its script, browser and renderer printed. | `run`, `line` |
| `cancel` | Ends a run. | `run`, `state` |
| `resume` | Lets a run that stopped or failed go on, without recording again. | its journal's entries |
| `clean` | Removes finished runs' heavy files, after asking. `--yes` doesn't ask. | `run`, `bytes`, `removed` |

## `studio`

Opens the studio in the browser, to watch runs and replay reels, and stays in the terminal. Ctrl+C stops the studio;
runs go on.

- **Address:** `http://127.0.0.1:4777/`, or `--port` for another port. A port in use is an error: the studio never
  moves to another one by itself.
- **Key:** the address it prints and opens carries a key, good until the studio stops. The browser keeps it as a cookie,
  and the studio refuses every request without it, from another site, or for another host name.
- `--no-open` prints the address without opening a browser. `--json` prints `{"url": …}`.

**Workspaces**, its first screen, shows every workspace on this computer with its latest runs and their files' size,
today's turns at heavy work, and every run, filtered by what is going on, what failed and what can go on. Runs started in
a terminal or by an agent appear within 2 seconds. **Add a workspace** takes a project's full path (`~/` works), and
offers to make its `flow-reel.json` as `init` does. **Clean** removes what `clean` would, after showing how much.

**Scripts** lists a workspace's scripts with what each one's last reel holds: steps, comments, sounds, effects, cards and
length. The selected script's source shows the lines changed since that reel. **Run** starts a run as
`compose --detach` does, with the voice's key from the environment the studio was started in. **Run again on save**
starts a run each time the file is saved with a change; a save while a run is going waits for it, and several such saves
make one run. It stays on until it is turned off or the studio stops. A script can also be opened by its full path.

**Run** watches one run as it goes, wherever it was started: its phases, its steps with how long each took, its log,
its journal and why it failed. While it records, the stage shows the app live, with the target of each click and
typing outlined; the picture is grabbed only while someone watches. Reopening the page shows what happened meanwhile. Under it, the **score** shows the run on one line per kind: a picture of each step, the steps, comments, sounds, effects and cards, on the recording's clock. It writes its steps as the script records, and fills in the rest once the recording is done. **Fold** joins steps without a comment; `[` and `]` zoom, `0` fits and `F` folds. **Cancel run**, **Resume** and **Run
again** do what `cancel`, `resume --detach` and `compose --detach` do. Closing the page or the studio doesn't stop the
run.

The studio needs no account and no internet: its fonts and code come with flow-reel.

## `verify`

```sh
npx flow-reel verify reels/out/settings.reel
```

Checks a reel against its manifest. Runs without Docker.

| Exit | |
|---|---|
| 0 | whole and unaltered |
| 1 | a file is missing, extra or changed, and each is named |
| 2 | not a reel, or an invalid manifest |

## `compare`

```sh
npx flow-reel compare reels/out/a.reel /tmp/a.reel
```

Verifies both reels, then compares their steps, comments, voice, audio hashes, step starts (±150 ms) and effects.
Runs without Docker or FFmpeg. See [Compare two reels](../guide/reels.md#compare-two-reels).

| Exit | |
|---|---|
| 0 | match |
| 1 | valid, and different |
| 2 | invalid input, failed sync or a usage error |

## Environment

| Variable | |
|---|---|
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `TOGETHER_API_KEY`, `GROQ_API_KEY`, `ELEVENLABS_API_KEY` | The cloud voices' default key variables. `apiKeyEnv` names another one. Passed into the container by name. |
| `FLOW_REEL_DATA_DIR` | Where [runs are kept](../guide/runs.md#where-runs-are). |
