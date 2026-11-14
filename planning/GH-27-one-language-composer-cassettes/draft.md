# flow-reel 0.2: one language, a composer and reels

## Goal

Make flow-reel one clear thing with one vocabulary: a person or an agent writes a **script**, the **composer**
compiles it, and the result is a **reel**. Today the same ideas exist under mixed names (demo, runner, take,
narration, SFX), the script can only say "narrate this step" and "play this sound", and nothing names the boundary
between the script, the engine and the output. 0.2 names those boundaries, makes the script language richer, and
restructures the code around it so tools and voices can be added later without touching the core.

## What it delivers

- **`CONTEXT.md`:** the project's vocabulary, one word per concept (decision 009). Code, docs and the plugin use it.
- **A script language:** the E2E tool's own script plus three families of flow-reel words, each usable standalone
  or chained on an element: **comment** (a spoken line), **sound** (a sound effect) and **effect** (flash, show
  frame, zoom in, zoom out). It replaces `demo`, `step` and `sfx` (decisions 001, 002, 008).
- **The composer:** the container image, started with a configuration naming the voice and the integration.
  `flow-reel compose <script>` compiles a script (decisions 006, 007, 009).
- **The reel:** one folder holding the video, transcript, captions, event log and audio, with a manifest
  (decisions 004 and 010).
- **Release 0.2.0** with a guide for moving from 0.1.

## Rules every ticket keeps

- **One word per concept,** as in `CONTEXT.md` (decision 009). A ticket that needs a new term adds it there first.
- **Explore, then script, then deterministic replay** stays (GH-1 decision 002). "Same script, same reel":
  with a cloud voice, same script and same reel cache (decision 005).
- **Scripts are the tool's own script plus flow-reel words.** Playwright is the only integration built in this
  story (decision 001).
- **Automatic polish stays the default;** effect words in the script override it (decision 003). Polish is still
  rendered in post from the event log (GH-1 decision 012).
- **TypeScript, a domain core with three ports:** integration, voice, reel store. Capture, rendering, mixing
  and captions are plain modules until a second implementation exists (decisions 006, 007).
- **One breaking release.** No deprecated aliases for the 0.1 words (decision 008). Until ticket 7, `main` may hold
  breaking changes; they are released together as 0.2.0.
- **All logic lives in the CLI and the image;** the plugin stays thin (GH-1 decision 005).

## Tickets, in the order they ship

1. Declare the flow-reel language in `CONTEXT.md`
2. Restructure the code into a composer core with three ports
3. Write scripts with comment and sound words, chained or standalone
4. Compile each script into a reel: one folder with a manifest
5. Direct the picture with effect words that override automatic polish
6. Configure the composer's voice and integration, and cache voiced comments
7. Release 0.2.0 with a guide for moving from 0.1

## Not part of this story

- The agent plugin: GH-6 is re-planned after this story, to teach the 0.2 language.
- A Cypress integration, or any integration other than Playwright.
- Cloud voice adapters. The voice port and its cache are built; only local voices ship.
- A neutral flow-reel script language that runs on any tool (decision 001).
- Rewriting the composer in another language (decision 006).

## What this changes in GH-1

GH-1 decision 010 (`demo(options, ({ page, step }) => …)`) is superseded by decisions 001 and 008 of this story.
GH-1 decisions 002, 004, 005 and 012 are kept.
