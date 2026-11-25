# 002: The app's server runs in one long-lived composer container, for one opened folder

**Withdrawn 2026-11-25:** the person says nothing was agreed ("i havent agreed on anything yet! we are starting again"); their "ok" was read as agreement.

**Date:** 2026-11-25 (grilling, Q2; agreed to the recommendation: "ok")

**Question:** where does the web app's server run?

**Decision:** **inside the composer container.** One command (for example `flow-reel open [folder]`; the name is still
open) starts a long-lived container with the opened folder mounted, reachable from this computer only. Composes and
rehearsals run in it one at a time, each in its own process.

- **Paths:** scripts inside the opened folder. Another folder is opened by starting again with it.
- **Voices:** the full image if any script in the folder needs the local voice, otherwise the cloud image. The full
  image composes cloud voices too.
- **Keys:** the variables named in the folder's `flow-reel.json` files are passed by name at start; a new one needs a
  restart.
- **Accepted cost:** a script can reach everything in the opened folder, where a CLI compose mounts its own folder only.
- **Why:** it is what the person asked for, it keeps the live stage beside the browser it shows, and it has the fewest
  moving parts.
- **Not chosen:** a server on the host with a container per job (any path and the right image per script, but progress
  and the live stage must cross containers, and the image offers no app); a container with Docker's socket (effectively
  root on the host, in an app that runs scripts).
