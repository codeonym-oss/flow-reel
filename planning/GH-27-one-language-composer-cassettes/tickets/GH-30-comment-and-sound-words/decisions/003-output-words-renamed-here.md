# 003: This ticket renames the output fields; each file version goes up once

**Date:** 2026-11-14 (ticket pass, Q3; agreed: "ok, here (1)")

**Question:** which ticket renames the old words in the output files?

**Decision:** **this one.** A transcript step's `narration` becomes `comment` (transcript version 2) and the event
log's `sfx` event becomes `sound` (event log version 3). `flow-reel compare` reads the new versions. GH-31 moves the
files into the cassette without bumping these versions again, since nothing between the two tickets is released.

- **Why:** after this ticket a script's words and its output's words match; each change stays about one thing;
  users see one format change, in 0.2.0.
- **Not chosen:** renaming with the cassette in GH-31 (script and output disagree for one ticket; the rename rides
  along with an unrelated layout change).
