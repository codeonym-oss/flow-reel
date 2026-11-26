# The studio

## Goal

A person opens the studio and sees their projects, starts runs, watches them live, whoever started them, and replays reels.
The reel is drawn as a score that writes itself as the run plays.

## What it delivers

- **A local server** embedded in flow-reel (epic decision 027): `flow-reel studio` starts it, opens the browser and stays
  in the foreground (003). It needs no account and no internet (032).
- **Workspaces:** every project with its latest runs, adding one from its path (021), the day's recording slot, history
  and cleaning.
- **Scripts:** each script with its last reel and state, opening one by path, and running again on save, off by default.
- **Run:** the app live, the steps, the score, the phases, logs, the journal and failures, and cancel and resume.
- **Reel:** play, scrub and jump to a step, with the voice, sounds, camera and cards on the score.
- **The design:** the approved mockup (004) on the Orbit logo and the studio theme (005, 006): dark and light, usable by
  keyboard, at phone to desktop widths; long scripts zoom and fold.

## Rules every ticket keeps

- The studio is a client of the run interface (epic 031): it does nothing a CLI or a TUI couldn't do.
- Closing the studio or its tab never stops a run (epic 023). Reopening it shows what happened meanwhile.
- The app being shown is the brightest thing on screen.
- **Talking to the server** (008): HTTP with JSON for lists, one WebSocket per watched run for events, pictures and
  commands, and one TypeScript file of types shared by the server and the Preact client (001).
- **Three locks** (010): 127.0.0.1 only; requests from any other `Host` or `Origin` refused; a one-time key traded for a
  cookie. Only registered workspaces' and their runs' files can be read.
- **Live picture** (002, 009): a light second grab, only while someone watches; a slow watcher gets only the newest
  picture, and events are never dropped.
- Each screen is built from the approved mockup (`prototypes/studio-mockup.html`), in dark and light.

## Tickets, in the order they ship (011)

1. The server and the shell
2. Workspaces
3. Scripts
4. Run, live
5. The live picture
6. The score
7. Reel

## Done when

- The person's three projects can be opened, run, watched and replayed from the studio.
- A run started in a terminal appears live in the studio, and goes on when the studio closes.
- Recording with someone watching costs no more than gate 4 allows, measured against 0.7.
- The person approves each screen, in light and in dark.

## Not part of this story

- Holding, stepping and the remote screen (story 3); the Settings screen (story 4).
