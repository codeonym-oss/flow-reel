# History: the tracker, runs and clean

## Problem

Runs pile up in the data folder with nothing to list or trim them.

## Change

- **The tracker:** a SQLite index of every workspace's runs, rebuilt from the journals whenever it is missing, older or
  damaged (epic 031).
- **`runs`** lists this workspace's, `--all` every workspace's, each with its state and what can be done.
- **Retention** (004): the heavy files of the last 5 finished runs of each script are kept, configurable; runs that can be
  resumed are never trimmed.
- **`clean`** shows what would go and asks; `--yes` for CI.

## Done when

- Deleting or corrupting the tracker changes nothing once it is rebuilt.
- The sixth finished run of a script trims the first one's heavy files and keeps its history.
- `clean` never removes a run that is alive or can be resumed.
