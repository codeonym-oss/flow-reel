# Workspaces and runs

## Goal

A project becomes a workspace, and every compose becomes a run: it shows its progress, survives the terminal that started
it, can be cancelled or resumed, and leaves only finished reels in the project. It is useful from the terminal alone, and
it is what the studio stands on.

## What it delivers

- **Workspaces** (decisions 001, 002; epic 009): one `flow-reel.json` at the project's root, written by `flow-reel init`, with
  an id, slug and title. Two checkouts share an id; two projects with the same slug are refused until one gets a local alias.
- **Scripts and reels** (002, 003): `*.reel.ts` or `*.reel.js` in one scripts folder; reels in `reels/out` by default.
- **Run data** (004, 014, 015): one numbered folder per run in flow-reel's data folder, with its own copy of the scripts.
  Containers never see the project.
- **The engine** (epic 031): the state machine, phases, gates, the journal, the cue sheet, one lock for heavy work (009).
- **A process per run** (011, 016; epic 023), with time limits per phase.
- **The CLI** (008): `init`, `compose [--detach]`, `runs`, `watch`, `wait`, `logs`, `cancel`, `resume`, `clean`.
- **The migration** from 0.7's scripts and reels, documented.

## Rules every ticket keeps

- The state machine is tested without Docker, and every transition has a test.
- Recording never restarts by itself, and `resume` never records (005, 006).
- In CI, nothing asks a question; the exit code and lines of progress say everything.
- The journal and the interface carry a version from the first ticket.
- Only a run's owner writes its journal (016).

## Tickets, in the order they are built (012)

1. GH-114: workspaces, scripts and the output folder
2. GH-115: a compose in phases, outside the project
3. GH-116: the run engine: state machine, journal and live progress
4. GH-117: detached runs: a process per run, and commands to watch and control it
5. GH-118: resume and time limits
6. GH-119: the queue: one heavy work lock, and reels in order
7. GH-120: history: the tracker, `runs` and `clean`
8. GH-121: docs, the migration and the three systems

## Done when

- A compose can be started detached, watched, cancelled, killed at each phase and resumed, and nothing finished is lost.
- Deleting the tracker changes nothing once it is rebuilt.
- The project holds only scripts, settings and finished reels, during and after a run.
- The same scripts give the same steps, sound and timing as on 0.7.

## Not part of this story

- The studio, holding a run from a client, and the new script words.
- The new configuration and keys: voices and keys work as on 0.7 until stories 4 and 5.
