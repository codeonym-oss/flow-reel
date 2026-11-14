# GH-31 implementation plan

Planned 2026-11-14 against `main` at 516774d (typecheck clean, 132 unit tests passing). Decisions: story 004, 007,
010; this ticket's 001–005.

## Read first

- `src/composer/ports.ts`: `Cassette`, `CassetteStore`, `CassetteResult`, `Integration`.
- `src/adapters/folder/store.ts`: today's layout (loose results beside the script, work files in `.flow-reel/<name>/`).
- `src/composer/compose.ts`: `store.open(scriptPath)`, `cassette.work.*`, `audioDir`, `audioRoot`, `videoFile`, `commit`.
- `src/composer/voicing.ts`: a clip's transcript path is `${basename(audioDir)}/NNN.wav`, so an `audio/` folder
  inside the reel gives `audio/000.wav` with no change here.
- `src/composer/media/render.ts`: `mix.wav` and `sfx.wav` land beside `voice` (`dirname(voice)`), so in `work/`.
- `src/cli.ts`: argument parsing (flags take no value today), `compare`.
- `src/compare.ts`: `compareTranscripts(left, right)`.
- `src/host/launch.ts`: `buildRunArgs`, `launch` (mounts only the script's folder at `/work`).
- `src/composer/schema/check.ts`, `transcript.ts`: the validation style to follow.
- Tests: `test/unit/store.test.ts`, `cli.test.ts`, `launch.test.ts`, `layout.test.ts`; `test/e2e/record.test.ts`,
  `compare.test.ts`; `scripts/consumer.ts`; `.github/workflows/ci.yml` (the `compare` usage smoke check).
- Docs: `CONTEXT.md`, `README.md` ("Compose", the `.flow-reel/` paragraph, "Compare recordings", "From 0.1 to 0.2").

## Steps

1. **Rename cassette to reel in code (story decision 010).** `Cassette` → `Reel`, `CassetteStore` → `ReelStore`,
   `CassetteResult` → `ReelResult`, the `store`/`cassette` variables in `compose.ts`, comments in `layout.test.ts`.
   No behaviour change.
   → check: `grep -rni cassette src test scripts` is empty; typecheck and unit tests pass.

2. **Name the integration.** `Integration` gains `name: string`; `playwright.name = "playwright"`.
   → check: typecheck.

3. **Manifest schema.** `src/composer/schema/manifest.ts`: the `Manifest` type of decision 003 and
   `validateManifest(value)`, in the style of `transcript.ts` (version 1; `script.file`, 64-hex `sha256`;
   `composer.version`, `composer.platform`; `integration`; optional `voice` as in the transcript; `files` nonempty,
   each `path` relative with no `..` and not under `work/`, `bytes` ≥ 0, 64-hex `sha256`, sorted by path, no
   duplicates).
   → check: new cases in `test/unit/schema.test.ts`: a valid manifest passes; a wrong version, an unsorted or
   duplicate list, a `../x` or `work/x` path, a bad hash each fail with a named error.

4. **Hash and verify a reel folder.** `src/reel.ts` (host side, beside `compare.ts`; no Docker, no FFmpeg):
   - `listReelFiles(dir)`: every regular file under `dir`, relative, sorted, skipping `manifest.json` and `work/`;
   - `hashFiles(dir, paths)`: `{ path, bytes, sha256 }[]`;
   - `verifyReel(dir)`: `{ errors, differences }` like `compareTranscripts`. Errors: not a folder, no or unreadable
     `manifest.json`, `validateManifest` errors. Differences: each missing, extra or changed file
     (`audio/001.wav changed`, `notes.txt is not in the manifest`).
   → check: `test/unit/reel.test.ts` on temp folders: a whole reel verifies; deleting, adding and editing a file each
   give one named difference; a file inside `work/` is ignored; a folder with no manifest is an error.

5. **The folder store writes a reel (decisions 001, 002, 005).** `folderStore.open(scriptPath, outDir?)`:
   - the reel is `<outDir ?? dirname(script)>/<name>.reel`; the store removes a leftover `<name>.reel.partial/`,
     creates it with `work/` and `work/.gitignore` (`*`), and returns paths inside it: `work.*` in `work/`,
     `audioDir` = `audio/`, `audioRoot` = the partial folder, `videoFile` = `video.mp4`;
   - `commit({ transcript, events, captions, about })` moves `work/delivery.mp4` to `video.mp4`, writes
     `transcript.json`, `events.json`, `captions.srt`, `captions.vtt`, then `manifest.json` last from `about` plus
     `hashFiles(listReelFiles(partial))`, then removes the old reel and renames the partial folder into place.
   The core builds `about` (step 6). The store imports the hashing helpers from `src/reel.ts`.
   → check: rewritten `test/unit/store.test.ts`: the paths; the committed reel's exact file list; `verifyReel` passes
   on it; an existing reel is replaced; a reel left in place when `commit` is never called (a failed compose) is
   unchanged and the partial folder remains; a leftover partial folder is cleared by the next `open`; `--out` puts
   the reel in that folder; nothing is written beside the script except the reel (and the partial folder).

6. **Compose fills the manifest's facts.** `compose()` takes `composerVersion` in its options (the CLI reads it from
   `package.json`, which the image copies to `/opt/flow-reel`), and `outDir`. It builds
   `about = { script: { file, sha256 }, composer: { version, platform: linux/<amd64|arm64> }, integration:
   integration.name, voice }` and passes it to `commit`. The transcript's `video.file` becomes `video.mp4`.
   → check: typecheck; unit tests; the e2e checks of step 9.

7. **CLI: `--out`, `verify`, and `compare` on reels (decision 004).**
   - `compose <script> [--no-sfx] [--out <dir>]`: `--out` takes a value; a missing value or a repeated flag is a
     usage error. Inside the container the CLI passes `outDir` to `compose`.
   - `verify <reel>`: prints each difference and exits 1, prints errors and exits 2, prints
     `Reel matches its manifest (N files).` and exits 0.
   - `compare <a.reel> <b.reel>`: verifies both (any error or difference exits 2, prefixed with the reel's path), then
     reads each `transcript.json` and runs `compareTranscripts` as today. A path ending in `.json` gets
     `flow-reel: compare takes two reel folders, e.g. demos/a.reel demos/b.reel`, exit 2.
   - USAGE lists all three commands.
   → check: `test/unit/cli.test.ts` cases for each usage error, for `verify` exit codes 0/1/2, and the `.json` message.

8. **Host launcher mounts `--out`.** `buildRunArgs` gains `outDir?`: when set, `-v <outDir>:/out` and `--out /out`
   are added. `launch` resolves `--out` from the current directory and creates it first, so the engine doesn't create
   it as root.
   → check: `test/unit/launch.test.ts`: the args with and without `outDir`.

9. **End-to-end tests and the consumer check.** `test/e2e/record.test.ts` reads `demo.reel/transcript.json`,
   `events.json`, `captions.*`, `audio/000.wav`, `video.mp4` and `work/*`; asserts the beside-the-script listing is
   exactly `demo.ts` and `demo.reel`; asserts `verifyReel` passes on both runs and `dist/cli.js compare a.reel b.reel`
   exits 0; the missing-voice test asserts no `demo.reel` exists afterwards. `test/e2e/compare.test.ts` builds two
   small reels (a transcript, a dummy video, a manifest from `hashFiles`) and keeps its exit-status checks; it adds an
   altered file (exit 2 naming it). `scripts/consumer.ts` reads from `demo.reel/` and runs `flow-reel verify`. The CI
   smoke check (`compare` prints usage) still holds.
   → check: CI e2e on amd64 and arm64, and the consumer job, pass on the pull request.

10. **Docs.** `CONTEXT.md`: Cassette → Reel, Cassette store → Reel store, Cassette cache → Reel cache, "cassette"
    added to the avoid words, the status note updated (reels land with #31; effects with #32). README: the intro
    paragraph uses "reel"; "Compose" shows the reel layout and `--out`; the `.flow-reel/` paragraph describes
    `work/`; "Compare recordings" takes reels, and a short "Verify a reel" section follows it; "From 0.1 to 0.2" gains
    a row for the outputs (loose files → `<name>.reel/`).
    → check: `grep -rni cassette README.md CONTEXT.md src` is empty; the README examples match the CLI usage.

## Tests

- **Unit:** the manifest schema (step 3); hashing and verifying at the `src/reel.ts` seam on real temp folders (step 4);
  the folder store's layout, swap and failure behaviour (step 5); CLI parsing and exit codes (step 7); the launcher's
  mount (step 8).
- **e2e:** a real compose writes one verified reel per run, and `compare` of two real reels matches (step 9).
- **Consumer:** the packed CLI composes into a reel that `flow-reel verify` accepts.

## Risks

- **The swap is two operations** (remove the old reel, rename the partial folder). A crash between them leaves only
  the partial folder: no reel, but nothing half-old. Checked by the store test of the replacement; accepted.
- **`--out` and ownership:** a folder the engine creates for a mount is owned by root. The launcher creates it first
  (step 8).
- **Docker Desktop paths** for a second mount behave like the first; covered by the same `buildRunArgs` shape.
- **Breaking for anyone reading the 0.1 file names** (scripts, CI). Expected in 0.2; the migration guide (#34) lists
  it, and leftover `.flow-reel/` folders can be deleted.
- **Large reels:** `work/` keeps the 1440p capture and master. Ignored by git; documented in the README.

## Corrections during the build

1. **The caption player test reads from the reel.** `test/e2e/player.ts` fetches `/demo.reel/video.mp4` and
   `/demo.reel/captions.vtt`, and still writes its screenshot beside the script, so it never adds a file to the reel
   (which `verify` would report as extra). The layout test ignores that screenshot and `record.log`.
2. **The consumer check runs `flow-reel verify`** through the same `npx` package, so the packed CLI's new command is
   exercised too.
3. **`compare` keeps its JSON-read guard:** after both reels verify, an unreadable `transcript.json` still exits 2
   naming the reel, as a bad transcript file did before.
4. **The manifest always has a voice** today: the voice port always names one. The schema keeps it optional, as
   decision 003 says, for a reel composed without a voice later.
