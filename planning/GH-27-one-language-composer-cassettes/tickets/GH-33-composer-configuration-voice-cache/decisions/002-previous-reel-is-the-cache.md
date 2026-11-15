# 002: The previous reel's clips are the reel cache

**Date:** 2026-11-14 (ticket pass, Q2; agreed: "ok")

**Question:** where does the reel cache live, and when is a clip reused?

**Decision:** **the reel already on disk is the cache.** Before voicing, the composer reads the previous reel's
`transcript.json`. A comment reuses a previous clip when its whitespace-normalized text and the voice settings are
the same, and the clip's bytes still match the SHA-256 the transcript recorded. Anything else is synthesized again.
The new reel holds exactly the clips it uses.

- **Consequence:** recomposing an unchanged script gives byte-identical clips, so the audio and the transcript are
  identical; `video.mp4` still differs on every compose (GH-31 decision 003). The ticket's "identical reel" means
  identical audio and transcript.
- **Why:** it is story decision 005 as written (the cache is kept with the reel); no folder is added and no clip is
  stored twice; the hash check never reuses an edited or damaged clip.
- **Not chosen:** a `cache/` folder inside the reel (every clip stored twice); a shared cache beside the scripts
  (grows without limit, a second thing to commit or ignore, and not kept with the reel).
- **Accepted cost:** a comment deleted and later restored is synthesized again; deleting the reel deletes its cache.
