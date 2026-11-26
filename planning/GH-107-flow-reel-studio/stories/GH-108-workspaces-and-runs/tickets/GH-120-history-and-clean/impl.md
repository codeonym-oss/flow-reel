# Implementation

1. `src/host/tracker.ts`: the index. → check: `history.test.ts` removes it, damages it, changes its version, locks it.
2. `src/host/retention.ts`: what is heavy, finished and trimmed. → check: `history.test.ts`, `owner.test.ts` (a process trims).
3. `src/cli/runs.ts`: `runs` and `clean`. → check: `history.test.ts`; `clean` by hand on the files containers made.
4. `--json` for `init`, `verify` and `compare`. → check: `cli.test.ts`, `init.test.ts`.

**Risks:** none known.
