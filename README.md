# flow-reel

flow-reel turns a **script** into a **reel**. A person or a coding agent writes the script as an ordinary
Playwright script, plus flow-reel words: **comments** to speak, **sounds** to play and **effects** for the picture,
each standalone or chained on the element it is about. The **composer**, a container image,
replays the script on a virtual display and records the screen. It speaks the comments with a local voice and
polishes the picture with a smooth cursor, click ripples and zoom. The result is the reel: one folder holding the
video, the transcript, the captions, the event log, the audio and a manifest. Composing the same script again gives
a matching reel, which `flow-reel compare` checks.

[`CONTEXT.md`](CONTEXT.md) defines the project's vocabulary.

This release composes commented video with captions, fitted step timings, a smooth cursor, click ripples and
automatic zoom, click/typing sounds, optional named sounds, and flashes, shown images and directed zoom.

## Requirements

- Node.js 22.18 or later (scripts are TypeScript, run with Node's type stripping).
- Docker or Podman. The recording runs in the `ghcr.io/codeonym-oss/flow-reel:<version>` image; when it can't be
  pulled, `flow-reel` builds it locally once (a few minutes).
- Release images target native Linux amd64 and arm64; Docker Desktop supplies the Linux runtime on macOS/Windows.
- About 2.5 free CPU cores while recording. On an overloaded machine the recording stops with an error rather than
  save a video whose timing is off.
- The image is about 7 GB unpacked; its build downloads about 2.5 GB of model weights. Local speech synthesis uses
  four CPU threads after capture and can require more than 5 GiB of process memory, in addition to your app and OS.

## Install

```sh
npm install --save-dev flow-reel
```

The package and recording image use the same version. Each npm release has a matching public recording image for
Linux amd64 and arm64.
See [release setup and verification](docs/releasing.md) for publication status requirements and contributor steps.

## Write a script

A script is a TypeScript file whose default export is `script(options, body)`. The body is plain Playwright, plus
flow-reel words: `comment` (a spoken line) and `sound`. Each word can stand alone, or be chained on the element it is
about.

```ts
// demos/settings.ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173" }, async ({ page, comment }) => {
  comment("Open the settings page.");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Dark mode")
    .comment("Turn on dark mode.")
    .sound(Sounds.controls.TOGGLE)
    .check();
});
```

- A comment opens a step: the step starts with the next action, and takes in every action until the next comment.
  `comment(text)` returns at once; don't await it. Two comments with no action between them are two steps, the
  first with no action. Actions before the first comment form a step with no comment.
- `url`: where the script starts. `localhost` reaches the app running on your machine.
- `viewport`: whole CSS pixels, `[1920, 1080]` by default.
- `page` is a Playwright `Page`. Clicks (including their `button` and `position` options), double-clicks, hovers,
  `check`, `fill`, `type`, `pressSequentially` and `selectOption` move the mouse visibly to their target, scrolling
  it into view first when needed; typing, including `page.keyboard.type`, runs at a fixed readable 60 ms per
  character. `page.mouse.wheel` scrolls smoothly. Locators from `locator.all()`, `getBy*`, chaining and frame
  locators behave the same way.
- `fill(value)` clicks the field, clears it and types the value visibly, so long values take time on screen, and
  the click can trigger the field's own click behaviour. Date, time, month, week, color and range inputs can't be
  typed into: they are filled directly after the mouse moves to them. A `delay` passed to typing calls is replaced
  by the readable speed; `timeout`/`force` are kept.
- Other calls that act on the page, such as `page.evaluate`, `locator.dispatchEvent`, `press`, `page.keyboard.press`
  or `page.frame()` (whose frames aren't animated), run as they are, without any mouse motion, and print a warning
  once per method. Like `page.goto`, `reload`, `goBack` and `goForward`, they still count as actions of their step.
- Write erasable TypeScript only: no `enum`, `namespace` or parameter properties. Import only from `flow-reel` and
  from files in the same folder as the script.

## Direct the picture

The picture is polished automatically (see [Compose](#compose)). Effect words direct it where you want: they stand
alone, or are chained on the element they are about, like `comment` and `sound`.

```ts
export default script({ url: "http://localhost:4173" }, async ({ page, comment, flash, showFrame, zoomIn, zoomOut }) => {
  comment("Here is how the pieces fit.");
  await showFrame("diagrams/overview.png", 3000);
  await page.getByRole("button", { name: "Save" })
    .zoomIn({ scale: 1.5 })
    .flash()
    .click();
  await page.getByLabel("Name").fill("Ada"); // still zoomed in
  zoomOut();
});
```

| Word | Options (defaults) | When it happens |
|---|---|---|
| `flash(options?)` | `color: "#ffffff"`, `ms: 250` (fade-out) | Standalone: now. Chained: when the action happens. |
| `await showFrame(image, ms, options?)` | `fit: "contain"` or `"cover"`, `background: "#000000"` | As an action of its step. Standalone only. |
| `zoomIn(options?)` | `scale: 4/3` (1 to 2), `ms: 650` | Standalone: on the pointer. Chained: as the pointer heads for the element. |
| `zoomOut(options?)` | `ms: 800` | Standalone: now. Chained: after the action. |

- **`showFrame`** inserts the image into the video for `ms` milliseconds: the app is shown again exactly where it
  was, and nothing runs in the app meanwhile. A comment spoken in its step plays on over the image. The image is a
  PNG, JPEG or WebP inside the script's folder, given relative to the script; the event log records its hash. No
  cursor, ripple or zoom is drawn over it.
- **Zoom:** `zoomIn` holds the camera until `zoomOut`, across steps and clicks; automatic zoom waits meanwhile, and
  a second `zoomIn` pans to its new target. A zoom still held when the script ends eases out. The camera still
  keeps the cursor in frame. A large element zooms less than `scale`, so it stays whole. Above 4/3 the picture is
  enlarged past the recording's resolution and softens.
- **`autoZoom: false`** in the script's options turns automatic zoom off; the cursor, ripples and `zoomIn` stay.
- A bad option, image path or duration throws where the word is written.

## Compose

```sh
npx flow-reel compose demos/settings.ts
```

This writes the reel `demos/settings.reel/`, next to the script. `--out <dir>` writes `<dir>/settings.reel/`
instead, so one folder can collect the reels of many scripts. Every reel has the same layout:

| File | What it is |
|---|---|
| `video.mp4` | The polished video, 1920×1080, 30 fps, with AAC speech and interaction sounds. |
| `transcript.json` | Each step's original `comment` and `startMs`, `actionEndMs` and `endMs` on the video's timeline (schema version 2). |
| `events.json` | Every move, click, keystroke run, scroll, sound and effect, timed the same way, and whether zoom is automatic (schema version 4). |
| `captions.srt` | Captions for a subtitle-capable video player. |
| `captions.vtt` | WebVTT captions for a browser's `<video>` / `<track>`. |
| `audio/000.wav` | Local speech clips, named by zero-based step index. |
| `manifest.json` | Every file above with its size and SHA-256, the script's name and hash, the composer version and platform, the integration and the voice (version 1). |
| `work/` | Intermediate files, for debugging only; not in the manifest, and ignored by git. |

A compose builds the new reel in `settings.reel.partial/` and replaces the old reel only once it has succeeded. A
failed compose leaves the previous reel as it was, and the partial folder for debugging; the next compose clears it.
The manifest proves a reel is whole and unaltered (see [Verify a reel](#verify-a-reel)); it does not prove two reels
are the same, since the video's bytes differ on every compose.

Each caption shows one step's comment from its `startMs` to its `endMs`. Caption whitespace is normalized and the
player wraps the text; the transcript keeps the original comment. Blank comments and steps lasting zero
milliseconds stay in the transcript but produce no caption. Commented steps include the full speech clip and
at least 200 ms afterward.

The voice is Qwen3-TTS 0.6B CustomVoice, Ryan in English unless [configured](#configure-the-composer), through the
official Python runtime on CPU. Model and tokenizer assets are pinned and downloaded when the image is built;
synthesis runs offline without a key. Speech is generated after capture finishes. The transcript records the voice
(adapter, speaker, seed and language), and each clip's relative file path,
duration in milliseconds and complete-file SHA-256 hash. Share the whole reel folder.

Synthesis normalizes whitespace without interpreting caption escapes; the transcript preserves the original text.
A blank comment produces no clip. Clip numbers retain step indexes, so skipped steps leave gaps.
A comment with no action still produces speech. Each action runs once at normal speed. After a step's last action
returns (`actionEndMs`), the composer waits for network quiet (500 ms, bounded at 10 seconds), then captures another
100 ms. Scripts must still await the UI state they intend to show; network quiet does not
prove that an operation succeeded. A timeout prints a warning and continues.

After capture and synthesis finish, the renderer adds only the whole frames needed to fit speech plus its tail,
freezing the last frame of that settled window. A comment starts alongside its step at `startMs`. Longer actions
continue normally after speech finishes. Transcript windows, captions, events and the master all use this final
timeline. A blank comment gets no speech padding; a script without comments can still have interaction sounds.
If it has no effects, or `--no-sfx` is set, it has no audio stream.

Visual polish is automatic, unless the script [directs the picture](#direct-the-picture): a white arrow with a dark outline follows logged pointer motion, and a blue ring
expands and fades for 400 ms at each click. The cursor and rings keep their screen size while the page zooms.
Clicks ease the camera in over 650 ms; it stays zoomed until 2 seconds after the latest click or typing ends,
then eases out over 800 ms. Further activity extends the zoom. Hover and scrolling alone do not trigger it.
The camera follows the pointer and stays within the recorded page. Zoom is capped at 4/3 (about 1.33×), using
the default 1440p master for sharp 1080p output; large targets reduce the zoom to keep their visible bounds
framed with padding. Bounds are captured before the action, so they do not track subsequent layout changes.
Partly off-screen elements can only show the portion captured in the master. Clicks logged without bounds use
their click points instead, without a whole-element framing guarantee. Polish preserves every frame and
all comment, transcript and caption times. Zoom animations end with the video and do not lengthen it.
Polish runs after capture, without replaying actions or changing speed.

The assembled voice and final voiced mix are normalized to -16 LUFS with a -1.5 dBTP peak ceiling, then encoded as 48 kHz stereo AAC-LC
at 192 kb/s. Decoded output is checked within 1 LU of the loudness target and 0.1 dB of the peak ceiling. Original
WAVs, durations and hashes remain unchanged. Synthesis, rendering or sync failures fail the command before a new
success transcript is written.

The local generator resets seed 0 for each clip and uses pinned settings. Matching hashes are checked in fresh
processes on the tested CPU/container platform; byte equality across hardware or architectures is not guaranteed.
On the tested Ryzen 5 3500U, one fresh process generated three short clips (6.4 seconds of speech) in 147 seconds,
with about 5.4 GiB peak process memory. Runtime varies with host load. A synthesis job has a 15-minute timeout;
individual steps also fail if generation reaches its limit, rather than returning truncated speech.

Captions escape `&`, `<` and `>` so comments are emitted without raw tags. WebVTT displays the literal text; some
SRT players display escape sequences such as `&lt;` instead. Use WebVTT in a browser when literal symbols matter.

In `settings.reel/work/`: `capture.mp4` is the original 2560×1440 recording (the viewport × 4/3, padded by one
black pixel when that is odd, as for 1280×720); `master.mp4` is the clean recording
with added holds and shown images, preserved before cursor/zoom rendering; `master.json.startMs` gives delivery time zero within
the master, preserving its calibration pre-roll. Events use CSS pixels and final delivery times; click and typing
events may include `bounds: { x, y, width, height }` in CSS pixels.
`voice.wav` is the normalized voice-only bus on the delivery timeline; `sfx.wav` is the ducked effects
bus and `mix.wav` is the final normalized voiced mix when effects exist. The `work/` folder ignores itself in git;
the rest of the reel is yours to commit or not.

To keep runs the same, the runner fixes the viewport, device scale, `prefers-reduced-motion`, the page's clock
(`2026-01-05T09:00:00Z`) and `Math.random`'s seed, and waits for the network to go idle before each step. Two runs of
a script have the same steps, each starting within ±150 ms.

## Configure the composer

The composer's settings are the integration that runs the script and the voice that speaks its comments. They come
from flags, then from `flow-reel.json` in the script's folder, then from the defaults: a flag wins over the file, and
the file over the default.

```json
{
  "version": 1,
  "integration": "playwright",
  "voice": { "adapter": "qwen3-tts-0.6b", "speaker": "Aiden", "language": "french" }
}
```

```sh
npx flow-reel compose demos/settings.ts --speaker Serena --language english
```

| Flag | File | Values | Default |
|---|---|---|---|
| `--integration` | `integration` | `playwright` | `playwright` |
| `--voice` | `voice.adapter` | `qwen3-tts-0.6b` | `qwen3-tts-0.6b` |
| `--speaker` | `voice.speaker` | `Aiden`, `Dylan`, `Eric`, `Ono_Anna`, `Ryan`, `Serena`, `Sohee`, `Uncle_Fu`, `Vivian` | `Ryan` |
| `--language` | `voice.language` | `chinese`, `english`, `french`, `german`, `italian`, `japanese`, `korean`, `portuguese`, `russian`, `spanish` | `english` |

Every key of the file is optional except `version`. An unknown name fails before the composer starts, with the list
of known ones. When `--voice` picks another voice than the file's, the file's speaker and language are ignored.

The first successful compose in a folder without `flow-reel.json` writes one with the settings it used, so the next
compose, and everyone sharing the scripts, uses the same ones. An existing file is rewritten only with
`--save-config`, and only when the compose succeeds. Commit the file with the scripts.

**Reused speech.** The reel already on disk is the voice's cache. A comment with the same text (whitespace
normalized) and the same voice settings reuses the previous reel's clip, as long as the clip still matches the hash
in its transcript; every other comment is spoken again. Recomposing an unchanged script speaks nothing and gives the
same audio and transcript; the compose says how many comments it voiced and reused. Deleting the reel deletes its
cache.

**Credentials.** The shipped voice runs locally and needs none. A voice that needs one (a cloud voice, later)
declares its environment variable: the host checks it is set, and passes it into the container by name, so its
value is never written to the reel, the manifest, `flow-reel.json` or the command line.

## Sounds

Clicks and per-character typing taps are automatic. To mark a meaningful moment, play one of the `Sounds`
constants, chained on the element whose action it belongs to, or standalone from the script context:

```ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173" }, async ({ page, sound }) => {
  await page.getByRole("button", { name: "Delete" }).sound(Sounds.navigation.OPEN).click();
  await page.getByText("Deleted").waitFor();
  sound(Sounds.feedback.SUCCESS);
});
```

| Group | Sounds |
|---|---|
| `Sounds.feedback` | `SUCCESS`, `ERROR`, `NOTIFICATION` |
| `Sounds.navigation` | `OPEN`, `CLOSE`, `BACK` |
| `Sounds.controls` | `TOGGLE`, `SELECT` |

A chained sound plays at the moment its element's action is logged (for a click, with the click). `sound(name)`
marks the current time and returns immediately; it adds no pause, performs no browser action and does not infer
whether the operation succeeded, so call it after the state or assertion it describes. A sound is named only by a
`Sounds` constant: a bare string is a type error, and an unknown name fails at run time, including when sounds are
muted.

```sh
npx flow-reel compose demos/settings.ts --no-sfx
```

`--no-sfx` also works before the script. It mutes all sounds while keeping them in the event log, with the
comments, captions and visuals. Sounds never add frames, change speech holds or extend the video; tails reaching
the video end fade out and are trimmed. A sound within ±150 ms inclusive replaces automatic click audio, while the
visual ripple and logged click remain. Other sounds may overlap. Hover/scroll have no automatic sounds.

The palette uses short, related DAEDAL CC0 UI sounds, with three quieter typing taps cycling deterministically.
Effects sit beneath speech and duck another 6 dB over each speech clip, with a 30 ms lead-in and 250 ms recovery.
They remain ducked through pauses inside a clip. The combined effects bus has a -18 dBFS sample-peak ceiling before
final mix processing. SFX-only demos retain quiet fixed levels instead of being normalized to speech loudness.
Final AAC peak checks also apply. See [asset sources, licences and calibration](docker/sfx/README.md).

Typing timestamps follow the logged fixed-delay intent, not measured browser keystrokes. Unicode code points are
kept intact; non-US characters follow Playwright's delayed text insertion. Repeat renders of identical inputs in
the same recording image produce identical decoded sound audio. The comparison below compares speech source hashes,
step timing and the effects written in the script; it does not compare sounds or prove final mixed-audio equality.

The event log records a sound as `{ t, type: "sound", name }`, `name` being the constant's lowercase value. The
selected sounds are bundled in the npm package/image and work offline. The full planning audition library is
not included in the runtime package.

## Verify a reel

```sh
npx flow-reel verify demos/settings.reel
```

Checks the reel against its manifest: every listed file is present with its size and hash, and nothing else is
there apart from `work/`. Exit status is 0 when the reel is whole, 1 when a file is missing, extra or changed (each
is named), and 2 when the folder isn't a reel or its manifest is invalid. It runs on the host without Docker.

## Compare reels

```sh
npx flow-reel compare demos/a.reel demos/b.reel
```

Comparison runs on the host without Docker or FFmpeg. It verifies both reels first (any problem exits 2), then
validates each transcript's schema and sync, and checks
video dimensions/FPS, step order, exact original comments, voice identity, source audio hashes/durations and step
starts within ±150 ms inclusive. It then checks the event logs' effects: the same `autoZoom`, and the same flashes,
shown frames and zooms in order, with equal options and image hashes, each starting within ±150 ms. Clicks, moves,
typing, scrolls and sounds are not compared. Script, image and output paths may differ. Legacy silent transcripts and blank-only
recordings are supported. Exit status is 0 for a match, 1 for valid recordings that differ, and 2 for invalid input,
failed sync or usage errors; diagnostics identify the file or step.

These checks read the transcript and event log only. They do not open referenced audio, caption or video files, prove visual/UI
equality, or promise identical encoded MP4 bytes. Valid action/end/video durations may differ between recordings;
only step starts have the 150 ms comparison tolerance. Recording automatically checks that all clips fit their
step windows, including the speech tail, before publishing its transcript.

## From 0.1 to 0.2

0.2 replaces the 0.1 script words; a 0.1 script fails to load with a pointer here.

| 0.1 | 0.2 |
|---|---|
| `import { demo } from "flow-reel"` | `import { script, Sounds } from "flow-reel"` |
| `demo(options, async ({ page, step, sfx }) => …)` | `script(options, async ({ page, comment, sound }) => …)` |
| `await step("Save.", () => button.click())` | `comment("Save."); await button.click()` or `await button.comment("Save.").click()` |
| `sfx("success")` | `sound(Sounds.feedback.SUCCESS)` or `button.sound(Sounds.feedback.SUCCESS)` |
| `npx flow-reel record demo.ts` | `npx flow-reel compose demo.ts` |
| transcript version 1, step field `narration` | transcript version 2, step field `comment`; `voice.language` |
| the voice was always Ryan in English | `--speaker`, `--language` or `flow-reel.json` (see [Configure the composer](#configure-the-composer)) |
| event log versions 1 and 2, event `{ type: "sfx" }` | event log version 4, event `{ type: "sound" }`, plus effect events and `autoZoom` |
| `demo.mp4`, `demo.transcript.json`, … beside the script, work files in `.flow-reel/` | one folder, `demo.reel/` (delete old `.flow-reel/` folders) |
| `flow-reel compare a.transcript.json b.transcript.json` | `flow-reel compare a.reel b.reel` |

## Platforms

- **Linux** (Docker or Podman): the container uses the host's network, so `localhost` is your machine. Tested.
- **macOS and Windows** (Docker Desktop): `localhost` in the script is mapped to `host.docker.internal`. Not yet
  tested in CI.

## Known gaps

- Playwright calls the runner doesn't cover run without any mouse motion (the warning names them).
- Camera framing uses pre-action target bounds, not live tracking of elements after navigation or layout changes.

## Develop

```sh
npm ci
npm run typecheck
npm test            # unit tests
npm run test:e2e    # builds the image, tests offline synthesis, and records twice (needs Docker and ffmpeg)
```

`flow-reel compose` always runs the composer inside the image for its package version. From a source checkout it
uses the released image of that version, not your local `src/`, and says so. To record with local changes, build
the image under that tag first: `npm run build && docker build -t ghcr.io/codeonym-oss/flow-reel:$(node -p
"require('./package.json').version") -f docker/Dockerfile .` (remove it afterwards with `docker rmi` to go back to
the released one).

Planning lives in `planning/` (see `groundwork.md`).

## License

MIT
