# 002: Cancel goes on the socket; Resume and Run again are HTTP

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** how does the Run screen send Cancel, Resume and Run again?

**Decision:**

- **Cancel** is a `cancel` message on the run's socket; the server sends it to the run's process as `flow-reel cancel`
  does (`sendCommand`). A refusal comes back as a `problem` message.
- **Resume** is `POST /api/runs/resume {run}`: it does what `flow-reel resume --detach` does, with the voice's key from
  the studio's environment. The shared code moves from `src/cli/resume.ts` to `src/host/`. The run's socket keeps
  following its journal after it ends, so the resumed run shows on it.
- **Run again** (failed or cancelled) is GH-136's `POST /api/runs` with the run's workspace and script.

- **Why:** cancel is a command to a run that is going, which is what the socket is for (decision 008); resume and run
  start a process and can wait minutes for the image, as an HTTP answer can.
