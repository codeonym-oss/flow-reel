# 002: A workspace has one scripts folder, and a running script can read only that

**Date:** 2026-11-25 (grilling, Q2; agreed: "1, one scripts folder named in flow-reel.json")

**Question:** which folder can a running script read?

**Decision:** **one scripts folder, named in `flow-reel.json` (`"scripts": "reels"`, the default), mounted read-only.** Logos,
card pages and helpers live in it, paths in the config are relative to it, and flow-reel lists its scripts from there. A
script outside it is refused.

- **Why:** helpers and logos are shared between scripts, `.env` and `.git` stay out of a script's reach, and the scripts are
  found without walking the project.
- **Accepted cost:** a logo in `public/` has to be copied into the scripts folder. A monorepo makes one workspace per app.
- **Not chosen:** mounting the whole project (every script could read its secrets, with internet access); the script's own
  folder, as on 0.7 (no shared helpers or logo).
