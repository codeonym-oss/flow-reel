# Quickstart

Five minutes from nothing to a narrated video. You need Node 22.18+, Docker or Podman, and ideally an API key for a
cloud voice ([Installation](installation.md)).

## 1. Get an app to film

Use your own app running on `localhost`, or the small example app that ships with flow-reel's repository (no
installs, no network):

```sh
git clone --depth 1 https://github.com/codeonym-oss/flow-reel.git
mkdir orbit && cp flow-reel/plugin/examples/saved-views/{index.html,serve.mjs} orbit/ && cd orbit
node serve.mjs            # Orbit is on http://localhost:4173/
```

Leave it running, and open a second terminal in the same folder.

## 2. Install flow-reel

```sh
npm init -y >/dev/null
npm install --save-dev flow-reel
npx flow-reel init --title Orbit
```

`init` makes the folder a **workspace**: it writes `flow-reel.json` and the scripts folder, `reels/`.

## 3. Write a script

Save this as `reels/tour.reel.ts`:

```ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173/" }, async ({ page, comment, sound }) => {
  comment("Here are this quarter's projects. Let's keep the active ones.");
  await page.getByRole("button", { name: "Active" }).click();

  await page.getByRole("button", { name: "Save view" })
    .comment("Save the filter as a view, so it's one click away next time.")
    .click();
  await page.getByLabel("View name").fill("Active work");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await page.getByRole("status").filter({ hasText: "saved" }).waitFor();
  sound(Sounds.feedback.SUCCESS);
});
```

It is plain Playwright with two flow-reel words:

- `comment(text)` is a spoken line. It opens a step that takes in every action until the next comment. Chained on a
  locator (`.comment(...)`), it opens the step at that element's action.
- `sound(...)` plays a sound at that moment. Here it plays after the visible result, never before.

## 4. Compose it

With a cloud voice (recommended, done in seconds):

```sh
export OPENAI_API_KEY=...
npx flow-reel compose reels/tour.reel.ts --voice openai --save-config
```

Or with the built-in local voice (no key, offline, about a minute a comment on a laptop CPU):

```sh
npx flow-reel compose reels/tour.reel.ts
```

The first compose pulls the composer image (several GB). Later ones start at once. `--save-config` keeps the voice in
`flow-reel.json`, so the next compose, and anyone sharing your scripts, uses the same one. Commit the file with them.

Each compose is a [run](../guide/runs.md). It shows its progress, and goes on if you close the terminal.

## 5. Watch it

```text
reels/out/tour.reel/
├── video.mp4          ← the video, 1920×1080, with speech and sounds
├── captions.vtt       ← captions for a browser
├── captions.srt       ← captions for a video player
├── transcript.json    ← each step's comment and timing
├── events.json        ← every click, keystroke, sound and effect
├── audio/             ← each comment's speech clip
└── manifest.json      ← every file's size and hash
```

Open `reels/out/tour.reel/video.mp4`. The cursor glides to each button, clicks ripple, the camera zooms in on what is
clicked, and each comment is spoken over its step.

## 6. Change a line

Edit the second comment and compose again. Only that comment is spoken again: every unchanged comment reuses its
clip from the reel already on disk. The compose tells you how many comments it voiced and how many it reused.

## Next

- [Your first reel](../tutorials/first-reel.md): the full tutorial, with zoom, cards and overlays.
- [Make reels with Claude](../tutorials/with-claude.md): let an agent write and compose the script.
- [Demos](../demos.md): a finished reel and its script.
