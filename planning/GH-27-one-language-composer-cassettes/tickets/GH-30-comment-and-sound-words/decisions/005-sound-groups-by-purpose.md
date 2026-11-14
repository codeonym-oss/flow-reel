# 005: Sounds are grouped by what they signal

**Date:** 2026-11-14 (ticket pass, Q4; agreed: "ok")

**Question:** how are the `Sounds` constants grouped?

**Decision:** **by purpose:**

```ts
Sounds.feedback.SUCCESS   Sounds.feedback.ERROR    Sounds.feedback.NOTIFICATION
Sounds.navigation.OPEN    Sounds.navigation.CLOSE  Sounds.navigation.BACK
Sounds.controls.TOGGLE    Sounds.controls.SELECT
```

Each value is the sound's name (`"success"`, …). Click and typing sounds stay automatic and have no constant.

- **Why:** an agent picks the group from what just happened, then the sound; a new sound has an obvious home.
- **Not chosen:** one `buttons` group (says nothing; later sounds would not fit); a flat list (the person asked for
  groups; crowds as the library grows).
