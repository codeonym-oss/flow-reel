# 003: Capture a settling window before choosing the held frame

**Date:** 2026-11-11 (ticket pass, Q3; agreed: "ok")

**Question:** freeze the frame at action callback completion, or give the resulting UI time to settle?

**Decision:** **after the action returns, use the existing bounded network-idle check, then capture another
100 ms before ending the step's visual window.** The idle check requires 500 ms of quiet and waits at most
10 seconds. Warn and continue if the page remains busy, matching the existing before-step timeout behavior.
An added postprocessing hold uses the final frame of this captured visual window.

Keep `actionEndMs` as the callback's actual finish time. The settling window and any added hold contribute to
the step's final `endMs`; they do not redefine when the action completed. Scripts must still explicitly await
the UI state they intend to demonstrate; network quiet is not proof that a business operation succeeded.

- **Why:** avoid freezing a loading indicator or unfinished transition when the callback returns promptly.
- **Not chosen:** freezing immediately at callback return, which is quicker but can hold an incomplete view.
