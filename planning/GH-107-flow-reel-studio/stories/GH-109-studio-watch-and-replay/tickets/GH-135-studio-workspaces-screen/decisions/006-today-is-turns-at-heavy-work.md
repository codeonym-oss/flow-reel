# 006: "Today" draws the turns at heavy work since midnight

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** the mockup's "Today" shows who had "the recording slot". What is that, from the files?

**Decision:**

- A bar for each heavy phase (`isHeavy`: recording, rendering, a local voice) a run started today, from its
  `phase-started` to the entry that ended it, on its workspace's line; the run's waits for its turn are drawn hollow.
- `GET /api/today` reads the journals of the runs that started in the last 24 hours, and answers those spans with the
  run's id and state.
- The words are "heavy work" and "turn" (CONTEXT.md), never "slot".

- **Why:** the journals hold every start and end; the turns' database only holds who is waiting now.
