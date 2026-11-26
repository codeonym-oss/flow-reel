# Watch a run live in the studio

## Problem

Following a run means reading the terminal's output.

## Change

- **One WebSocket per watched run** (008), relayed from the run's own pipe (story GH-108).
- **Run** from the mockup, without the live picture: steps, log, journal, failures, the phases and their progress, the
  recording slot, and **Cancel** and **Resume**.
- Reopening the studio replays what happened meanwhile from the journal (epic 031).

## Done when

- A run started in a terminal shows its steps and phases live, and the run goes on when the tab or the studio closes.
- Cancel and Resume do what `flow-reel cancel` and `flow-reel resume` do.
- The Waiting, Failed and Stopped states match the mockup.
