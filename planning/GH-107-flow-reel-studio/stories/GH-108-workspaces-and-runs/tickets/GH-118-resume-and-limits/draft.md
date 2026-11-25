# Resume and time limits

## Problem

A run that stopped after its recording has everything it needs to finish, and a phase that hangs never ends.

## Change

- **`resume`** continues from the first phase without a valid result, with the settings the run started with (005). It
  refuses a lost recording and names the `compose` to run (006), and says when the script has changed since.
- **What can be done** with each ended run is worked out from its data and shown (007).
- **A time limit per phase,** with defaults that `flow-reel.json` can change; held time doesn't count.
- A resumed run never replaces a newer run's reel (010).

## Done when

- Killed while recording: refused. Killed while voicing, planning, rendering or publishing: resumed to the same reel an
  unbroken run gives, without repeating finished phases.
- A phase over its limit fails with its name and limit, and its container is gone.
- A result whose files were changed or removed is made again, not trusted.
