# Troubleshooting a compose

Find the cause before composing again: a compose takes minutes, and replaying a script that changes data can make
things worse. A failed compose leaves the previous reel untouched; its attempt is in `<name>.reel.partial/`, with
the composer's output in the terminal.

| Symptom | Likely cause | What to do |
|---|---|---|
| "needs Docker or Podman" / "installed but not responding" | No engine, or its daemon is stopped. | `scripts/preflight.mjs` names it. Ask the person to install or start it; don't do it silently. |
| The first compose stalls on a pull | The composer image is several GB. | Expected once; `docker pull ghcr.io/codeonym-oss/flow-reel:<version>` shows progress. |
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
| "speedUp is not a function" | A runtime older than 0.4.0. | `npm install --save-dev flow-reel`; `preflight.mjs` reports the version. |
| "card is undefined" / "callout is not a function" | A runtime older than 0.5.0. | `npm install --save-dev flow-reel`. |
| "showFrame() was replaced by card.image()" | A 0.4 script on 0.5. | `await card.image("diagram.png", { frame: "none", fit: "contain", ms: 3000 })`. |
| A card's image or a custom card's file "doesn't exist" or is "outside the script's folder" | The path is relative to the script, and only its folder is mounted. | Move the file under the script's folder. |

When a request needs something flow-reel doesn't have (music, another voice provider, a duration, a new effect),
say so plainly and offer what it can do instead; don't approximate it with tricks that change the app's behaviour.
