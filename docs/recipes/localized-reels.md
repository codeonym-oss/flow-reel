# Localized reels

One script per language, in its own folder with its own `flow-reel.json`, gives a reel per language. Each folder
keeps its own reel cache, so changing the English comments doesn't speak the French ones again.

```text
demos/
├── en/
│   ├── tour.ts
│   └── flow-reel.json     ← "language": "english"
└── fr/
    ├── tour.ts            ← the same actions, comments in French
    └── flow-reel.json     ← "language": "french"
```

## With a cloud voice

Cloud voices detect the language from the text, so translated comments are enough:

```json
{ "version": 1, "voice": { "adapter": "openai", "speaker": "coral", "apiKeyEnv": "OPENAI_API_KEY" } }
```

Together AI and ElevenLabs also take an ISO 639-1 code, `"language": "fr"`.

## With the built-in local voice

Set the language by name. The local voice speaks Chinese, English, French, German, Italian, Japanese, Korean,
Portuguese, Russian and Spanish:

```json
{ "version": 1, "voice": { "adapter": "qwen3-tts-0.6b", "speaker": "Aiden", "language": "french" } }
```

Speakers differ in how natural they sound in each language. Compose a one-comment script with two speakers and
listen to both before a long reel.

## Share the actions

Actions can live in a helper next to the script. A script may import files from its own folder, so keep the helper
in each language folder, or keep one folder with a script per language:

```ts
// demos/tour/steps.ts
import type { ScriptContext } from "flow-reel";

export const openSettings = (page: ScriptContext["page"]) => page.getByRole("link", { name: "Settings" }).click();
```

```ts
// demos/tour/tour.fr.ts
import { script } from "flow-reel";
import { openSettings } from "./steps.ts";

export default script({ url: "http://localhost:4173/?lang=fr" }, async ({ page, comment }) => {
  comment("Ouvrez les réglages.");
  await openSettings(page);
});
```

With one folder, the scripts share one `flow-reel.json`, so pass the language for each compose:
`npx flow-reel compose demos/tour/tour.fr.ts --language french`.

:::{note}
Cards and overlays take their text from the script, so translate their `title`, `points` and `detail` too.
:::
