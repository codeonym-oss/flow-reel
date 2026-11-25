# 019: `interrupt` is the only word that holds a run from a script, with `timeout` and `autoResolve`

**Date:** 2026-11-25 (grilling; agreed: "A, only interrupt in scripts"; the options stated by the person: "something like
autoResolve: True , or timeout:2000 (ms) or maybe both ??")

**Question:** do scripts get a separate `pause` word?

**Decision:** **no. `interrupt` takes `timeout`, how long to wait, and `autoResolve`, what happens then: continue when
true, `stopped` when false, the default.** An optional check is an interrupt with `autoResolve: true`. The studio's Pause
button is separate and takes its limit from the config.

- **Why:** one word to learn, and the same options would have been on both.
- **Not chosen:** `pause()` for optional stops and `interrupt()` for required ones.
- **Open:** the rules for combining the options (proposed: stepping in stops the countdown; `--unattended` passes optional
  interrupts and fails at required ones; `input` needs a default to auto-resolve; `until` and `"never"` can't).
