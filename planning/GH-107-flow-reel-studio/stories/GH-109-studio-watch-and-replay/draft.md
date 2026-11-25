# The studio

## Goal

A person opens the studio and sees their projects, starts runs, watches them live, whoever started them, and replays reels.
The reel is drawn as a score that writes itself as the run plays.

## What it delivers

- **A local server** embedded in flow-reel (epic decision 027), started by one command and reachable from this computer
  only. It needs no account and no internet (032).
- **Workspaces:** every project with its latest runs, and adding one from its path (021).
- **Scripts:** each script with its last reel and state, opening one by path, and running again on save, off by default.
- **Run:** the app live, the steps, the score, the phases and their progress, logs and failures, and cancel and resume.
- **Reel:** play, scrub and jump to a step, with the voice, sounds, camera and cards on the score.
- **Run history,** including runs started in a terminal or by an agent.
- **The design** (024): the score, in light and dark, usable by keyboard, with long scripts that zoom and fold.

## Rules every ticket keeps

- The studio is a client of the run interface (031): it does nothing a CLI or a TUI couldn't do.
- Closing the studio or its tab never stops a run (023). Reopening it shows what happened meanwhile.
- The app being shown is the brightest thing on screen.
- Requests from other sites are refused, and only registered workspaces' files can be read.

## To settle in its pass

- The design in detail, from pictures of each screen the person approves, including whether each step's picture is shown.
- How the live picture reaches the studio, and that showing it doesn't slow a recording.

## Done when

- The person's three projects can be opened, run, watched and replayed from the studio.
- A run started in a terminal appears live in the studio, and continues when the studio closes.
- The person approves each screen, in light and in dark.

## Not part of this story

- Holding, stepping and the remote screen (story 3); the Settings screen (story 4).
