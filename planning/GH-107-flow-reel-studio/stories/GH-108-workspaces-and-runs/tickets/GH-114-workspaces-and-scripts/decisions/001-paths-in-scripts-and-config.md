# 001: A script's paths start at the script; the config's start at the scripts folder; both reach the whole scripts folder

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Question:** with scripts in subfolders, what is `card.image("shots/app.png")` in `admin/refund.reel.ts` relative to?

**Decision:** **the script's own folder, as on 0.7, and it may go up to the scripts folder (`../shots/app.png`).** Paths in
`flow-reel.json`'s brand start at the scripts folder (story decision 002). The event log, the transcript and the manifest
name files by their path in the scripts folder, so `admin/refund.reel.ts`.

- **Why:** a script's paths read like its imports, and moving it with its files keeps them.
