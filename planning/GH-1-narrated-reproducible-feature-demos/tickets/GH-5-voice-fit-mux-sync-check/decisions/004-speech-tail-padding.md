# 004: Leave at least 200 ms after speech

**Date:** 2026-11-11 (ticket pass, Q4; agreed: "ok")

**Question:** fit speech exactly into its step, or leave a short pause before the next step?

**Decision:** **each narrated step lasts at least through its clip plus 200 ms**, measured from its final
`startMs`. Existing captured time counts toward this minimum; insert only the extra hold needed. The step must
also include its captured action and settling window. Round added holds upward to whole video frames, so speech
and its minimum tail are never truncated by rounding. Blank narration gets no speech-tail padding.

- **Why:** give successive narration lines breathing room while retaining longer captured actions.
- **Not chosen:** fitting clips exactly to step boundaries with no extra pause, which is more compact but can
  sound rushed.
