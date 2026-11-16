# The flow-reel language

**Supported runtime:** `>=0.4.0 <0.5.0`

Everything a script can say, and every command, for the runtime versions above. If a word, option or flag is not
on this page, flow-reel doesn't have it: say so instead of inventing it. The plugin's `scripts/preflight.mjs`
reports the project's version and whether it is in this range.

## The words

flow-reel turns a **script** into a **reel**. The **composer** (a container image) **composes** it: it replays the
script in a fresh browser, makes a **recording**, speaks the **comments** with a **voice**, and renders the video.
A script is made of **steps**; a step can carry **comments**, **sounds** and **effects**. Say these words, with
these meanings, to the person too. Avoid: demo (for the script), scenario, take, narration, SFX, recorder.

## A script

A TypeScript file whose default export is `script(options, body)`. The body is plain Playwright plus the flow-reel
words. Every word can stand alone (from the body's context) or be chained on the locator it is about.

```ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173/" }, async ({ page, comment, sound }) => {
  comment("Open the settings.");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Dark mode")
    .comment("Turn on dark mode.")
    .sound(Sounds.controls.TOGGLE)
    .check();
  await page.getByText("Saved").waitFor();
  sound(Sounds.feedback.SUCCESS);
});
```

| Option | Meaning | Default |
|---|---|---|
| `url` | Where the script starts. `localhost` is the machine running the compose. | required |
| `viewport` | `[width, height]` in whole CSS pixels. | `[1920, 1080]` |
| `autoZoom` | `false` turns automatic zoom off; the cursor, ripples and `zoomIn` stay. | `true` |

Rules:
- Erasable TypeScript only: no `enum`, `namespace` or parameter properties.
- Import only from `flow-reel` and from files in the script's own folder. The composer mounts only that folder.
- The composer's browser is fresh: no cookies, no login, no storage from exploring.

## Steps and comments

`comment(text)` opens a step. The step starts with the next action and takes in every action until the next
comment. `comment` returns at once; don't `await` it.

- Chained, `locator.comment(text)` opens the step at that locator's next action.
- Two comments with no action between them make two steps, the first with no action.
- Actions before the first comment form a step with no comment.
- The video holds a step's last frame until its comment has been spoken, plus 200 ms, so speech is never cut.
- A blank comment adds no speech and no caption.

## Actions that move the pointer

Clicks (with `button`, `position`), double-clicks, `hover`, `check`, `fill`, `type`, `pressSequentially` and
`selectOption` move a visible pointer to their target, scrolling it into view first. Typing runs at 60 ms per
character, including `page.keyboard.type`. `page.mouse.wheel` scrolls smoothly. Locators from `getBy*`, chaining,
`locator.all()` and frame locators behave the same.

- `fill(value)` clicks, clears and types the value visibly, so long values take time on screen.
- Date, time, month, week, color and range inputs are filled directly after the pointer reaches them.
- `press`, `page.keyboard.press`, `page.evaluate`, `dispatchEvent` and `page.frame()` run without pointer motion,
  with a warning. They still count as actions of their step, as do `goto`, `reload`, `goBack`, `goForward`.
- After a step's last action, the composer waits for network quiet (500 ms, at most 10 s). That is not proof the
  app finished: wait for the visible result yourself (`await locator.waitFor()`, `expect`-style checks).

## Sounds

Clicks and typing sound by themselves. A sound marks a moment that matters; it is named by a constant:

| Group | Constants |
|---|---|
| `Sounds.feedback` | `SUCCESS`, `ERROR`, `NOTIFICATION` |
| `Sounds.navigation` | `OPEN`, `CLOSE`, `BACK` |
| `Sounds.controls` | `TOGGLE`, `SELECT` |

- `sound(Sounds.feedback.SUCCESS)` plays now and returns at once; it adds no pause and checks nothing.
- `locator.sound(…)` plays when that locator's next action happens (for a click, with the click). A sound within
  150 ms of a click replaces the click's own sound.
- A bare string is a type error. There are no other sounds, and no music.

## Effects

| Word | Options (defaults) | When |
|---|---|---|
| `flash(options?)` | `color: "#ffffff"`, `ms: 250` (fade-out) | Standalone: now. Chained: when the action happens. |
| `await showFrame(image, ms, options?)` | `fit: "contain"` or `"cover"`, `background: "#000000"` | An action of its step; standalone only. |
| `zoomIn(options?)` | `scale: 4/3` (from 1 to 2), `ms: 650` | Standalone: on the pointer. Chained: as the pointer heads for the element. |
| `zoomOut(options?)` | `ms: 800` | Standalone: now. Chained: after the action. |

- `showFrame` inserts a PNG, JPEG or WebP from the script's folder (path relative to the script) for `ms`
  milliseconds; the app is shown again exactly where it was. A comment in its step plays on over the image. No
  cursor, ripple or zoom is drawn on it. Make the image yourself; the only card flow-reel draws is `skip`'s.
- `zoomIn` holds the camera until `zoomOut`, across steps and clicks; automatic zoom waits meanwhile. A second
  `zoomIn` pans to its new target. A zoom still held at the end eases out. Above 4/3 the picture softens.
- A bad option, image path or duration throws where the word is written.
- **When standalone words happen:** when they are called. The hold that lets a step's comment finish comes after
  that step's last action, so a standalone word written after a step's last action (even after the next `comment`)
  happens before that hold. To act at the next scene's start, chain the word on its first action. A zoom still held
  at the end eases out as the script's actions end, before the last comment finishes.

## Long waits

A wait shows in real time unless its script shortens it. Wrap the wait, and only the wait, in one of two words:

```ts
import { script } from "flow-reel";

export default script({ url: "http://localhost:4173/" }, async ({ page, comment, speedUp, skip }) => {
  comment("Ask the agent, and watch it work through the answer.");
  await page.getByRole("button", { name: "Send" }).click();
  await speedUp(4, () => page.getByText("Done").waitFor({ timeout: 120_000 }));

  comment("The build takes a while; here is the result.");
  await page.getByRole("button", { name: "Build" }).click();
  await skip(() => page.getByText("Build passed").waitFor({ timeout: 300_000 }));
});
```

| Word | Options | In the video |
|---|---|---|
| `await speedUp(factor, fn)` | `factor`: above 1, at most 16, fractions allowed | The stretch plays `factor` times faster (frames dropped, not blended), with a "▶▶ ×4" badge top right. |
| `await skip(fn, options?)` | `label`: the words after "⏭", default `"{duration} skipped"` | The stretch is cut; a card on the dimmed frame before it shows "⏭ 38 s skipped" for 1.5 s. |

- Either word runs `fn` as one action of the open step. Pass a function (`() => …`), not a promise. Give the wait
  a `timeout` that covers the real wait: Playwright's default is 30 s.
- **Pick by what the viewer should see.** `speedUp` when the progress means something (an answer streaming in, a
  list filling up); `skip` when only the result matters (a build, an upload, a long job).
- **Only actions go inside.** In `speedUp`: actions, sounds, `flash` and zoom, at the faster pace. In `skip`: actions
  and sounds, neither seen nor heard. `comment`, `showFrame`, another `speedUp` or `skip`, and in `skip` also `flash`
  and zoom, throw where they are written: put them before or after.
- **Speech keeps its speed and is never cut.** A comment written before the wait is spoken over it: over the faster
  stretch (the last frame holds if it runs longer) or over the card (which stays until the comment ends).
- `{duration}` in `label` shows the length cut, in whole seconds: "38 s", "1 min 52 s". A label without it shows as
  written (`{ label: "Later that day" }`). The card's font covers Latin, Greek and Cyrillic.
- A bad factor, a missing function or an empty label throws where the word is written. The event log records each
  as a `speed` or `skip` event; `compare` checks the factor and the label.

## Polish (automatic, no word needed)

A drawn cursor follows the pointer; each click shows a blue ring for 400 ms. A click or typing zooms the camera in
over 650 ms to at most 4/3, holds until 2 s after the latest click or typing, then eases out over 800 ms. Hover and
scrolling alone don't zoom. Target bounds are taken before the action. An effect overrides polish where it applies;
`autoZoom: false` turns automatic zoom off for the whole script.

## Fixed so every compose is the same

Viewport, device scale, `prefers-reduced-motion`, the page's clock (`2026-01-05T09:00:00Z`) and `Math.random`'s
seed. Two composes of one script have the same steps, each starting within ±150 ms.

## Commands

```sh
npx flow-reel compose demos/settings.ts            # writes demos/settings.reel/
npx flow-reel compose demos/settings.ts --out reels # writes reels/settings.reel/
npx flow-reel compose demos/settings.ts --no-sound  # mutes every sound; they stay in the event log
npx flow-reel compose demos/settings.ts --speaker Serena --language english
npx flow-reel compose demos/settings.ts --voice openai --speaker nova   # a cloud voice; needs OPENAI_API_KEY set
npx flow-reel verify demos/settings.reel
npx flow-reel compare demos/a.reel demos/b.reel
```

- `compose` flags: `--no-sound`, `--out <dir>`, `--integration <name>`, `--voice <name>`, `--speaker <name>`,
  `--language <name>`, `--model <id>`, `--api-key-env <variable>`, `--base-url <url>`, `--save-config`. Nothing
  else: no duration, music, camera or export flags.
- A failed compose leaves the previous reel untouched and its attempt in `<name>.reel.partial/`.
- `verify`: 0 when the reel matches its manifest, 1 naming each missing, extra or changed file, 2 when it isn't a
  reel. No Docker needed.
- `compare`: 0 match, 1 different, 2 invalid. It compares steps, comments, the voice, audio hashes, step starts
  (±150 ms) and effects; not pixels, sounds or MP4 bytes.

## Settings (`flow-reel.json` beside the scripts)

```json
{ "version": 1, "integration": "playwright", "voice": { "adapter": "qwen3-tts-0.6b", "speaker": "Ryan", "language": "english" } }
```

Flags win over the file, the file over defaults. The first compose in a folder without the file writes it; an
existing file is rewritten only with `--save-config`.

| Setting | Values | Default |
|---|---|---|
| integration | `playwright` | `playwright` |
| voice | `qwen3-tts-0.6b` (local, CPU, no key), or a cloud voice (below) | `qwen3-tts-0.6b` |
| speaker | local: `Aiden`, `Dylan`, `Eric`, `Ono_Anna`, `Ryan`, `Serena`, `Sohee`, `Uncle_Fu`, `Vivian`; cloud: any of the provider's | `Ryan`; cloud: below |
| language | local: `chinese`, `english`, `french`, `german`, `italian`, `japanese`, `korean`, `portuguese`, `russian`, `spanish`; cloud: `auto` or an ISO 639-1 code | `english`; cloud: `auto` |
| model | cloud only: any of the provider's | below |
| apiKeyEnv | cloud only: the environment variable holding the key | below |
| baseUrl | cloud only: the provider's endpoint, a proxy, or an OpenAI-compatible server | the provider's |

The local voice runs on the CPU: expect about a minute per short comment on a laptop, and several GB of memory. A
cloud voice speaks a whole script in seconds, and needs a key and a network:

| voice | Default model | Default speaker | Key variable |
|---|---|---|---|
| `openai` | `gpt-4o-mini-tts` | `coral` | `OPENAI_API_KEY` |
| `gemini` | `gemini-3.8-flash-tts` | `Kore` | `GEMINI_API_KEY` |
| `openrouter` | `google/gemini-3.8-flash-tts` | `Kore` | `OPENROUTER_API_KEY` |
| `together` | `canopylabs/orpheus-3b-0.1-ft` | `tara` | `TOGETHER_API_KEY` |
| `groq` | `canopylabs/orpheus-v1-english` | `troy` | `GROQ_API_KEY` |
| `elevenlabs` | `eleven_multilingual_v2` | `JBFqnCBsd6RMkjVDRZzb` (a voice ID) | `ELEVENLABS_API_KEY` |
| `openai-compatible` | none: set `model` and `baseUrl` | `alloy` | none: set `apiKeyEnv` if the server needs a key |

```json
{ "version": 1, "voice": { "adapter": "openai", "model": "gpt-4o-mini-tts", "speaker": "coral", "apiKeyEnv": "OPENAI_API_KEY" } }
```

- **The key never goes in a file.** `flow-reel.json` names the variable (`apiKeyEnv`); a file with `apiKey` is
  refused. The person sets the variable in their shell (`export OPENAI_API_KEY=...`); don't ask them to paste the
  key into the conversation, and don't print it.
- flow-reel passes a cloud voice's model, speaker and language on unchecked: a wrong one fails with the provider's
  own message. Only Together AI and ElevenLabs use the language; the others detect it from the text.
- Comments go four at a time; rate limits and server errors are retried. A rejected key fails at once, naming the
  variable. Claude isn't a voice: Anthropic has no speech API.

An unchanged comment with unchanged voice settings (adapter, model, speaker, language) reuses its clip from the
previous reel (the reel cache), so recomposing after a small change speaks only the changed lines, and a cloud voice
bills only those. Deleting the reel deletes its cache.

## The reel

`<name>.reel/` beside the script:

| File | What it is |
|---|---|
| `video.mp4` | 1920×1080, 30 fps, speech and sounds. |
| `transcript.json` | Each step's `comment`, `startMs`, `actionEndMs`, `endMs` on the video's timeline. |
| `events.json` | Pointer moves, clicks, typing, scrolls, sounds, effects, speed-ups and skips, timed the same way. |
| `captions.srt`, `captions.vtt` | The comments as captions. |
| `audio/NNN.wav` | Each step's speech clip. |
| `manifest.json` | Every file with its size and SHA-256, the script, composer version, integration, voice. |
| `work/` | Intermediate files for debugging; not in the manifest. |

## Platforms

Linux with Docker or Podman: the container shares the host's network, so `localhost` works. macOS and Windows
with Docker Desktop: `localhost` is mapped to the host; not yet tested by flow-reel's CI.
