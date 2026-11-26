# 005: Clean shows what it would remove, then removes only that, as `flow-reel clean`

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** how does Clean ask first, and how is it kept the same as `flow-reel clean`?

**Decision:**

- What `clean` removes moves from `src/cli/runs.ts` to `src/host/retention.ts` (`cleanable`), and both use it.
- A workspace's card shows its run files' size and **Clean**. Clean asks with what `GET /api/clean?workspace=<id>`
  answers: how many runs and how many bytes. **Remove** sends `POST /api/clean` for that workspace, and the server
  removes what is cleanable then, so a run resumed in between keeps its files (`removeHeavyFiles` checks again).
- The answer says what was freed, shown in a toast.

- **Why:** one rule in one place: the studio can't remove anything the command wouldn't.
