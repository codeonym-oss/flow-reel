# flow-reel

Record reproducible feature demos from a short Playwright script. A coding agent (or a person) explores the app,
writes the script, and `flow-reel` replays it in a sandbox on a virtual display while recording the screen. The same
script gives the same video, step for step.

This release records **silent** video with step timings. Narration, captions, voice, cursor and zoom polish, and sound
effects come in later releases.

## Requirements

- Node.js 22.18 or later (scripts are TypeScript, run with Node's type stripping).
- Docker or Podman. The recording runs in the `ghcr.io/codeonym-oss/flow-reel:<version>` image; when it can't be
  pulled, `flow-reel` builds it locally once (a few minutes).
- About 2.5 free CPU cores while recording. On an overloaded machine the recording stops with an error rather than
  save a video whose timing is off.

## Install

```sh
npm install --save-dev flow-reel
```

flow-reel isn't published yet. Until it is, build a package from a clone (`npm ci && npm run build && npm pack`) and
install the `.tgz` it writes.

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
| `settings.mp4` | The silent demo, 1920×1080, 30 fps. |
| `settings.transcript.json` | Each step's `startMs`, `actionEndMs` and `endMs` on the video's timeline (schema version 1). |
| `settings.events.json` | Every move, click, keystroke run and scroll the runner made, timed the same way (schema version 1). |

In `.flow-reel/settings/`: the 2560×1440 master the polish steps will render from. The `.flow-reel/` folder ignores
itself in git; the files next to the script are yours to commit or not.

To keep runs the same, the runner fixes the viewport, device scale, `prefers-reduced-motion`, the page's clock
(`2026-01-05T09:00:00Z`) and `Math.random`'s seed, and waits for the network to go idle before each step. Two runs of
a script have the same steps, each starting within ±150 ms.

## Platforms

- **Linux** (Docker or Podman): the container uses the host's network, so `localhost` is your machine. Tested.
- **macOS and Windows** (Docker Desktop): `localhost` in the script is mapped to `host.docker.internal`. Not yet
  tested in CI.

## Known gaps

- No narration, captions or audio yet.
- No cursor drawn in the video yet: the runner logs the motion in `events.json` for the polish step.
- Playwright calls the runner doesn't cover run without any mouse motion (the warning names them).

## Develop

```sh
npm ci
npm run typecheck
npm test            # unit tests
npm run test:e2e    # builds the image and records a fixture app twice (needs Docker and ffmpeg)
```

Planning lives in `planning/` (see `groundwork.md`).

## License

MIT
