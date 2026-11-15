# GH-33 implementation plan

Planned 2026-11-14 against `main` at 0c6018f (166 unit tests pass). Decisions: this ticket's 001 (as superseded by
004 for credentials), 002-005; story 005, 007, 010; GH-31 001, 003, 005.

## Read first

- `src/cli.ts`: `parseCompose`, the container branch that hard-wires `playwright`, `qwen`, `folderStore`.
- `src/host/launch.ts`: `buildRunArgs`, `launch` (mounts, the run's exit code).
- `src/composer/ports.ts`: `Voice` (`voice` record, `synthesize`), `Reel`, `ReelStore`.
- `src/adapters/qwen/voice.ts` and `docker/tts/worker.py`: speaker `Ryan` and `English` are hard-coded; stdin is a
  JSON array of jobs.
- `src/composer/voicing.ts`: `voiceSteps` (stages clips in `audio/.pending-*`, measures them, swaps them in).
- `src/adapters/folder/store.ts`: builds `<name>.reel.partial/`, swaps it over `<name>.reel/` on commit, so the
  previous reel is readable for the whole compose.
- `src/composer/compose.ts` (voicing call, transcript and manifest `voice`).
- `src/composer/schema/{transcript,manifest}.ts` (`voice` record), `src/compare.ts` (`voice.*` checks).
- Tests: `test/unit/{cli,launch,tts,store,schema,compare}.test.ts`, `test/e2e/{record,tts}.test.ts`.
- Docs: README (voice paragraph, CLI usage), CONTEXT.md (**Voice**, **Reel cache**).

## Steps

1. **The settings and what can be chosen** in a new `src/settings.ts`, which runs on the host as well (no Playwright
   or FFmpeg imports, like `src/reel.ts`). It holds:
   - the known adapters' metadata: integration `playwright`; voice `qwen3-tts-0.6b` with its speakers and languages
     (decision 003) and defaults `Ryan`/`english`; each with `credentials: string[]` (empty for both);
   - `Settings = { integration; voice: { adapter; speaker; language } }` and `DEFAULT_SETTINGS`;
   - `validateConfig(value)` for `flow-reel.json`: `{ version: 1, integration?, voice?: { adapter?, speaker?,
     language? } }`; an unknown key fails with the keys it takes;
   - `resolveSettings(file, flags)`: flag over file over default (decision 001). When the voice adapter comes from a
     flag and differs from the file's, the file's speaker and language are dropped;
   - `checkSettings(settings)`: an unknown integration, voice, speaker or language fails with the list of known
     ones, e.g. `unknown voice "x"; known voices: qwen3-tts-0.6b`.
   → check: `test/unit/settings.test.ts`: defaults; each precedence case; the adapter-switch case; each unknown name's
   message; a bad config file (wrong version, unknown key, wrong types).

2. **Flags.** `parseCompose` accepts `--integration`, `--voice`, `--speaker`, `--language` (each once, each with a
   value) and `--save-config`; `USAGE` lists them.
   → check: `cli.test.ts`: each flag parsed; a repeated flag or a missing value prints the usage.

3. **The host reads, checks and writes the configuration** (decisions 001, 004, 005). `launch` reads
   `flow-reel.json` from the script's folder when present (errors name the file), resolves and checks the settings
   before pulling the image, and checks each declared credential is set (`voice x needs NAME`). `buildRunArgs` gains
   `settings` and `credentials`: it passes the resolved settings as the four flags after the script, and each
   credential as `-e NAME` (name only). After the container exits with 0, the host writes `flow-reel.json`
   (version 1, all settings, two-space JSON) when there was none or with `--save-config`, and says so in one line.
   → check: `launch.test.ts`: run arguments carry the settings; `-e NAME` and never the value, with a fake adapter
   declaring a credential; the missing-credential error; writing helpers tested on a temp folder (created when
   absent, untouched when present, overwritten with `--save-config`, not written after a failed run).

4. **The container picks the adapters by name.** The container branch of `src/cli.ts` checks the settings it
   received again (`checkSettings`), then picks `playwright` and `qwenVoice({ speaker, language })`.
   → check: `cli.test.ts`: an unknown name in the container fails with the list, before any adapter loads.

5. **The Qwen voice takes a speaker and a language.** `qwen` becomes `qwenVoice({ speaker, language })`, with
   `voice: { adapter: "qwen3-tts-0.6b", voice: speaker, seed: 0, language }`. The worker's stdin becomes
   `{ speaker, language, jobs }`; it lower-cases the speaker for the model and passes the language. A comment in
   the adapter says its name must change when its generation settings change, since the name is in the cache key.
   → check: `test/e2e/tts.test.ts` voices one line with a non-default speaker and language in the image.

6. **`language` in the voice record.** `Transcript.voice` and `ManifestAbout.voice` gain `language` (required;
   transcript version 2 is unreleased, so no version change); `compareTranscripts` also compares `voice.language`.
   → check: `schema.test.ts` and `compare.test.ts` cases; `record.test.ts` expects
   `{ adapter: "qwen3-tts-0.6b", voice: "Ryan", seed: 0, language: "english" }`.

7. **The previous reel is the cache** (decision 002). `Reel` gains `previous?: string`, the folder of the reel
   already on disk (the folder store sets it when `<name>.reel/transcript.json` exists). `voiceSteps` takes it: it
   reads that transcript (an unreadable or invalid one means no cache, never an error); when its `voice` equals the
   adapter's, each comment whose whitespace-normalized text matches a previous step with audio, and whose clip's
   bytes still match its recorded SHA-256, is copied into staging instead of synthesized. Only the rest go to
   `synthesize`. It returns how many were voiced and reused; `compose` prints
   `flow-reel: voiced 1 of 5 comments (4 reused)`.
   → check: `tts.test.ts` with a fake voice that counts calls: an unchanged script synthesizes nothing and gives the
   same clip bytes and transcript audio; one changed comment synthesizes only that one; a reordered comment is
   reused; another speaker or language reuses nothing; a damaged clip is synthesized again; an invalid previous
   transcript voices everything. `store.test.ts`: `previous` is set only when a reel exists.

8. **Credentials stay out of the outputs.** With a fake voice declaring a credential and its value set in the
   environment, nothing written contains the value.
   → check: a unit test that resolves settings, builds the run arguments, the transcript `voice`, the manifest
   `about` and the written `flow-reel.json`, and finds the value in none of them.

9. **Composing twice in the image.** `record.test.ts` recomposes the voiced fixture: the second run's log says
   `voiced 0 of 3 comments (3 reused)`, and its clips and transcript audio equal the first's; a compose with
   `--speaker Aiden` writes no file over an existing one, and one with `--save-config` does.
   → check: the e2e suite passes in CI on amd64 and arm64.

10. **Docs.** README: a "Configure the composer" section (the file, the flags, precedence, when the file is
    written, the speakers and languages, how clips are reused, credentials); the voice paragraph and the usage
    line. CONTEXT.md: **Reel cache** says it is the previous reel's clips; a **Configuration** entry if the
    term is needed.
    → check: read through; every flag in `USAGE` is in the README.

11. **Planning.** Update `draft.md`'s "Done when" ("identical audio and transcript") and record corrections from the
    build here. The GH-32 `meta.md` done-status change rides with this pull request.

## Tests

- Unit: settings resolution and checks, flags, run arguments, the config file's writing rules, the cache in
  `voiceSteps` with a counting fake voice, the store's `previous`, schemas and compare, credentials.
- e2e (in the image): another speaker and language; recomposing reuses every clip; the config file's writing.

## Risks

- **A stale clip reused after the worker's generation settings change:** the adapter name is in the key, and its
  comment says to change it with the settings.
- **Clips from another architecture are reused:** intended; that is what keeps a reel's audio the same everywhere.
- **The host writes into the user's folder:** only after a successful compose, and only when there is no file or
  with `--save-config`.
- **Flag values with shell or Docker meaning:** the settings are checked against fixed lists before they reach the
  run arguments.
- **The voice record changes shape:** reels composed before this ticket lack `language`; transcript version 2 is
  unreleased, so only reels composed during 0.2 development are affected, and they recompose.

## Corrections during the build

- Step 1: `checkSettings` folded into `resolveSettings`, which throws on the first unknown value; `credentialsFor`
  (which also throws for a missing variable) and `settingsFlags` (the settings as `compose` flags) live there too.
- Step 3: the write rule is `saveSettings(status, dir, settings, rewrite)` in `src/host/launch.ts`, tested directly;
  `launch` reads and resolves the settings before it looks for an engine.
- Step 5: `qwenVoice` takes the resolved `VoiceSettings`; the worker passes the speaker as listed (`Ryan`), since
  `qwen_tts` lower-cases speaker and language itself.
- Step 8: the credentials test lives in `test/unit/settings.test.ts`.
- Step 9: the e2e recompose copies run b's folder, replaces its `flow-reel.json` with `{ "version": 1 }`, and checks
  that the file is kept and that every clip is reused; the first compose's written file is checked on run b.
- CONTEXT.md gains **Settings** (not "configuration", to keep it apart from a script's options).
