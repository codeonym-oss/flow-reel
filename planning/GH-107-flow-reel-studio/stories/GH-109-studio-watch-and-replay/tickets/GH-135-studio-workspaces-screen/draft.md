# Workspaces in the studio

## Problem

The person can't see their projects and runs together, outside the terminal.

## Change

- **Workspaces** from the mockup: each workspace with its scripts, runs, latest state and run files' size; adding one
  from its path (epic 021), with the offer to make `flow-reel.json` when it has none.
- **Today:** who had the recording slot, and when.
- **Every run:** the history, filtered (going on, failed, resumable, by an agent), and **Clean**, which asks first, as
  `flow-reel clean` (story GH-108).

## Done when

- Runs started in a terminal or by an agent appear without reloading.
- Adding a folder by path registers it; a path outside it can't be read (010).
- Clean removes what `flow-reel clean` would, and nothing that can still be resumed.
