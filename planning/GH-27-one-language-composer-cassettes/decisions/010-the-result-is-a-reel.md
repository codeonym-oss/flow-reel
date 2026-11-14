# 010: The compiled result is a reel, not a cassette

**Date:** 2026-11-14 (GH-31 ticket pass, Q1; agreed: "ok, reel")

**Supersedes 009** for one term: Cassette becomes **Reel**. The rest of 009 stands.

**Question:** is "cassette" the right word for the whole compiled result of one script?

**Decision:** **it is a reel.** The composer composes a script into a reel: one folder holding the video, the
transcript, the captions, the event log, the audio and the manifest. The derived terms follow: **reel store** (the
port, was cassette store) and **reel cache** (was cassette cache). "Cassette" joins the words to avoid. Decisions 004,
005 and 007 keep their meaning, read with the new word.

- **Why:** in testing tools (VCR, vcrpy, Polly) a cassette is a file of recorded HTTP interactions, which flow-reel's
  users, who write E2E scripts, are likely to know; "reel" matches the product's name and already means a finished
  video to share. No release has shipped the word yet, so changing it now costs only text and three type names.
- **Not chosen:** keeping "cassette" (the testing clash stays); "take" (009 lists it as a word to avoid, and it
  suggests several attempts); "bundle" or "package" (generic, and they clash with JavaScript bundles and npm
  packages).
- **Changes:** `CONTEXT.md`, the README, the story's and tickets' issue texts, and the code names `Cassette`,
  `CassetteStore`, `CassetteResult`. The rename is done in GH-31. Planning folder names keep their old slugs.
