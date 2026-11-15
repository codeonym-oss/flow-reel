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
| Speech is slow, or the machine struggles | Local speech runs on the CPU and needs several GB of memory. | Expect about a minute a comment; recomposing reuses unchanged comments. Close heavy apps. |
| "unknown speaker" / "unknown language" | A name not in the list. | Use one from `language.md`'s settings table. |
| The second compose differs from the first | The app's data changed between runs (a duplicate item), or the clock/time-dependent UI. | Reset the data before composing; the page clock is fixed, but the app's server isn't. |
| `flow-reel verify` fails | A file in the reel was edited or added. | Recompose; don't patch the manifest. Keep notes and stills outside the reel. |
| A 0.1 script fails to load | `demo`, `step`, `sfx` are 0.1 words. | Rewrite with `script`, `comment`, `sound` (`language.md`). |

When a request needs something flow-reel doesn't have (music, another voice provider, a duration, a new effect),
say so plainly and offer what it can do instead; don't approximate it with tricks that change the app's behaviour.
