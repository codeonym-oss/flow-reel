# Implementation

1. `src/host/queue.ts`: turns. → check: `owner.test.ts` with real processes: order, no overlap, dead and cancelled runs.
2. `src/host/driver.ts`: waits for a turn before a heavy phase, and says behind which run. → check: `owner.test.ts`,
   `runs.test.ts` with containers.

**Risks:** publishing in order was built in #118.
