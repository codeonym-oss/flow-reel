# 010: A demo script is a thin `flow-reel` API over Playwright, one `step(narration, action)` per unit

**Date:** 2026-11-02 (global pass, Q8; agreed: "ok")

**Question:** what does a demo script look like?

**Decision:** **a default export of `demo(options, async ({ page, step }) => …)`**, where each
`step(narration, action)` is the unit the runner times, the TTS voices and the fit holds. Options carry at least the
start `url` and the `viewport`. The runner owns step boundaries.

```ts
import { demo } from "flow-reel";
export default demo({ url: "http://localhost:3000", viewport: [1920, 1080] }, async ({ page, step }) => {
  await step("Open the settings page.", () => page.getByRole("link", { name: "Settings" }).click());
  await step("Turn on dark mode, and the whole app follows.", () => page.getByLabel("Dark mode").check());
});
```

- **Why:** narration sits beside its action; the runner controls timing, which decisions 002 and 009 rely on.
- **Not chosen:** `@playwright/test` with `test.step` titles (retries, workers and reporters fight a single
  deterministic recording; holding steps needs runner internals); narration in a separate YAML keyed by ids (drift).
