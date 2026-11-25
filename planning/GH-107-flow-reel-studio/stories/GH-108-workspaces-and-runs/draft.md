# Workspaces and runs

## Goal

A project becomes a workspace, and every compose becomes a run: it shows its progress, survives the terminal that started
it, can be cancelled or resumed, and leaves only finished reels in the project. It is useful from the terminal alone, and
it is what the studio stands on.

## What it delivers

- **Workspaces** (epic decision 009): an init command that asks for a unique title and an optional description, and writes
  an id, slug and title in `flow-reel.json`. Two checkouts of one project share an id; two different projects with the same
  slug are refused until one gets a local alias.
- **Scripts and reels** (007): scripts named `*.reel.ts` or `*.reel.js`; `checkout.reel.ts` composes to
  `<output folder>/checkout.reel/`, and the output folder is configurable.
- **Run data** (007): the tracker and one folder per run in flow-reel's data folder. The project is mounted read-only.
- **The engine** (031): the state machine, phases, gates before each phase, the journal, the lease, the cue sheet, the
  tracker rebuilt from the journals, one recording at a time.
- **A process per run** (023), with time limits per phase.
- **The CLI:** `compose` with live progress, `--detach`, and commands to wait, read logs, cancel and resume.
- **The migration** from 0.7's scripts and reels, documented.

## Rules every ticket keeps

- The state machine is tested without Docker, and every transition has a test.
- Recording never restarts by itself (005): a person or a command asks.
- In CI, nothing asks a question; the exit code and lines of progress say everything.
- The journal and the interface carry a version from the first ticket.

## To check early

- A run's container shuts itself down when the run's process is killed.
- Linux, macOS and Windows data folders, and the swap of a finished reel across disks.

## Done when

- A compose can be started detached, watched, cancelled, killed at each phase and resumed, and nothing finished is lost.
- Deleting the tracker changes nothing once it is rebuilt.
- The project holds only scripts, settings and finished reels, during and after a run.
- The same scripts give the same steps, sound and timing as on 0.7.

## Not part of this story

- The studio, holding a run from a client, and the new script words.
- The new configuration and keys: voices and keys work as on 0.7 until stories 4 and 5.
