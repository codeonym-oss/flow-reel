# Plan: Watch a run live in the studio (GH-137)

Decisions relied on: epic 031; story GH-109 008, 010; this ticket's 001 to 005.

## Read first

- `src/host/owner.ts` (`follow`, `runState`), `src/host/control.ts` (`sendCommand`), `src/run/machine.ts`.
- `src/cli/watch.ts`, `src/cli/resume.ts`, `src/cli/logs.ts`: what the commands do.
- `src/studio/websocket.ts`, `src/studio/server.ts`, `src/studio/workspaces.ts` (`view`).

## Steps

1. **Resuming in one place:** `resumeRun(run, state, options)` in `src/host/new-run.ts`, used by `resume` and the studio.
   → check: the resume tests pass unchanged.
2. **Types** in `src/studio/api.ts`: `LiveRun`, `RunEntry`, the `run`, `entries` and `problem` messages, the `cancel`
   message, `ResumeRun`.
3. **A run by its id** and its live state, `src/studio/live.ts`: find `slug/N`, fold entries, the log's tail.
   → check: unit tests: an id found, an unknown one refused, the state after entries, a long log cut.
4. **The socket:** `/ws?run=<id>` follows the journal and sends `entries` then `run`; `cancel` sends the command.
   **Routes:** `POST /api/runs/resume`, `GET /api/log?run=`.
   → check: a test that opens the socket on a run, appends entries and sees them, and an unknown run refused.
5. **Web:** the Run screen: header with state and actions, the phases line, the stage (decision 005), the tabs Steps,
   Log, Journal and Failures, and the "you are watching" note.
   → check: in Chrome against runs made by a script: going, waiting, failed, stopped, done, cancelled; light, dark,
   375 px; a real run's Cancel.
6. **Docs:** the screen in the CLI reference's `studio` section.

## Risks

- A socket per open tab follows a journal every 200 ms: cheap, but each socket stops following when it closes.
- A run whose process died shows stopped only after `follow` settles it (about 1 s), as `watch` does.
