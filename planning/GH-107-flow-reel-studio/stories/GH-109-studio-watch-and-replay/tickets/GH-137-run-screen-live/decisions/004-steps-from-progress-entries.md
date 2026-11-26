# 004: Steps come from the recording's progress entries

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** where do the Steps tab's steps and their times come from?

**Decision:** the record phase's `progress` entries of type `step` (index, comment). A step's time is from its entry
to the next step's, or to the end of recording. A failed recording marks the step it was on. No "same as last run"
comparison in this ticket: it needs the previous run's journal and is left to the score (GH-139), which reads it anyway.

- **Why:** the journal already has them; nothing new is recorded.
