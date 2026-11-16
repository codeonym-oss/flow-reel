# 002: Where the plugin teaches waits

**Date:** 2026-11-16 (ticket pass; widened by the person's request for recipes covering different scenarios)

**Question:** Besides `language.md`, which references, skills and templates mention waits, and does the worked
example show one?

**Decision:**
- `language.md`: a "Long waits" section, with one typechecked script using both words. The rules live only here.
- `shots.md`: two recipes, an agent's reply under `speedUp` and a long build under `skip`.
- `direction.md` (pacing: when to shorten, which word, the factor), `scenes.md` (a long-job scene),
  `screening.md` (no wait left in real time), `troubleshooting.md` (timeouts, words inside, an old runtime).
- The reel skill (the word list, a script rule, the cloud voice when the CPU is slow), the reshoot table, the brief
  template's effect note and the starter script's comment.
- **Not** the worked example `plugin/examples/saved-views`: its app has no long wait. Its brief names runtime 0.4.

- **Why:** each reference keeps its job, and an agent meets waits at every step of making a reel.
