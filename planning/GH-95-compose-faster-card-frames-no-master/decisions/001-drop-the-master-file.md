# 001: The delivery encode reads the capture; no master file

**Date:** 2026-11-20 (the person: "please build and ship the speed baseline + warn 1 on same ticket")

**Question:** the one-pass render makes `work/master.mp4` unnecessary. Keep writing it for debugging, or drop it?

**Decision:** **drop it.** The cuts, holds and card clips are filters ahead of the polish in the one delivery encode.
`master.json` stays, since `startMs` is a time in the capture.

- **Why:** writing the master is a full 1440p encode of every frame, the cost the change removes; nothing reads it
  but tests and debugging (ports.ts: "nothing reads them afterwards except to debug").
- **Not chosen:** keeping it behind a debug switch: configurability nobody asked for.
