# Implementation

1. `src/host/resume.ts`: what can be done with a run that ended, from its results. → check: `driver.test.ts`.
2. `src/host/{driver,owner}.ts`: a run that ended goes on; one whose recording is lost is refused by its owner too. → check:
   `owner.test.ts` kills a run in each phase.
3. `src/workspace/limits.ts`, the driver: time limits. → check: `driver.test.ts`, `runs.test.ts`.
4. `src/host/publish.ts`: publishing in order. → check: `publish.test.ts`.
5. `src/cli/resume.ts`, and what `watch` says of a run that ended. → check: `owner.test.ts`, `runs.test.ts` (with containers).

**Risks:** none known.
