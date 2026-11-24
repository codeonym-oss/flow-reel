# Troubleshooting

Find the cause before composing again. A compose takes minutes, and replaying a script that changes data can make
things worse. A failed compose leaves the previous reel untouched, and its attempt stays in `<name>.reel.partial/`,
with the composer's output in the terminal.

## Setup

**"needs Docker or Podman" or "installed but not responding"**
: No container engine, or its daemon is stopped. Install or start Docker or Podman.

**The first compose stalls on a pull**
: The composer image is about 2.6 GB for a cloud voice and 7 GB for the built-in local voice. That's expected once for
  each. `docker pull ghcr.io/codeonym-oss/flow-reel:<version>-cloud` shows progress (without `-cloud` for the local
  voice).

**A compose pulls the 7 GB image although you want a cloud voice**
: No voice is set, so it uses the built-in local voice. Set `voice.adapter` in `flow-reel.json`, or `--voice`.

**`net::ERR_CONNECTION_REFUSED` at `url`**
: The app isn't running, or it listens on another port. On Linux the container shares the host's network, so
  `localhost` works. On macOS and Windows it's mapped to `host.docker.internal`.

**"The machine is too busy": the compose stops after capture**
: Capture needs about 2.5 free CPU cores. On a busy machine it stops rather than save a video with wrong timing.
  Close heavy apps (builds, other containers) and compose again.

## Voices

**Speech is slow, or the machine struggles**
: The built-in local voice runs on the CPU and needs more than 5 GiB of memory, about a minute a comment.
  Recomposing reuses unchanged comments. Switch to a [cloud voice](guide/voices.md#cloud-voices) to make it fast.

**"voice openai needs OPENAI_API_KEY: set it in the environment and compose again"**
: The key's variable isn't set in this shell. Export it in the shell that runs the compose (`export OPENAI_API_KEY=...`). The key is read from the environment,
  never from `flow-reel.json`.

**A cloud voice rejects the key**
: It fails at once and names the variable to check. Check the key's value and its access to speech models.

**A cloud voice fails with the provider's message about a model or voice**
: flow-reel passes `model` and `speaker` on unchecked. Use names from the provider's current list.

**"unknown speaker" or "unknown language"**
: A name the built-in local voice doesn't have. See [the built-in local voice](guide/voices.md#the-built-in-local-voice).

**"voice.apiKey: keys don't go in flow-reel.json"**
: A key in the file is refused. Put the key in an environment variable, and name it with `apiKeyEnv`.

## Scripts

**The page shows a login**
: The composer's browser is fresh, with no cookies or storage. Sign in within the script with a test account, or use
  a mode of the app that doesn't need one.

**A locator times out**
: The label changed, the element isn't there yet, or something covers it. Wait for the state that comes before it,
  or close the overlay with a real action. Don't add sleeps.

**A warning "`press()` runs without cursor motion"**
: `press`, `evaluate`, `dispatchEvent` and frame actions don't move the pointer. Use a pointer action (`click`,
  `fill`) where the viewer should see it.

**"the page was still loading after 10 s; going on"**
: The app keeps polling, or a request hangs. It's harmless and the step continues, but make sure the script waits
  for its real result.

**A wait inside `speedUp` or `skip` times out after 30 s**
: That's Playwright's default timeout. Give the wait a longer one: `waitFor({ timeout: 120_000 })`.

**"comment() can't be used inside skip()" (or `speedUp`)**
: A comment, a card, an overlay, a nested word or, in `skip`, an effect is inside the callback. Move it before or
  after. Only the wait goes inside.

**"showFrame() was replaced by card.image()"**
: A 0.4 script on 0.5. See [Migration](migration.md).

**A card's image or a custom card's file "doesn't exist" or is "outside the script's folder"**
: Paths are relative to the script, and only its folder is mounted. Move the file under the script's folder.

## The picture

**A success sound plays before the success**
: The sound is placed before the wait. Move it after `await …waitFor()`.

**A zoom cuts off the target**
: Bounds are taken before the action, so a target that moved or grew afterwards is cut off. Wait for the layout to
  settle first, or frame a larger container with `zoomIn`.

**The picture looks soft**
: A `zoomIn` scale above 4/3 enlarges past the recording's resolution. Lower it.

## Reels

**The second compose differs from the first**
: The app's data changed between runs (a duplicate item, for example), or the UI depends on time. The page's clock
  is fixed, but your server isn't. Reset the data before composing.

**`flow-reel verify` fails**
: A file in the reel was edited or added. Compose again rather than patch the manifest, and keep notes and stills
  outside the reel.
