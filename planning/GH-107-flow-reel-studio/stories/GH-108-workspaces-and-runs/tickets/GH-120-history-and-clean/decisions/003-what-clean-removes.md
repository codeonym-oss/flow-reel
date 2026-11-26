# 003: `clean` removes every finished run's files, whatever `keepRuns` says

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **it removes the heavy files of this workspace's finished runs (`--all`: every workspace's), and folders of runs
that never started and are a day old. It lists them with their sizes and asks; without a terminal, `--yes` is needed.**

- **Why:** what is beyond `keepRuns` is already gone by itself, so that alone would leave `clean` nothing to do.
- **Accepted cost:** a stopped run nobody will resume keeps its files. `resume` and `cancel` make it a finished one.
