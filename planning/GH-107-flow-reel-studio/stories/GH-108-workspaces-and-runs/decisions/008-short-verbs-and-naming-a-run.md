# 008: The commands are short verbs, and a run is named by its script or its id

**Date:** 2026-11-25 (grilling, Q7; agreed: "1, short verbs with the safety rule")

**Question:** what are the commands?

**Decision:** **`init`, `compose [--detach]`, `runs [--all]`, `watch`, `wait`, `logs`, `cancel`, `resume` and `clean`, beside
`verify` and `compare`.** A script's name (`checkout`) means its latest run; an id means an exact one. `cancel` and `resume`
by name are refused when more than one run matches, and list the ids. Every command takes `--json`. `wait` prints nothing
and its exit code says how the run ended. Ctrl+C cancels a plain `compose`, as on 0.7, and only stops watching in `watch`.

- **Accepted cost:** nine top-level commands; `watch` can be mistaken for running again on save.
- **Not chosen:** grouping them under `run` (longer, and it reads like starting one); exact ids only (every command would
  need `runs` first).
- **Open:** the form of an id (`checkout#12` or `r-7f3a`).
