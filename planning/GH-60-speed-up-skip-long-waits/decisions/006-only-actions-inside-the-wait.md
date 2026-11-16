# 006: Only actions run inside a wrapped wait

**Date:** 2026-11-16 (story, Q2; the person answered "ok" to the recommendation)

**Question:** what may a script do inside the callback of `speedUp` or `skip`?

**Decision:** **actions only.** `comment()`, `showFrame`, and a nested `speedUp` or `skip` inside the callback throw
a clear error where they are written. A wait is narrated by a comment written just before it, which is spoken whole
over the stretch (decision 003):

```ts
comment("The agent is thinking it through.");
await speedUp(4, () => page.getByText("Done").waitFor());
```

- **Why:** every stretch then lies inside one step, so the timeline, transcript and captions stay simple.
- **Not chosen:** anything allowed (steps starting mid-stretch, a skip hiding a step's start); actions and sounds
  (a sound in a skip is dropped anyway, so it only helps speed-up).
- **Ticket pass:** whether sounds and the other effect words (`flash`, `zoomIn`, `zoomOut`, chained or not) count as
  allowed inside the callback.
