# 005: speedUp and skip wrap the wait in a callback

**Date:** 2026-11-16 (story, Q1; the person answered "ok" to the recommendation)

**Question:** how does a script mark the stretch to speed up or skip?

**Decision:** both words are **awaited standalone words that take a callback**; the stretch is exactly the
callback's run:

```ts
await speedUp(4, () => page.getByText("Done").waitFor({ timeout: 120_000 }));
await skip(() => page.waitForResponse(/\/api\/build/));
```

- **Why:** clear bounds, nothing to forget to close, and any kind of wait works (locators, `waitForResponse`,
  `waitForFunction`, a loop). Like `showFrame` (GH-32), it is an awaited word of its step.
- **Not chosen:** start/end marks like `zoomIn`/`zoomOut` (a forgotten end speeds up the rest, skip needs a third
  word, comments between marks make awkward cases); chaining on a locator (misses `waitForResponse` and
  `page.evaluate` waits, common for agents).
