# A compose in phases, outside the project

## Problem

`compose()` is one function in one container: its steps and events live in memory, so a failure loses everything, and the
work in progress appears in the project.

## Change

- **Five phases** (record, voice, plan, render, publish), each a module with typed inputs and a result on disk (decision 015).
  Record writes the **cue sheet**, `cues.json`; later phases read it and never the script (epic 031).
- **A container per phase** that needs one (011), for the script's copy and the run's folder only (014). A container prints
  events as JSON lines, and shuts down when its input closes.
- **Run data** in the data folder; the reel is built there and swapped into the output folder whole (epic 007).
- **The import fence:** CI fails when the core imports Docker, SQL, HTTP, child processes or an adapter.
- Unit tests of the data folder and the swap run on macOS and Windows in CI (012).

## Not part of it

The state machine, journal and detached process (next tickets): this one runs the phases in order in the CLI.

## Done when

- The same scripts give the same steps, sound and timing as on 0.7.
- During and after a compose, the project holds only scripts, settings and finished reels.
- The voice key reaches the voice's container only.
- A container ends when the CLI is killed.
