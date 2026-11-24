# CLI

```text
flow-reel compose <script.ts> [--no-sound] [--out <dir>] [--integration <name>] [--voice <name>]
                              [--speaker <name>] [--language <name>] [--model <id>]
                              [--api-key-env <variable>] [--base-url <url>] [--save-config]
flow-reel verify <reel>
flow-reel compare <a.reel> <b.reel>
```

Run it with `npx flow-reel …` from a project that has flow-reel installed.

## `compose`

Composes a script into a reel, inside the composer image for the package's version and the voice (see
[Installation](../getting-started/installation.md)). It pulls the image the first time, or builds it locally if it
can't be pulled.

| Flag | Does |
|---|---|
| `--out <dir>` | Writes `<dir>/<name>.reel/` instead of next to the script. |
| `--no-sound` | Mutes every sound. They stay in the event log. Also accepted before the script. |
| `--integration <name>` | The E2E tool that runs the script: `playwright`. |
| `--voice <name>` | `qwen3-tts-0.6b`, `openai`, `gemini`, `openrouter`, `together`, `groq`, `elevenlabs`, `openai-compatible`. |
| `--speaker <name>` | The voice's speaker. |
| `--language <name>` | The voice's language. |
| `--model <id>` | A cloud voice's model. |
| `--api-key-env <variable>` | The environment variable holding a cloud voice's key. |
| `--base-url <url>` | A cloud voice's server. |
| `--save-config` | Rewrites `flow-reel.json` with this compose's settings, if it succeeds. It keeps the brand. |

Each flag can be given once. Flags win over `flow-reel.json`, and the file wins over the defaults
([Configure the composer](../guide/configuration.md)).

```sh
npx flow-reel compose demos/settings.ts
npx flow-reel compose demos/settings.ts --out reels
npx flow-reel compose demos/settings.ts --voice openai --speaker nova
npx flow-reel compose demos/settings.ts --voice openai-compatible --base-url http://localhost:8880/v1 --model kokoro
npx flow-reel compose demos/settings.ts --speaker Serena --language english --save-config
```

The compose builds the reel in `<name>.reel.partial/` and replaces the old reel only on success.

## `verify`

```sh
npx flow-reel verify demos/settings.reel
```

Checks a reel against its manifest. Runs without Docker.

| Exit | |
|---|---|
| 0 | whole and unaltered |
| 1 | a file is missing, extra or changed, and each is named |
| 2 | not a reel, or an invalid manifest |

## `compare`

```sh
npx flow-reel compare demos/a.reel demos/b.reel
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
