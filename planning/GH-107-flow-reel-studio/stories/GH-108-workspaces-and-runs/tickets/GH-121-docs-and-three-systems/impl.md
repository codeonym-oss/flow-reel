# Implementation

1. Docs: `guide/runs.md`, the CLI, settings and migration pages, and every page that named the old files. → check:
   `sphinx-build -W`.
2. The plugin, in its own pull request (decisions 001 and 002). → check: `plugin.test.ts`, `plugin-helpers.test.ts`, and its
   example composed in `test/e2e/plugin.test.ts`.
3. The unit tests of what runs on the person's computer, on macOS and Windows (decision 003). → check: the `systems` job.
4. The comparison with 0.7, below.
5. The decisions this story changes, marked superseded in part or in whole: GH-31 001, 002 and 005, GH-33 001 and 005, GH-76
   006.

## The story's "done when"

| Says | Shown by |
|---|---|
| Started detached, watched, cancelled | `test/e2e/runs.test.ts`: "outlives the command and its terminal", "is cancelled by Ctrl+C"; `owner.test.ts`: "takes a cancel", "say how a run ended by their exit codes" |
| Killed at each phase and resumed, nothing finished lost | `owner.test.ts`: "let a run killed in its %s phase go on from there"; with real containers, `test/e2e/runs.test.ts`: "goes on to its reel without repeating what it finished", "isn't recorded again" |
| Deleting the tracker changes nothing | `history.test.ts`: "is the journals' index: removed, damaged or from another version, it is made again" |
| Only scripts, settings and finished reels in the project | `test/e2e/record.test.ts`: "writes one reel in the output folder"; `git status` of the migrated project below |
| The same steps, sound and timing as on 0.7 | the comparison below |

## The comparison with 0.7

2026-11-25, Linux, Docker, the cloud image of v0.7.0 and of this branch, a fake cloud voice, three scripts composed twice on
each, one after the other: the saved-views example, the docs' orbit tour (cards and overlays) and a script with a flash, a zoom,
a speed-up and a skip. The 0.7 project was made a workspace by following the migration page (`init`, then the `git mv` lines).

| Script | 0.7 | Here | Steps, clips and effects |
|---|---|---|---|
| saved views | 31.6 s, 29.3 s | 35.1 s, 32.1 s | match |
| orbit tour | 132.9 s, 123.0 s | 130.9 s, 130.5 s | match |
| effects | 38.5 s, 39.7 s | 40.7 s, 42.0 s | match but one zoom |

- **The same sounds** in the same order, at most 104 ms apart (0.7 against itself: 63 ms); lengths within 33 ms (0.7 against
  itself: 67 ms); the same size, frame rate, codecs and loudness (-16 LUFS).
- **The one zoom** is a `zoomOut` cut short by the next step, whose length in the event log is whatever time was left. 0.7
  differs from itself there too: `compare` asks for an exact length. Not changed here.
- **2 to 4 s more on short reels**: the voice and the render start containers of their own (decision 011, which expected
  0.4 to 0.7 s each; about 1 s was measured).

## For the person to check

CI has no Docker on macOS and Windows, and no Podman.

1. macOS and Windows, Docker Desktop: `init`, `compose` a script of an app on `localhost`, and the reel.
2. There: `compose --detach`, close the terminal, `wait`. Then kill the run's process while it renders: `docker ps` shows no
   flow-reel container, and `resume` ends it.
3. Windows: another account can't cancel a run (the pipe's permissions).
4. Podman on Linux: the same two checks.
