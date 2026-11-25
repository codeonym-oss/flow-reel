---
status: open
from: agent
found-while: GH-101
resolved-by:
---

# CI's image build cache loses layers, and its uploads slow the voices shard

Seen on 2026-11-24, in the `e2e (amd64, voices)` job, the one that writes the build cache (`cache-to` in
`.github/workflows/ci.yml`):

- **Missing layers.** Main CI run 45477311104 (d8aeb9b) read a cache manifest whose layers were gone (`blob
  sha256:… not found`, six times), so it rebuilt the voice layers. The three CI runs before it that day didn't have
  the error, nor did nine runs from 2026-11-20 to 2026-11-23.
- **Slow uploads.** The cache export took 3, 12, 16 and 4 minutes in runs 45468456471, 45471660189, 45472141201 and
  45477311104. One layer alone took 891 s. The job took 15 to 27 minutes, against 7 to 13 before GH-101.

After the release, the repository's caches held 9.05 GB, with three 2.02 GB layers. GitHub's default limit is 10 GB
per repository, so eviction is the likely cause of the missing layers. That is not confirmed, and neither is how much
GH-101 adds: the layer order changed, so its first runs were cold, and `publish.yml` writes a second scope per
architecture. Releases and published images aren't affected, only CI time.

Left for later because GH-101 was released and nothing is wrong with the images.

A fix starts by measuring one warm main run, to see whether the uploads repeat. Then the model layer
(`docker/tts/download.py` in `docker/Dockerfile`, probably the 2.02 GB layers) is the first candidate to leave out of
the cache: downloading it took 14 to 19 s in three runs. `mode=max` exports every layer, so leaving one out needs
another way to cache, such as a registry cache or not caching `full` at all. GH-101's claim that one scope per
architecture is enough (impl.md step 5) should be checked then. It is a `ci:` change.
