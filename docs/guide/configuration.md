# Configure the composer

The composer's **settings** are the integration that runs the script, the voice that speaks its comments, and the
brand that cards and overlays follow. They come from three places, and the first one that sets a value wins:

1. **flags** on `flow-reel compose`;
2. **`flow-reel.json`** at the workspace's root;
3. **the defaults.**

```json
{
  "version": 2,
  "workspace": { "id": "k3v9q2m7x5ta", "slug": "shop", "title": "Shop" },
  "scripts": "reels",
  "output": "reels/out",
  "integration": "playwright",
  "voice": { "adapter": "gemini", "speaker": "Kore", "apiKeyEnv": "GEMINI_API_KEY" },
  "brand": { "theme": "ocean", "logo": "brand/logo.svg" }
}
```

```sh
npx flow-reel compose reels/settings.reel.ts --speaker Puck     # overrides the file's speaker for this compose
```

| Flag | File | Values | Default |
|---|---|---|---|
| `--integration` | `integration` | `playwright` | `playwright` |
| `--voice` | `voice.adapter` | `qwen3-tts-0.6b`, or a [cloud voice](voices.md#cloud-voices) | `qwen3-tts-0.6b` |
| `--speaker` | `voice.speaker` | local: see [Voices](voices.md#the-built-in-local-voice). Cloud: any of the provider's. | `Ryan`, or the provider's |
| `--language` | `voice.language` | local: a language name. Cloud: `auto` or an ISO 639-1 code. | `english`, or `auto` |
| `--model` | `voice.model` | cloud only: any of the provider's models | the provider's |
| `--api-key-env` | `voice.apiKeyEnv` | cloud only: the environment variable holding the key | the provider's |
| `--base-url` | `voice.baseUrl` | cloud only: the provider's endpoint, a proxy, or an OpenAI-compatible server | the provider's |
| | `brand` | see [Brand](brand.md) | none |

- An unknown name fails before the composer starts, listing the known ones.
- When `--voice` picks a different voice from the file's, the file's speaker and language are ignored.

## The workspace's file

`npx flow-reel init` writes `flow-reel.json` at the project's root, with the workspace's id, name, scripts folder and
output folder. **Commit it with the scripts**: everyone sharing them then uses the same settings, and their checkouts
are the same workspace.

A compose changes it only with `--save-config`, and only when it succeeds. That keeps everything but the integration and
the voice.

```sh
npx flow-reel compose reels/settings.reel.ts --voice openai --save-config   # switch the workspace to OpenAI for good
```

Every key is in [flow-reel.json](../reference/settings.md).

## Credentials

The built-in local voice needs none. A cloud voice reads its key from the environment variable named by
`apiKeyEnv`. `flow-reel.json` names the variable, never the key: a file with `apiKey` in it is refused. See
[Keys stay in the environment](voices.md#keys-stay-in-the-environment).
