# Plan: Workspaces in the studio (GH-135)

Decisions relied on: epic 021, 027, 031; story GH-108 004, 009; story GH-109 008, 010; this ticket's 001 to 006.

## Read first

- `src/host/data.ts`, `src/host/tracker.ts`, `src/host/runs.ts`, `src/host/retention.ts`, `src/host/resume.ts`,
  `src/host/queue.ts` (`isHeavy`): what the commands read.
- `src/cli/runs.ts` (`runs`, `clean`), `src/cli/init.ts`: what the person gets in the terminal.
- `src/studio/server.ts`, `src/studio/locks.ts`, `src/studio/api.ts`: the server from GH-134.
- `prototypes/studio-mockup.html`: the Workspaces screen.

## Steps

1. **Clean in one place:** `cleanable(data, workspaces)` in `src/host/retention.ts` (runs and leftovers, with bytes and
   a `remove`); `flow-reel clean` uses it.
   → check: the existing `clean` tests pass unchanged.
2. **Types** in `src/studio/api.ts`: `WorkspaceView`, `RunView`, `TurnView`, the add and clean bodies and answers.
   → check: typecheck, web included.
3. **What the screen reads** `src/studio/workspaces.ts`: `workspaces(data)`, `runs(data)`, `today(data, now)`,
   `addWorkspace(data, body)`, `cleanPreview` and `clean`.
   → check: unit tests against a data folder made in the test: two workspaces, runs in each state from journals,
   a heavy phase today and yesterday, a folder with and without flow-reel.json, a relative path refused.
4. **Server:** the `data` option, the GET routes, POST with the Origin and content type checks and a 64 KB body.
   → check: unit tests: each route's answer; a POST without Origin, from another Origin, as a form, too big: refused
   and nothing written.
5. **Web:** the Workspaces screen: cards (state, last runs, counts, size, Clean that asks), the add form with the
   `init` offer, Today, Every run with filters and search; asked again every 2 s while visible; rows and cards link to
   the run, reel and scripts screens.
   → check: in Chrome, against a real data folder: dark, light, 375 and 768 px, a run started in a terminal appears.
6. **Docs:** the studio's Workspaces screen in the CLI reference's `studio` section.

## Tests

`test/unit/studio.test.ts` grows the server checks; `test/unit/studio-workspaces.test.ts` holds step 3's.

## Risks

- `trackedRuns` on a big history: it reads the index, and only going runs' journals; fine every 2 s.
- `whatNext` checks file sizes per ended run: limited to runs with heavy files.
