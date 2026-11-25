# 007: `stopped` and `failed` say why a run ended; whether it can be resumed is worked out from its data

**Date:** 2026-11-25 (grilling, Q6b; agreed: "1, keep 016, both are stopped")

**Question:** is a run whose recording was lost `failed` or `stopped`? (Left open by 006.)

**Decision:** **`stopped`, as in epic 016.** A dead process, a computer that shut down and an interrupt nobody answered are
all `stopped`; `failed` means an error in the script, the app, the voice or the render. Whether a run can be resumed, and
why not, is worked out from its data and always shown: `stopped · recording lost`, `stopped · can resume from voice`. A
failed voice or render can be resumed too.

- **Why:** why a run ended and what can be done now are two questions.
- **Not chosen:** `failed` for anything that ended while recording (an unanswered interrupt would look like a broken script,
  and epic 016 would change).
