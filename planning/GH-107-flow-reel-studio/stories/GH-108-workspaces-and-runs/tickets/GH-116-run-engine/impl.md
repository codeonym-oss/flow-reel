# Implementation

1. `src/run/machine.ts`, `src/run/journal.ts`: `next`, `todo`, entries and replay, pure. → check: `machine.test.ts` tries every
   event in every situation.
2. `src/host/journal.ts`, `src/host/driver.ts`: the file and its one writer; the loop over `todo`. → check: `driver.test.ts`
   compares the state held with the state read back, at every entry.
3. `src/cli/progress.ts`: plain, live and JSON views of the entries; `compose --json`. → check: `progress.test.ts`, e2e.

**Risks:** `compose` drives the run in its own process until #117.
