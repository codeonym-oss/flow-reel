# 015: A script can interrupt its run and ask a person to do something

**Date:** 2026-11-25 (stated by the person: "id add a new capability to the reel script, the interrupt! like langchain
interrupt … advice the user to start the server and do something themsleves maybe a password filling? a checkout of
payment? … (only if possible)")

**Decision:** **a new script word, `interrupt`, holds the run and asks the person, through the studio, to do something
themselves; then the run goes on.** It looks possible with Playwright: the script waits on the word while the person uses
the browser.

- **To check when built:** sending the person's keyboard and mouse to the browser in the container.
- **Open:** when nobody comes, how what the person types stays out of the recording, and whether it can return a value.
