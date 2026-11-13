# flow-reel

Record reproducible feature demos from a short Playwright script. A coding agent (or a person) explores the app,
writes the script, and `flow-reel` replays it in a sandbox on a virtual display while recording the screen. The same
script gives the same video, step for step.

This release records narrated video with captions, fitted step timings, a smooth cursor, click ripples and
automatic zoom, click/typing sounds and optional named action cues.

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

The package and recording image use the same version. Version 0.1.0 is available on npm with a public recording
image for Linux amd64 and arm64.
See [release setup and verification](docs/releasing.md) for publication status requirements and contributor steps.

## Write a demo

A demo is a TypeScript file whose default export is `demo(options, body)`. Each `step(narration, action)` is one unit
of the demo: the sentence that will be spoken, and the Playwright actions it describes.

```ts
// demos/settings.ts
import { demo } from "flow-reel";

export default demo({ url: "http://localhost:4173" }, async ({ page, step }) => {
  await step("Open the settings page.", () => page.getByRole("link", { name: "Settings" }).click());
  await step("Turn on dark mode.", () => page.getByLabel("Dark mode").check());
});
```

- `url`: where the demo starts. `localhost` reaches the app running on your machine.
- `viewport`: CSS pixels, `[1920, 1080]` by default.
- `page` is a Playwright `Page`. Clicks, hovers, `check`, `fill`, `type`, `selectOption` and `page.mouse.wheel` move
  the mouse visibly to their target and type at a readable speed. Other calls that act on the page, such as
  `page.evaluate` or `locator.dispatchEvent`, run as they are, without any mouse motion, and print a warning once.
- Write erasable TypeScript only: no `enum`, `namespace` or parameter properties. Import only from `flow-reel` and
  from files in the same folder as the script.

## Record

```sh
npx flow-reel record demos/settings.ts
```

Next to the script:

| File | What it is |
|---|---|
| `settings.mp4` | The polished narrated demo, 1920×1080, 30 fps, with AAC narration and interaction sounds. |
| `settings.transcript.json` | Each step's original narration and `startMs`, `actionEndMs` and `endMs` on the video's timeline (schema version 1). |
| `settings.events.json` | Every move, click, keystroke run, scroll and explicit sound cue, timed the same way (schema version 2). |
| `settings.srt` | Captions for a subtitle-capable video player. |
| `settings.vtt` | WebVTT captions for a browser's `<video>` / `<track>`. |
| `settings.audio/000.wav` | Local speech clips, named by zero-based step index. |

Each caption shows one step's narration from its `startMs` to its `endMs`. Caption whitespace is normalized and the
player wraps the text; the transcript keeps the original narration. Blank narration and steps lasting zero
milliseconds stay in the transcript but produce no caption. Narrated steps include the full speech clip and
at least 200 ms afterward.

Narration uses Qwen3-TTS 0.6B CustomVoice, Ryan in English, through the official Python runtime on CPU. Model and
tokenizer assets are pinned and downloaded when the image is built; synthesis runs offline without a key. Speech
is generated after capture finishes. The transcript records the voice, seed, and each clip's relative file path,
duration in milliseconds and complete-file SHA-256 hash. Copy the audio folder with its transcript when sharing it.

Synthesis normalizes whitespace without interpreting caption escapes; the transcript preserves the original text.
Blank narration produces no clip. Clip numbers retain step indexes, so skipped steps leave gaps. Rerunning replaces
the generated numeric WAVs in this demo's audio folder; keep personal audio under other filenames or folders.
Nonblank narration on a zero-duration action still produces speech. Each action runs once at normal speed.
After its callback returns (`actionEndMs`), the recorder waits for network quiet (500 ms, bounded at 10 seconds),
then captures another 100 ms. Scripts must still await the UI state they intend to show; network quiet does not
prove that an operation succeeded. A timeout prints a warning and continues.

After capture and synthesis finish, the renderer adds only the whole frames needed to fit speech plus its tail,
freezing the last frame of that settled window. Narration starts alongside its action at `startMs`. Longer actions
continue normally after speech finishes. Transcript windows, captions, events and the master all use this final
timeline. Blank narration gets no speech padding; an all-blank demo can still have interaction sounds.
If it has no effects, or `--no-sfx` is set, it has no audio stream.

Visual polish is automatic: a white arrow with a dark outline follows logged pointer motion, and a blue ring
expands and fades for 400 ms at each click. The cursor and rings keep their screen size while the page zooms.
Clicks ease the camera in over 650 ms; it stays zoomed until 2 seconds after the latest click or typing ends,
then eases out over 800 ms. Further activity extends the zoom. Hover and scrolling alone do not trigger it.
The camera follows the pointer and stays within the recorded page. Zoom is capped at 4/3 (about 1.33×), using
the default 1440p master for sharp 1080p output; large targets reduce the zoom to keep their visible bounds
framed with padding. Bounds are captured before the action, so they do not track subsequent layout changes.
Partly off-screen elements can only show the portion captured in the master. Old version 1 event logs without
bounds use click points instead, without a whole-element framing guarantee. Polish preserves every frame and
all narration, transcript and caption times. Zoom animations end with the video and do not lengthen it.
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

Captions escape `&`, `<` and `>` so narration is emitted without raw tags. WebVTT displays the literal text; some
SRT players display escape sequences such as `&lt;` instead. Use WebVTT in a browser when literal symbols matter.

In `.flow-reel/settings/`: `capture.mp4` is the original 2560×1440 recording; `master.mp4` is the clean recording
with added holds, preserved before cursor/zoom rendering; `master.json.startMs` gives delivery time zero within
the master, preserving its calibration pre-roll. Events use CSS pixels and final delivery times; click and typing
events may include `bounds: { x, y, width, height }` in CSS pixels.
`voice.wav` is the normalized voice-only bus on the delivery timeline; `sfx.wav` is the ducked effects
bus and `mix.wav` is the final normalized voiced mix when effects exist. The `.flow-reel/` folder ignores itself in git;
the files next to the script are yours to commit or not.

To keep runs the same, the runner fixes the viewport, device scale, `prefers-reduced-motion`, the page's clock
(`2026-01-05T09:00:00Z`) and `Math.random`'s seed, and waits for the network to go idle before each step. Two runs of
a script have the same steps, each starting within ±150 ms.

## Sound effects

Clicks and per-character typing taps are automatic. To mark a meaningful action, use `sfx` from the demo context:

```ts
export default demo({ url: "http://localhost:4173" }, async ({ page, step, sfx }) => {
  await step("Save your settings.", async () => {
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Settings saved").waitFor();
    sfx("success");
  });
});
```

The names are `success`, `error`, `notification`, `open`, `close`, `toggle`, `back` and `select`.
`sfx(name)` marks the current time and returns immediately. It adds no pause, performs no browser action and does
not infer whether the operation succeeded; call it after the state or assertion it describes. Unknown names fail
clearly, including when effects are muted. Existing scripts need no changes.

```sh
npx flow-reel record demos/settings.ts --no-sfx
```

`--no-sfx` also works before the script. It mutes all effects while retaining cue events, narration, captions and
visuals. Sound effects never add frames, change narration holds or extend the recording; tails reaching the video
end fade out and are trimmed. An explicit cue within ±150 ms inclusive replaces automatic click audio, while the
visual ripple and logged click remain. Other explicit cues may overlap. Hover/scroll have no automatic sounds.

The palette uses short, related DAEDAL CC0 UI sounds, with three quieter typing taps cycling deterministically.
Effects sit beneath narration and duck another 6 dB over each speech clip, with a 30 ms lead-in and 250 ms recovery.
They remain ducked through pauses inside a clip. The combined effects bus has a -18 dBFS sample-peak ceiling before
final mix processing. SFX-only demos retain quiet fixed levels instead of being normalized to speech loudness.
Final AAC peak checks also apply. See [asset sources, licences and calibration](docker/sfx/README.md).

Typing timestamps follow the logged fixed-delay intent, not measured browser keystrokes. Unicode code points are
kept intact; non-US characters follow Playwright's delayed text insertion. Repeat renders of identical inputs in
the same recording image produce identical decoded effect audio. The transcript comparison below still compares
speech source hashes and step timing; it does not compare effects or prove final mixed-audio equality.

New recordings write event schema version 2, adding `{ t, type: "sfx", name }`; updated readers also accept version 1
action logs. Older tools that only understand v1 need upgrading for new logs. Transcript schema remains version 1.
The selected sounds are bundled in the npm package/image and work offline. The full planning audition library is
not included in the runtime package.

## Compare recordings

```sh
npx flow-reel compare demos/a.transcript.json demos/b.transcript.json
```

Comparison runs on the host without Docker or FFmpeg. It validates each transcript's schema and sync, then checks
video dimensions/FPS, step order, exact original narration, voice identity, source audio hashes/durations and step
starts within ±150 ms inclusive. Script and output paths may differ. Legacy silent transcripts and blank-only
recordings are supported. Exit status is 0 for a match, 1 for valid recordings that differ, and 2 for invalid input,
failed sync or usage errors; diagnostics identify the file or step.

These checks read transcript data only. They do not open referenced audio, caption or video files, prove visual/UI
equality, or promise identical encoded MP4 bytes. Valid action/end/video durations may differ between recordings;
only step starts have the 150 ms comparison tolerance. Recording automatically checks that all clips fit their
step windows, including the speech tail, before publishing its transcript.

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

Planning lives in `planning/` (see `groundwork.md`).

## License

MIT
