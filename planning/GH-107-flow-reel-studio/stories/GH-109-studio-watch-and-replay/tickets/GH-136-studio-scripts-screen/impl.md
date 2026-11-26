# Plan: Scripts in the studio (GH-136)

Decisions relied on: epic 021, 023; story GH-109 008, 010; this ticket's 001 to 005.

## Read first

- `src/cli/compose.ts`, `src/host/start.ts`, `src/host/engine.ts`, `src/settings.ts`: how a run is started.
- `src/workspace/workspace.ts` (`listScripts`, `findScript`, `reelFolder`), `src/host/files.ts` (`sha256`).
- `docs/reference/reel-format.md`: `transcript.json`, `events.json`, `manifest.json`.
- `src/studio/workspaces.ts`, `web/src/workspaces.tsx`: GH-135's server and screen.

## Steps

1. **Starting a run in one place:** `startCompose(path, options)` in `src/host/`, used by `compose` and the studio.
   → check: the compose tests pass unchanged.
2. **Types** in `src/studio/api.ts`: `ScriptView` (name, path, counts from the last reel, its state, last runs, on save),
   `ScriptSource` (lines, changed lines or "changed"), the run and on-save bodies.
3. **What the screen reads** `src/studio/scripts.ts`: a workspace's scripts with their last reel's counts; a script's
   source and the lines changed against its last reel's run copy; opening one by path.
   → check: unit tests with a workspace, a reel's three JSON files and a run copy: the counts, same hash, changed lines,
   a cleaned copy, a path outside a workspace refused.
4. **Run and on save** `src/studio/on-save.ts`: watches a script while its switch is on; a save starts a run, waits for
   one that is going, and makes one run of several saves.
   → check: unit tests with a fake start and a fake "is going": one save → one run, three saves during a run → one
   more run after it, switch off → none.
5. **Server routes:** `GET /api/scripts?workspace=`, `GET /api/script?workspace=&name=`, `POST /api/scripts/open`,
   `POST /api/runs`, `POST /api/on-save`.
   → check: unit tests of each route, a run refused without its key's variable named.
6. **Web:** the Scripts screen: the list, the selected script's actions (Run, Last reel, on save, last runs), the
   source with changed lines; the workspace from the path, or a choice of workspaces.
   → check: in Chrome against a real workspace: Run starts a run that `flow-reel runs` lists; light, dark, 375 px.
7. **Docs:** the screen in the CLI reference's `studio` section.

## Risks

- `fs.watch` on a file replaced by an editor's rename: watch the folder and filter by name.
- Starting a run needs the image: the first start can take minutes; the answer waits, and the button says so.
