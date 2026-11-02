# 008: The CLI is TypeScript on npm; on the host it only launches the image

**Date:** 2026-11-02 (global pass, Q6; agreed: "ok")

**Question:** which language is the CLI written in, and how does it reach the container?

**Decision:** **TypeScript, published on npm** (`npx flow-reel record demo.ts`). On the host the CLI starts the image
(Docker or Podman) with the project mounted; inside, the same package runs Playwright, ffmpeg and TTS. Demo scripts are
plain TypeScript importing `flow-reel`. Python TTS models are called as a subprocess inside the image, behind the
decision 004 adapter.

- **Why:** one language from script to runner; Playwright's TS API is first-class and the one agents write best.
- **Not chosen:** Python (`demo.py`, second-class Playwright for agents and JS apps); a shell launcher plus a TS runner
  (logic in two languages, harder to test).
