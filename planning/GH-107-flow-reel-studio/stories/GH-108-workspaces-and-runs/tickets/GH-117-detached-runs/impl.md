# Implementation

1. `src/host/{sqlite,lock}.ts`: the lock the system releases. → check: `owner.test.ts`, on the three systems.
2. `src/run/control.ts`, `src/host/control.ts`: versioned commands over a local socket. → check: `owner.test.ts`.
3. `src/host/{owner,start,run-process,runs}.ts`: owning a run, its process, finding and following runs. → check:
   `owner.test.ts` with real processes and no container; `cloud-voice.test.ts` with containers.
4. `src/cli/{watch,cancel,logs,runs}.ts`, `compose --detach`. → check: the commands' tests in `owner.test.ts`.

**Risks:** macOS and Windows with Docker are for the person's check (#121).
