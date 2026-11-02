# 002: The runner hands the script a wrapped `page` that eases the mouse and logs each action

**Date:** 2026-11-02 (ticket pass, Q4; agreed: "ok")

**Question:** scripts call plain Playwright (story decision 010), which teleports; how does the runner ease the mouse
and write `events.json` (story decision 013)?

**Decision:** **wrap `page` and the locators it returns.** `click`, `dblclick`, `hover`, `check`, `uncheck`, `fill`,
`type`, `pressSequentially`, `press`, `selectOption`, `scrollIntoViewIfNeeded` and mouse-wheel scrolls are
intercepted: resolve the element's box, ease `page.mouse` there in small steps, append the event, then call the
original. Calls the wrapper doesn't cover (`page.evaluate`, `dispatchEvent`, …) still run, with a warning that they
produce no cursor motion.

- **Why:** agents keep writing plain Playwright; gaps are visible rather than silent.
- **Not chosen:** flow-reel helpers like `step.click()` (another API; raw calls teleport silently); Playwright's
  private instrumentation (breaks across versions).
