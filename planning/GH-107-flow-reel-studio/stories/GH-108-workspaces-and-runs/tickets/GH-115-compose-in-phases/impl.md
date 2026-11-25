# Implementation

1. `src/composer/phases/`: record, voice, plan and render out of `compose()`, unchanged in what they do. → check: e2e suites.
2. `src/composer/schema/`: `cues.json`, `voice.json`, `plan.json`, `render.json`, read and checked. → check: `plan.test.ts`.
3. `src/container/`: one phase per container, messages on its output, ends with its input. → check: `container.test.ts`, e2e.
4. `src/host/`: run folders, results, containers, the reel's files. → check: `run-folder.test.ts`.
5. `src/adapters/folder/store.ts`: the swap of a finished reel. → check: `store.test.ts`, on the three systems.
6. `layout.test.ts`: the import fence. CI: `systems` on macOS and Windows.

**Risks:** the reel no longer holds `work/`; the plugin's helpers don't read it.
