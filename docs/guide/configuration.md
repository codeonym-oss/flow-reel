# Configure the composer

The composer's **settings** are the integration that runs the script, the voice that speaks its comments, and the
brand that cards and overlays follow. They come from three places, and the first one that sets a value wins:

1. **flags** on `flow-reel compose`;
2. **`flow-reel.json`** in the script's folder;
3. **the defaults.**

```json
{
  "version": 1,
  "integration": "playwright",
  "voice": { "adapter": "gemini", "speaker": "Kore", "apiKeyEnv": "GEMINI_API_KEY" },
  "brand": { "theme": "ocean", "logo": "brand/logo.svg" }
}
```

```sh
npx flow-reel compose demos/settings.ts --speaker Puck     # overrides the file's speaker for this compose
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

- Every key is optional except `version`.
- An unknown name fails before the composer starts, listing the known ones.
- When `--voice` picks a different voice from the file's, the file's speaker and language are ignored.

## The file writes itself

The first successful compose in a folder without `flow-reel.json` writes one with the settings it used. The next
compose, and everyone sharing the scripts, then uses the same ones. **Commit it with the scripts.**

An existing file is rewritten only with `--save-config`, and only when the compose succeeds. That keeps its `brand`.

```sh
npx flow-reel compose demos/settings.ts --voice openai --save-config   # switch the folder to OpenAI for good
```

## Credentials

The built-in local voice needs none. A cloud voice reads its key from the environment variable named by
`apiKeyEnv`. `flow-reel.json` names the variable, never the key: a file with `apiKey` in it is refused. See
[Keys stay in the environment](voices.md#keys-stay-in-the-environment).
