# 004: `compare` takes two reels; `flow-reel verify` checks one reel against its manifest

**Date:** 2026-11-14 (ticket pass, Q5; agreed: "3")

**Question:** how does `flow-reel compare` use reels?

**Decision:** **`flow-reel compare a.reel b.reel` takes reel folders only, and a new `flow-reel verify <reel>` checks
one reel.**

- **verify** reads `manifest.json` and checks that the reel holds exactly the listed files (outside `work/`), each with
  its size and hash. Exit 0 when whole; 1 when a file is missing, extra or changed, naming each; 2 for an invalid
  manifest, a folder that isn't a reel, or a usage error.
- **compare** verifies both reels first (any failure exits 2, naming the reel and the file), then compares their
  transcripts as it does today: same exit codes, same differences.
- Passing a transcript file to `compare` is a usage error that says to pass the reel folder.
- Both run on the host, without Docker or FFmpeg, like `compare` today.

- **Why:** a reel is the unit people share and compare; a separate verify lets anyone who receives a reel check it
  alone, and gives the manifest check a command of its own.
- **Not chosen:** compare only (verify would have no command of its own); accepting reels or transcript files (two
  ways to say one thing, against story decision 008).
