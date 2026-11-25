# Detached runs: a process per run, and commands to watch and control it

## Problem

Closing the terminal kills the compose, and no other program can see it or stop it.

## Change

- **Each run has its own process** (epic 023) that holds the run's lock (016), drives it and exits. `compose` starts it and
  watches; `--detach` prints the run and returns.
- **A local socket** (011) takes versioned commands; `cancel` is the first, and an unknown one is refused.
- **`watch`, `wait`, `logs`, `cancel`** (008), by script name or run number, with `--json`.
- A dead run is noticed and recorded as `stopped` (007).

## Done when

- Closing the terminal doesn't stop the run; Ctrl+C in `compose` cancels it, and in `watch` only stops watching.
- Killing the run's process ends its container, and the next command shows it `stopped`.
- The exit codes of `compose` and `wait` say how the run ended.
- No key is written to disk.
