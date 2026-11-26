# 004: The reel's numbers: length, size, level

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** story GH-109's draft asks for length, size and loudness. ffmpeg runs only in the image, and the studio
runs on the host.

**Decision:** **length from the transcript, size from the manifest's files, and a level strip the browser draws by
decoding the video's sound with Web Audio: the RMS level of each half second, in dBFS, with its peak and average.** It
is called "level", not "loudness": it is not LUFS.
- The files are listed from the manifest with their size, and **Show folder** copies the reel's path.
- **Why:** no ffmpeg on the host and no new phase; decoding a reel's sound in the browser takes a fraction of a second.
