# Implementation: Replay a demo script on a virtual display and write a silent MP4 with step timings

Planned 2026-11-02 against an empty repository (no commits): this ticket starts the codebase. Settled by story
decisions 002, 008, 009, 010, 011, 012, 013 and this ticket's 001-004.

## Corrections while building (2026-11-03)

What the build found that differs from the steps below; the steps are kept as planned.

- **Master and outputs (decisions 005, 006):** 2560×1440 at device scale 4/3, x264 `ultrafast` CRF 10, written to
  `.flow-reel/<name>/master.mp4` (the folder holds a `.gitignore` of `*`). Beside the script: `<name>.mp4`,
  `<name>.transcript.json`, `<name>.events.json`. The runner fails a recording whose master is more than 3 % shorter
  than the time it ran.
- **Step 7:** `--kiosk` doesn't apply to `newContext()` windows, so Chromium runs as a persistent context with
  `viewport: null`; the screen size is the viewport × the scale.
- **Step 8, clock origin:** ffmpeg's progress lags the capture, so the origin is x11grab's wall-clock `start:` instead.
  A pixel still reaches the master some 30 ms after the runner acts (more under load), so each run flashes a
  full-screen marker at 200 ms, finds its first frame in the master and shifts every time by the measured delay (the
  fallback in Risks). `demo.mp4` starts at about 1 s, after the marker; `.flow-reel/<name>/master.json` holds that
  start (`startMs`) for the render tickets.
- **Steps 5 and 9, timing:** Playwright's round-trips jitter, so every action phase has a fixed time budget, there is
  a lead-in and a 100 ms settle before each step, and the first box read is warmed up before recording.
- **Step 5, clicks:** a click is logged when Playwright's call returns, because it presses only after checks that wait
  for rendered frames (~100 ms, more under load). `type()` and `pressSequentially()` click the field for real.
  `press` is not intercepted (no pointer motion) and logs no event.
- **Review (2026-11-09):**
  - `page.click(selector)` and the other page-level actions run through the selector's wrapped locator (decision 002
    wraps `page` too), instead of warning.
  - The network-idle wait before each step counts the page's requests (`src/runner/network.ts`): Playwright's
    `networkidle` load state only covers the first load. Server-sent event streams are not counted (they stay open;
    checked against a real stream in Chromium); long polling still waits the full 10 s. A page still loading after
    10 s gets a warning, not a failure.
  - The `act` budget is 400 ms: Playwright's click took 35-309 ms on a busy machine and shifted the next steps.
  - No linter: `npm run typecheck` is the lint in steps 1 and 12.
  - A step's start has nothing visible on screen (the pointer isn't drawn yet), so the done check's "frame where it
    visibly starts" is checked on the shared clock: the last click's `t` against the frame its colour change shows.
  - An event's `target` is Playwright's locator description (`getByRole('link', { name: 'Settings' })`), not story
    decision 013's example form (`link "Settings"`).
  - The launcher uses a local image with the right tag before pulling (tags are versions, so they don't change).

## Read first

- Story decisions `../../decisions/009-what-counts-as-the-same-video.md`, `010-demo-script-api.md`,
  `011-transcript-json-schema.md`, `013-events-json-schema.md`: the contracts this ticket writes.
- This ticket's `decisions/001`-`004`.
- Playwright docs: `page.clock`, `page.mouse.move({ steps })`, `addInitScript`, `chromium.launch({ args })`, Docker
  image tags (`mcr.microsoft.com/playwright:v<X>-noble`).
- Node docs: `module.register` (resolve hooks) and type stripping, used to load `demo.ts` without a build step.

## Layout

```
package.json            name flow-reel, type module, bin flow-reel, exports "." → dist/index.js
tsconfig.json           strict, NodeNext, erasable syntax only (so demo.ts runs with Node type stripping)
src/index.ts            public API: demo(), types
src/cli.ts              `flow-reel record <script>`: host side or, with FLOW_REEL_IN_CONTAINER=1, the runner
src/host/launch.ts      engine detection, image tag, pull-or-build, docker run arguments per platform
src/runner/run.ts       orchestration inside the container
src/runner/display.ts   Xvfb start/stop
src/runner/recorder.ts  ffmpeg x11grab master, clock origin, 1080p downscale
src/runner/browser.ts   Chromium launch, stabilisation
src/runner/wrap.ts      wrapped page and locators: eased moves, typing, events
src/runner/easing.ts    path duration and easing
src/runner/load.ts      import demo.ts, resolve "flow-reel" to the runner's copy
src/schema/transcript.ts, src/schema/events.ts   types + validators (version 1)
docker/Dockerfile
test/unit/*.test.ts     vitest
test/e2e/               fixture app + fixture demo + record test (needs Docker)
```

Defaults chosen in the pass (change them here if they're wrong): Chromium as `pwuser` in `--kiosk`, viewport
1920×1080 CSS px at device scale 2 on a 3840×2160 Xvfb; moves 300-700 ms by distance with `easeInOutCubic`; typing
60 ms per character; outputs next to the script: `demo.master.mp4`, `demo.mp4`, `transcript.json`, `events.json`
(named after the script's basename).

## Steps

1. **Scaffold the package:** `package.json`, `tsconfig.json`, vitest, a build to `dist/` (tsc), lint script, `.gitignore`.
   → check: `npm test` runs (no tests yet, exit 0); `npm run build` emits `dist/index.js`.

2. **Schemas:** `transcript.ts` and `events.ts` with the version 1 types of story decisions 011 and 013 and a
   `validate()` each that returns readable errors.
   → check: unit tests accept the decisions' examples verbatim and reject a missing `version`, a negative `t`, a step
   whose `endMs < startMs`.

3. **Public API:** `demo(options, body)` returns a descriptor (options + body) without running anything;
   `options` = `{ url, viewport?: [w, h] }`, default 1920×1080. `step(narration, action)` is supplied by the runner.
   → check: unit test: importing a fixture script gives the descriptor; a type test fails on `step(42, …)`.

4. **Easing:** `moveDuration(from, to)` (300-700 ms, by distance) and `easeInOutCubic`; `pathPoints(from, to, ms, fps)`
   for `page.mouse.move` steps.
   → check: unit tests: monotone progress, endpoints exact, duration bounds at 0 px and at the diagonal.

5. **Wrapped page (decision 002):** a Proxy over `page` whose locator-returning methods (`getBy*`, `locator`,
   `frameLocator`, and chained locator methods) return wrapped locators. Intercepted: `click`, `dblclick`, `hover`,
   `check`, `uncheck`, `fill`, `type`, `pressSequentially`, `press`, `selectOption`, `scrollIntoViewIfNeeded`,
   `page.mouse.wheel`. Each resolves the box centre, eases the mouse there (step 4), appends the event with `t` from
   the shared clock, then calls the original (`fill`/`type` → `pressSequentially` with 60 ms delay, so typing shows).
   Uncovered calls run unchanged and log one warning per method name.
   → check: unit tests against a fake page/locator record the calls in order and the events produced; one test that
   `page.evaluate` warns once.

6. **Loader:** `load.ts` registers a resolve hook so `import … from "flow-reel"` in the mounted script resolves to the
   runner's `dist/index.js`, then `import()`s the script with type stripping.
   → check: unit test loads `test/fixtures/demo.ts` from a temp dir with no `node_modules` and gets the descriptor.

7. **Display and browser:** `display.ts` starts `Xvfb :99 -screen 0 3840x2160x24` and waits for it; `browser.ts`
   launches Chromium headed on `:99` with `--kiosk`, `--window-size=1920,1080`, `--force-device-scale-factor=2`,
   no infobars or first-run UI, the host-resolver rule when `FLOW_REEL_HOST_MAP=1` (decision 003); the context has
   the viewport, `deviceScaleFactor: 2`, `reducedMotion: "reduce"`; `page.clock.install({ time: fixed })`; an init
   script seeds `Math.random`.
   → check: in the container, a screenshot of `xwd -root` (or one ffmpeg frame) shows the fixture page edge to edge,
   no browser chrome.

8. **Recorder and clock (decision 001):** start `ffmpeg -f x11grab -framerate 30 -video_size 3840x2160 -i :99 -c:v
   libx264 -crf 10 -preset veryfast -pix_fmt yuv420p` with `-progress pipe:1`; the clock origin is
   `performance.now()` when ffmpeg first reports `frame>=1`, minus `frame × 1000/30`. All `t`/`startMs` are
   `performance.now() - origin`. Stop with `q` on stdin; then downscale to `demo.mp4` (1920×1080, CRF 18,
   `+faststart`).
   → check: e2e: the fixture page turns a full-screen colour at a step start; the first frame of that colour (ffmpeg
   `signalstats` or sampled frames) is within ±2 frames of the logged `startMs`.

9. **Run orchestration:** `run.ts`: display → recorder → browser → `goto(url)` + network idle → for each `step`:
   network-idle wait, record `startMs`, run the action through the wrapped page, record `actionEndMs`, `endMs =
   actionEndMs` → short tail (500 ms) → stop recorder → write `transcript.json` (video, steps; no narration yet:
   GH-3) and `events.json`, validated by step 2 before writing.
   → check: e2e: both files validate; `steps.length` matches the script.

10. **Dockerfile (decision 004):** `FROM mcr.microsoft.com/playwright:v<X>-noble` (X = the pinned Playwright
    version), `apt-get install xvfb ffmpeg x11-utils`, copy `dist/` and production deps to `/opt/flow-reel`, entry
    `node /opt/flow-reel/dist/cli.js` with `FLOW_REEL_IN_CONTAINER=1`, `USER pwuser`.
    → check: `docker build -f docker/Dockerfile .` succeeds; `docker run --rm <img> ffmpeg -hide_banner -devices`
    lists `x11grab`.

11. **Host launcher (decision 003, 004):** detect `docker` then `podman`; image `ghcr.io/codeonym-oss/flow-reel:<pkg
    version>`; `pull`, and on failure `build` from the Dockerfile in the installed package. Mount the script's
    directory at `/work` (read-write, outputs land beside the script), run as the host uid/gid so outputs aren't owned
    by root. Linux: `--network host`; Docker Desktop (detected via `docker info` OperatingSystem): set
    `FLOW_REEL_HOST_MAP=1`. Exit code and stderr are passed through.
    → check: unit tests on the argument builder for Linux/Desktop/Podman; e2e: `node dist/cli.js record
    test/e2e/demo.ts` on this machine writes the four outputs.

12. **E2E test and CI:** `test/e2e/record.test.ts` serves the fixture app on `127.0.0.1:<random port>` from the host,
    records twice, and asserts: master 3840×2160 at 30 fps and `demo.mp4` 1920×1080 (ffprobe); both JSON files valid;
    same step count and order; every `startMs` within ±150 ms between runs (story decision 009); step 8's marker
    check. CI (GitHub Actions, ubuntu, amd64): lint, unit, build the image, e2e.
    → check: `npm run test:e2e` passes locally twice in a row; the CI workflow passes on the pull request.

13. **README:** install, `flow-reel record`, the script API, outputs, platform notes (decision 003), known gaps
    (uncovered calls warn; no narration or audio yet).
    → check: following the README on a clean clone records the fixture demo.

## Tests

- **Unit (vitest, no Docker):** schemas, easing, the wrapped page against fakes, the loader, the launcher's argument
  builder.
- **E2E (Docker):** the full record of a fixture app, twice: outputs, schema validity, decision 009's timing rule, and
  the frame-accurate clock check. This is the seam the story's done check rests on.

## Risks

- **Clock origin drift:** if ffmpeg's progress lags, every timestamp shifts. Step 8's colour-marker test measures it;
  if it fails, use the marker itself as the origin (flash a frame at start).
- **CPU load at 4K:** x264 at 3840×2160 30 fps on a laptop CPU can drop frames. `-preset veryfast`, and the e2e test
  checks the frame count against the duration (±1 %); if it fails, try `ultrafast` or record 2560×1440.
- **Type stripping limits:** scripts using enums or namespaces won't load. The loader reports the Node error with the
  hint; the agent skill (later) tells agents to write erasable TypeScript.
- **Docker Desktop path untested here:** only Linux runs locally; the launcher's argument builder is unit-tested
  for Desktop, and the README marks macOS/Windows as unverified until the release ticket adds CI for them.
- **Uncovered Playwright calls:** they teleport with no cursor; the warning names them.
