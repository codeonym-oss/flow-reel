# 003: The grab is small, slow and niced

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** what does the second grab cost the recording?

**Decision:** **a second ffmpeg, under `nice -n 19`, on one thread, grabbing the virtual screen 4 times a second, scaled
to 800 pixels wide with the fast bilinear scaler, as JPEG (quality 7).** It runs only while the record phase runs and at
least one watcher is there, and stops when the last one leaves. If it fails, the recording goes on and the picture
stays on the last one. This halves story decision 002's "about 8 a second".

- **Why, measured** on an 8-core Linux computer whose load average was 7 to 8 from other work, recording the check kit's
  `saved-views` (about 15 s):
  - In the image, 10 s of grab: ffmpeg's defaults (960 px, bicubic, its own threads) take 5.5 CPU seconds; one thread
    and fast bilinear at 800 px, 1.8.
  - Nobody watching: 4 of 4 recordings pass, 14.1 to 15.4 s.
  - Watched without a browser (the run's process, or the studio's socket): 4 of 4 pass, 13.8 to 15.2 s.
  - Watched in Chrome at 8 a second: 0 of 3 pass; the capture falls 6 to 26 % behind, over the 3 % the recording
    allows. At 4 a second: 1 of 2 fully watched recordings pass. The same Run screen without pictures: 2 of 2 pass.
- **Accepted cost:** on a computer this busy, a browser showing the live picture can tip a recording over its limit,
  and the run then fails saying the machine is too busy, as 0.7 does under any other load. Nobody watching costs
  nothing. Gate 4 is checked again on a quieter computer before release.
