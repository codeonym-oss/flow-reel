# 004: The first version has only the container runner; a local runner can come later

**Date:** 2026-11-25 (grilling; agreed: "yes to: … should the first version have only the container runner, with local
added later?")

**Question:** does the first version run scripts in a container only, or on the person's computer too?

**Decision:** **container only, behind an interface that a local runner can implement later.** The runner launches the
browser and executes the script; for a card it only notes the moment, and the composer draws it.

- **Why:** fixed fonts and one recording setup, so a reel doesn't differ between computers.
- **Not chosen:** a local runner now (reels would differ between computers, and it needs another way to record).
