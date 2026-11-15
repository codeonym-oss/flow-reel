# GH-49 implementation plan

Planned 2026-11-15 against `main` at e7e5614 (214 unit tests pass). Decisions: this ticket's 001-004; GH-33 001-005
(001 as superseded by 004; 004 in part by this ticket's 001).

## Read first

- `src/settings.ts` (`KNOWN`, `validateConfig`, `resolveSettings`, `credentialsFor`, `settingsFlags`).
- `src/cli.ts` (flags, the container branch choosing the voice), `src/host/launch.ts` (`-e NAME`).
- `src/composer/ports.ts` (`Voice`), `src/composer/voicing.ts` (clips must be mono PCM16 WAV), `src/adapters/qwen`.

## Steps

1. **Settings:** `KnownVoice.cloud` holds a voice's default model, key variable and server; speakers and languages
   become optional lists. `voice` takes `model`, `apiKeyEnv`, `baseUrl`; `apiKey` is refused.
   → check: `test/unit/settings.test.ts` (defaults, flags, refusals, no key written anywhere).
2. **The adapter** `src/adapters/cloud/voice.ts`: a request builder and a reader per provider, a pool of four,
   retries, ffmpeg conversion. → check: `test/unit/cloud-voice.test.ts` against a local fake of each provider.
3. **The CLI:** `--model`, `--api-key-env`, `--base-url`; the container picks `cloudVoice` for a cloud adapter.
   → check: units; `test/e2e/cloud-voice.test.ts` composes in the image against a fake OpenAI on the host, and a
   second compose reuses both clips.
4. **Docs:** README (intro, voice paragraph, settings table, credentials, "Cloud voices"), package description.

## Risks

- Real providers can't be called from the tests (no keys): request shapes come from each provider's API reference
  (2026-11-15). OpenRouter's `pcm` rate isn't documented; it's read as 24 kHz, as OpenAI's, unless the content type
  gives a `rate=`.
- A runtime `feat:` makes release-please propose 0.3.0, outside the plugin's `>=0.2.0 <0.3.0`: the plugin needs its
  own pull request (range and cloud voices) before or with the release.
