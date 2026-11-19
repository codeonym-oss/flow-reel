# flow-reel.json

The settings file in a script's folder. Every key is optional except `version`. Unknown keys and names fail before
the composer starts.

```json
{
  "version": 1,
  "integration": "playwright",
  "voice": {
    "adapter": "openai",
    "model": "gpt-4o-mini-tts",
    "speaker": "coral",
    "language": "auto",
    "apiKeyEnv": "OPENAI_API_KEY",
    "baseUrl": "https://api.openai.com/v1"
  },
  "brand": {
    "theme": "paper",
    "accent": "#D6336C",
    "logo": "brand/logo.svg",
    "fonts": { "heading": "brand/Display.woff2", "body": "brand/Text.woff2" },
    "enter": "fade",
    "exit": "fade"
  }
}
```

| Key | Values | Default |
|---|---|---|
| `version` | `1` | required |
| `integration` | `playwright` | `playwright` |
| `voice.adapter` | `qwen3-tts-0.6b`, `openai`, `gemini`, `openrouter`, `together`, `groq`, `elevenlabs`, `openai-compatible` | `qwen3-tts-0.6b` |
| `voice.speaker` | local: `Aiden`, `Dylan`, `Eric`, `Ono_Anna`, `Ryan`, `Serena`, `Sohee`, `Uncle_Fu`, `Vivian`. Cloud: any of the provider's. | `Ryan`, or the provider's |
| `voice.language` | local: `chinese`, `english`, `french`, `german`, `italian`, `japanese`, `korean`, `portuguese`, `russian`, `spanish`. Cloud: `auto` or ISO 639-1. | `english`, or `auto` |
| `voice.model` | cloud: any of the provider's | the provider's |
| `voice.apiKeyEnv` | cloud: an environment variable's name | the provider's |
| `voice.baseUrl` | cloud: an API root | the provider's |
| `brand.theme` | `ink`, `paper`, `ocean`, `ember` | `ink` |
| `brand.accent` | `#rrggbb` | the theme's |
| `brand.logo` | an SVG, PNG, JPEG or WebP path | none |
| `brand.fonts.heading`, `brand.fonts.body` | a WOFF2, WOFF, TTF or OTF path | Inter Tight, Inter |
| `brand.enter`, `brand.exit` | `fade`, `slide`, `wipe`, `zoom`, `blur`, `iris`, `cut` | `fade` |

- A file with `apiKey` in it is refused: name the variable with `apiKeyEnv`.
- Brand paths are relative to the file, inside the script's folder.
- The first successful compose writes the file if it's missing. `--save-config` rewrites it.

The cloud voices' defaults are in [Voices](../guide/voices.md#cloud-voices).
