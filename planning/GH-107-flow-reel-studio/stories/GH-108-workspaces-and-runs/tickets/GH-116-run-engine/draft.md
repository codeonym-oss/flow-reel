# The run engine: state machine, journal and live progress

## Problem

A compose shows almost nothing while it works, and nothing records what it did.

## Change

- **The state machine** (epic 031): `next(run, event)`, pure, with every state, the phases, and gates before each phase.
- **The journal:** versioned events appended to `journal.jsonl`; a run's state is its events applied in order. A torn last
  line is ignored and cut by the next writer.
- **The driver** runs the phases, asks the state machine what comes next, and is the only thing that writes the journal.
- **Live progress** in `compose`: phases, steps and their comments, what is reused; plain lines without a terminal, and
  `--json`.

## Done when

- Every allowed transition has a test, and every other one is refused in a test, without Docker.
- The run's state read back from its journal equals the one the driver held.
- A compose shows each step as it plays.
