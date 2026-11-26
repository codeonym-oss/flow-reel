# Troubleshooting a compose

Find the cause before composing again: a compose takes minutes, and replaying a script that changes data can make
things worse. A failed run leaves the previous reel untouched. `npx flow-reel logs <script>` prints what its script,
browser and renderer printed, and `npx flow-reel runs` says what can be done with it. When the script needn't change,
`npx flow-reel resume <script>` goes on without recording again.

| Symptom | Likely cause | What to do |
|---|---|---|
| "needs Docker or Podman" / "installed but not responding" | No engine, or its daemon is stopped. | `scripts/preflight.mjs` names it. Ask the person to install or start it; don't do it silently. |
| The first compose stalls on a pull | The composer image is several GB; a cloud voice uses a smaller one, tagged `<version>-cloud`. | Expected once; pull the image `preflight.mjs` names to see progress. |
| "isn't in a workspace" | No `flow-reel.json` at the project's root. | `npx flow-reel init --title "…"` (`language.md`, "The workspace"). |
| "is from before flow-reel 0.8" | A 0.7 `flow-reel.json`. | Ask the person, then `npx flow-reel init` in the project's root and the `git mv` lines it prints. |
| "waiting for … before recording" (or rendering, voicing) | Another run is doing heavy work. | Wait; cancel the other only if it is yours and stale. |
| "stopped: its process ended" | The run's process was killed or the computer went off. | `npx flow-reel resume <script>`. |
| "recording lost" | The recording wasn't finished. | Check what the script changed in the app, reset it, and compose again. |
| "took longer than its limit" | A phase hung, or the limit is short. | `logs` says where it was; change `limits` only for work that is really longer. |
| `net::ERR_CONNECTION_REFUSED` at `url` | The app isn't running, or listens on another port. | Start it; check with `preflight.mjs --url`. On Linux the container shares the host's network. |
| The page shows a login | The composer's browser is fresh. | See `exploring.md`, "Logins and data". |
| A locator times out | The label changed, the element isn't there yet, or something covers it. | Re-explore that screen; wait for the state that precedes it; close the overlay with a real action. Don't add sleeps. |
| A warning "`press()` runs without cursor motion" | `press`, `evaluate`, `dispatchEvent` or a frame action. | Use a pointer action (`click`, `fill`) where the viewer should see it. |
| "the page was still loading after 10 s; going on" | The app keeps polling, or a request hangs. | Harmless; the step continues. Make sure the script waits for its real result. |
| A success sound before the success | The sound is placed before the wait. | Move it after `await …waitFor()`. |
| A zoom cuts off the target | Bounds were taken before the target moved or grew. | Wait for the layout to settle before the step; or frame it with `zoomIn` on a larger container. |
| A picture looks soft | `zoomIn` scale above 4/3. | Lower the scale, or accept it for small text only. |
| "The machine is too busy" — the compose stops after capture | Capture needs about 2.5 free CPU cores; on a busy machine it stops rather than save a video with wrong timing. | Close heavy apps (builds, other containers) and compose again. |
| Speech is slow, or the machine struggles | Local speech runs on the CPU and needs several GB of memory. | Expect about a minute a comment; recomposing reuses unchanged comments. Close heavy apps, or offer a cloud voice (`comments.md`). |
| "unknown speaker" / "unknown language" | A name not in the list. | Use one from `language.md`'s settings table. |
| The second compose differs from the first | The app's data changed between runs (a duplicate item), or the clock/time-dependent UI. | Reset the data before composing; the page clock is fixed, but the app's server isn't. |
| `flow-reel verify` fails | A file in the reel was edited or added. | Recompose; don't patch the manifest. Keep notes and stills outside the reel. |
| A wait inside `speedUp` or `skip` times out after 30 s | Playwright's default timeout. | Give the wait a `timeout` longer than the slowest run you saw: `waitFor({ timeout: 120_000 })`. |
| "comment() can't be used inside skip()" (or `speedUp`) | A comment, a card, an overlay, a nested word or (in `skip`) an effect inside the callback. | Move it before or after; only the wait goes inside. |
| "speedUp is not a function", "card is undefined" | A runtime older than this plugin supports. | `npm install --save-dev flow-reel`; `preflight.mjs` reports the version. |
| "showFrame() was replaced by card.image()" | A script from flow-reel 0.4. | `await card.image("diagram.png", { frame: "none", fit: "contain", ms: 3000 })`. |
| A card's image or a custom card's file "doesn't exist" or is "outside the scripts folder" | The path is relative to the script, and the composer sees only the scripts folder. | Move the file into the scripts folder. |

When a request needs something flow-reel doesn't have (music, another voice provider, a duration, a new effect),
say so plainly and offer what it can do instead; don't approximate it with tricks that change the app's behaviour.
