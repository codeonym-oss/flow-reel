# Localized reels

One script per language, in a subfolder each, gives a reel per language. Each reel is its own cache, so changing the
English comments doesn't speak the French ones again.

```text
flow-reel.json              ← the voice they share
reels/
├── steps.ts                ← the actions they share
├── en/tour.reel.ts         → reels/out/en/tour.reel/
└── fr/tour.reel.ts         → reels/out/fr/tour.reel/
```

## With a cloud voice

Cloud voices detect the language from the text, so translated comments are enough:

```json
{
  // ...
  "voice": { "adapter": "openai", "speaker": "coral", "apiKeyEnv": "OPENAI_API_KEY" }
}
```

Together AI and ElevenLabs also take an ISO 639-1 code, `--language fr`.

## With the built-in local voice

Name the language for each compose. The local voice speaks Chinese, English, French, German, Italian, Japanese, Korean,
Portuguese, Russian and Spanish:

```sh
npx flow-reel compose reels/fr/tour.reel.ts --speaker Aiden --language french
```

Speakers differ in how natural they sound in each language. Compose a one-comment script with two speakers and
listen to both before a long reel.

## Share the actions

A script may import any file of the scripts folder, so the actions can live in a helper:

```ts
// reels/steps.ts
import type { ScriptContext } from "flow-reel";

export const openSettings = (page: ScriptContext["page"]) => page.getByRole("link", { name: "Settings" }).click();
```

```ts
// reels/fr/tour.reel.ts
import { script } from "flow-reel";
import { openSettings } from "../steps.ts";

export default script({ url: "http://localhost:4173/?lang=fr" }, async ({ page, comment }) => {
  comment("Ouvrez les réglages.");
  await openSettings(page);
});
```

:::{note}
Cards and overlays take their text from the script, so translate their `title`, `points` and `detail` too.
:::
