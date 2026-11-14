# Shaping: flow-reel as four layers with one language

Started 2026-11-14.

## The need, in the person's words

> there will be three (or four levels), level one .... the scripts ... users / or agents generate a script file for
> use cases (like E2E testing, cypress, playwright ...) ... instead of regular scripts, those are glorified scripts
> ... each phase .. step ... user / agent can add / chain a Comment, sound to that actions, comments can be
> standalone ... or chained: like ... comment("something").... btn.comment("click on the login button") ... same for
> audio / sounds, can be standalone ... or chained ... like: .... Audio.<sfx> ... or Button.audio.click() ....
> next is the composer (yes we will name it composer), its a docker image that compiles the scenarios into synced
> transcripts + audio files + recording (using integrations such as cypress, playwright etc ....) (users choose
> which integration they need) and lastly, the cassette (the compiled audio file) this is a deterministic workflow!
> and of course it requires starting the Composer container with start configuration ... transcription model
> (local, cloud), API keys (if needed), and the E2E tool (cypress, playwright, etc ....) and lastly the agent
> plugin ... the goal here is to teach the agent the language of the flow-reel library ... agent gets a SKILL.md,
> scripts, references etc .... so they know what to use, when, how, why ...) ... also use a ubiquitous globalized
> language, declare it into CONTEXT.md file .... then better structure / refactor the codebase ...

## The four layers as stated

1. **Scripts**: scenario files; a step can carry a comment (spoken line) and a sound, standalone or chained.
2. **Composer**: a Docker image that compiles scenarios into synced transcript + audio + recording, through a
   chosen E2E integration; started with configuration (speech model local/cloud, API keys, E2E tool).
3. **Cassette**: the compiled output ("the compiled audio file"; exact contents to settle).
4. **Agent plugin**: SKILL.md, scripts, references that teach an agent the flow-reel language.

Plus: a ubiquitous language in `CONTEXT.md`, then a restructure of the codebase around it.

## What exists today (v0.1.2)

- Script API: `demo({ url, viewport }, async ({ page, step, sfx }) => …)`, `step(narration, action)`, standalone
  `sfx(name)`. Playwright only (`page` is a wrapped Playwright `Page`). Story decision 010.
- One image (`ghcr.io/codeonym-oss/flow-reel`) does everything: replay, record, local Qwen3-TTS, fit, polish,
  SFX, mux. `flow-reel record` on the host launches it. Story decisions 002, 005, 006.
- TTS is local only in code; story decision 004 already says "pluggable, local by default", cloud adapters unbuilt.
- Output per take: MP4, captions, `transcript.json`, `events.json`, audio.
- No `CONTEXT.md`. Code is split `src/host`, `src/runner`, `src/schema`; the names composer/cassette/scenario
  appear nowhere.
- GH-6 (plugin, eight skills, decision 005 separate release) is planned, not built. It teaches today's API.

## Settled decisions this touches

- GH-1 002 explore → script → deterministic replay: kept by the new vision.
- GH-1 004 pluggable TTS, local default: kept; cloud becomes real.
- GH-1 005 CLI + image do the work, plugins are thin: kept.
- GH-1 010 `step(narration, action)` over Playwright: the new chained language changes this.
- GH-1 003 / 009 "same script, same video": cloud speech and several integrations strain it.
- GH-6 plan: its skills and references must teach the new language, so GH-6 waits or is re-planned.

## Decisions so far

- 001: native tool scripts plus flow-reel words; Playwright only for now.
- 002: visual effects (flash, showFrame, zoom in/out) are a third word family beside comments and audio.
- 003: automatic polish by default; effect words in the script override it.
- 004: a cassette is the whole compiled result of one script, one folder with a manifest.
- 005: one voice port, cloud-ready with a cassette cache; only local voices ship at first.
- 006: TypeScript composer, domain core with ports and adapters.
- 007: three ports: integration, voice, cassette store; the rest are plain modules.
- 008: the 0.1 API (`demo`, `step`, `sfx`) is removed and replaced in one breaking release, 0.2.0.

## Proposed shape (waiting for the person's answer)

A **story**, "flow-reel 0.2: one language, a composer and cassettes", with seven tickets in shipping order:

1. Declare the ubiquitous language in `CONTEXT.md`.
2. Restructure the code into a composer core with the three ports, no behaviour change.
3. Script language: `comment` and `audio`, chained and standalone, replacing `demo`/`step`/`sfx`.
4. Cassette: one folder with a manifest, through the cassette store port.
5. Effects: flash, `showFrame`, zoom in/out, with the override rule.
6. Composer start configuration (voice, integration, keys) and the voice cache.
7. Release 0.2.0 with the "moving from 0.1" guide.

Then GH-6 (the plugin) is re-planned to teach the 0.2 language. Later, separate work: a Cypress integration, cloud
voice adapters.
