# 015: A phase writes a folder of the run, and its result says what it was made from

**Date:** 2026-11-25 (chosen alone, 013)

**Decision:** a run is `<data folder>/workspaces/<workspace id>/runs/<number>/`:

```
request.json       what was asked: script, settings, output, versions; never changes
journal.jsonl      one JSON event per line, the truth (epic 031)
log.txt            what the containers printed
scripts/           the copy of the scripts folder (014)
previous/          the replaced reel's transcript and clips, for the reel cache
record/ voice/ plan/ render/ reel/
```

- **Data folder:** `$XDG_DATA_HOME/flow-reel` or `~/.local/share/flow-reel` on Linux, `~/Library/Application
  Support/flow-reel` on macOS, `%LOCALAPPDATA%\flow-reel` on Windows; `FLOW_REEL_DATA_DIR` overrides it.
- **Numbers:** runs are numbered 1, 2, 3 in their workspace, so an id is short (`flow-reel logs 12`, left open by 008) and
  the order runs started in (010) doesn't depend on the clock. A number is taken by creating its folder, which is atomic.
- **Results:** a phase writes `<phase>.tmp/`, adds `result.json` (the hash of each input, and the size and hash of each file
  it made), and renames the folder. A phase is reused when its result's inputs and files still match.
- **Where they run:** record, voice and render run in a container, because they need the browser, the voice or ffmpeg. Plan
  and publish run in the run's own process: plan is pure, and publish only moves files.
- **The reel no longer holds `work/`:** the recording stays in the run's folder. `verify` still accepts a 0.7 reel's.

- **Not chosen:** ids made of random letters (longer to type, and they carry no order); ids from the date (the clock can go
  back).
