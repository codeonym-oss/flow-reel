# 005: A compose builds `<name>.reel.partial/` and replaces the old reel only on success

**Superseded by GH-108 015** (2026-11-25): the reel is built in the run and swapped in; there is no `.partial` folder.

**Date:** 2026-11-14 (ticket pass, Q6; agreed: "ok")

**Question:** what happens to an existing reel when its script is composed again?

**Decision:** **the composer builds the new reel, `work/` included, in `<name>.reel.partial/` beside where the reel
goes, removing any leftover partial folder first. Only when the reel is complete, manifest last, does it remove the
old `<name>.reel/` and rename the partial folder into its place.** A failed compose leaves the old reel untouched and
the partial folder behind for debugging.

- **Why:** keeps today's rule that a failure publishes nothing; a person never ends up with half a reel; the old reel
  stays readable during the compose, which the reel cache (GH-33) can use.
- **Not chosen:** overwriting in place (a failure destroys the good reel); refusing unless `--force` (friction in the
  normal edit-and-compose loop).
