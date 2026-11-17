# 002: A card is an insertion that lasts until its comment ends

**Date:** 2026-11-17 (story; the person validated the design canvas and delegated the open questions: "for your open
questions, pick whats more relevant, even if it has to add more work, rework something")

**Question:** how a card fits the timeline?

**Decision:**
- A card is an insertion (as an image was): the app stops on its frame, the card plays, and the recording resumes on
  the frame it left.
- It lasts 3 s, or until the comment of its step has been spoken when that is longer; `ms` sets an exact length.
- Chapters are numbered by the composer ("02 / 03"), counted once the script has run.

- **Why:** the narration drives the pace, as for the skip card (GH-62 decision 003), and a script needs no timing to look right.
- **Not chosen:** cards drawn over a running recording (the app would move under them); a fixed length only (a long comment would run on over the app).
