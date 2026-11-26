# flow-reel.json

The file at a workspace's root, written by `flow-reel init`. A workspace has one. Unknown keys and names fail before the
composer starts.

```json
{
  "version": 2,
  "workspace": { "id": "k3v9q2m7x5ta", "slug": "shop", "title": "Shop", "description": "The shop's web app" },
  "scripts": "reels",
  "output": "reels/out",
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
  },
  "limits": { "record": 60, "voice": 60, "render": 120 },
  "keepRuns": 5
}
```

| Key | Values | Default |
|---|---|---|
| `version` | `2` | required |
| `workspace.id` | what `init` wrote: it never changes | required |
| `workspace.slug` | lowercase words joined by hyphens | required |
| `workspace.title` | text | required |
| `workspace.description` | text | none |
| `scripts` | the scripts folder, relative to the file | required |
| `output` | where reels go, relative to the file | required |
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
| `limits.record`, `limits.voice`, `limits.render` | minutes, at most 1440 | 60, 60, 120 |
| `keepRuns` | how many finished runs of each script keep their [heavy files](../guide/runs.md#the-history) | 5 |

- A file with `apiKey` in it is refused: name the variable with `apiKeyEnv`.
- Brand paths are relative to the scripts folder, and inside it.
- `compose --save-config` rewrites the integration and the voice.

The cloud voices' defaults are in [Voices](../guide/voices.md#cloud-voices).
