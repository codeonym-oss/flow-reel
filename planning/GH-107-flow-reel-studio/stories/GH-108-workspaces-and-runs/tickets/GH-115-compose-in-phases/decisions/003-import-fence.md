# 003: Every folder of the source says what it may not import, and a test holds it

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **`test/unit/layout.test.ts` lists each part of `src/` with the imports it forbids and why.** A file in no part
fails the test, so a new folder has to say what it is. Type-only imports are free.

| part | may not import |
|---|---|
| `run/` (the engine) | Node, adapters, host, CLI, container, ffmpeg code |
| `composer/` (the core) | processes, servers, SQL, Playwright, adapters, ffmpeg code |
| `composer/media/`, `composer/phases/` | servers, SQL, Playwright, adapters, host |
| `container/`, `adapters/` | host, CLI |
| `host/` | Playwright, ffmpeg code, the CLI |
| `cli/` | processes, servers, SQL, the composer |
