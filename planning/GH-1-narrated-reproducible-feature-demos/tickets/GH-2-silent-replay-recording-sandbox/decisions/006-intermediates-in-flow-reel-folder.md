# 006: Intermediate files go in a self-ignoring `.flow-reel/` folder beside the script

**Date:** 2026-11-03 (building, raised by a review of the outputs; agreed: "ok, option 1")

**Question:** a master is large (about 3 MB per second at 1440p) and lands in the app's repository, beside the
script, where it is easy to commit by accident. Where do the outputs go?

**Decision:** **intermediates go in `.flow-reel/<name>/` beside the script; deliverables stay next to the script.**
For `demo.ts`: `.flow-reel/demo/master.mp4` (and, in later tickets, audio clips and renders), while `demo.mp4`,
`demo.transcript.json`, `demo.events.json` and later captions sit beside `demo.ts`. On first use the runner writes
`.flow-reel/.gitignore` holding `*`, so git ignores the folder without touching the app's own `.gitignore`.

- **Why:** large files are safe by default, and the outputs people want stay where they look.
- **Not chosen:** everything in `.flow-reel/` (the demo video would be hidden and ignored; sharing it means copying
  it out); everything beside the script with the agent skill (GH-6) adding an ignore rule (unsafe until GH-6 ships,
  and for anyone not using the skill).
- **Cost accepted:** deliverables can still be committed; they are small (a 1080p demo is about 5-15 MB a minute),
  so committing them is a choice.
