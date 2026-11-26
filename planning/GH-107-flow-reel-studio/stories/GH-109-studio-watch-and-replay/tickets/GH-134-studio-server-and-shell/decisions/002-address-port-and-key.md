# 002: The studio is at 127.0.0.1:4777, and its key lasts as long as the studio

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** which address and port does `flow-reel studio` use, and how long is the key good for (story decision 010)?

**Decision:**

- **Address:** it listens on 127.0.0.1 and opens `http://127.0.0.1:<port>/`, not `localhost`, which can resolve to `::1`
  where nothing listens. Both `127.0.0.1:<port>` and `localhost:<port>` are accepted as `Host`.
- **Port:** 4777, or `--port`. A port in use is an error that names it; it never picks another one silently, so the
  address stays the same between sessions.
- **Key:** a random key made at start, printed in the terminal's URL, good until the studio stops. Opening the URL sets
  an HTTP-only, `SameSite=Strict` cookie named for the port and redirects to the same page without the key, so it
  leaves the address bar. A new `flow-reel studio` makes a new key, and the old cookies stop working.
- `--no-open` prints the URL without opening a browser.

- **Why:** a key used only once would make the printed URL useless after the first tab, and a second browser would need
  a restart. The key only ever appears in this person's terminal and their browser.
- **Changes:** story decision 010's "one-time key", which becomes one key per studio session.
- **Not chosen:** a random port (the address changes every time); a key consumed on first use (above).
