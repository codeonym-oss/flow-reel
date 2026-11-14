# 001: Folders are named by role, in the project's own words

**Date:** 2026-11-14 (ticket pass, Q1; agreed: "ok")

**Question:** how is `src/` laid out for the core, the ports and the adapters?

**Decision:** **by role:** `src/host/` (starts the composer image), `src/composer/` (the core, with the three port
interfaces and the schemas; plain media modules in `src/composer/media/`), and `src/adapters/playwright/`,
`src/adapters/qwen/`, `src/adapters/folder/`. `src/index.ts` and `src/cli.ts` stay at the top.

- **Why:** someone who has read `CONTEXT.md` finds things by name; four folders suit 1,700 lines.
- **Not chosen:** textbook layers (`domain/`, `application/`, `ports/`, `adapters/`, `infrastructure/`): several
  folders of one or two files, and a judgement call per file between domain and application.
- **Rule both share:** nothing under `src/composer/` imports Playwright or anything under `src/adapters/`; a test
  enforces it.
