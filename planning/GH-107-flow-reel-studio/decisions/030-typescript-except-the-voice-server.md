# 030: Everything is TypeScript, except the voice server, which is Python

**Date:** 2026-11-25 (confirmed with the shared understanding: "yes, write the epic and story drafts")

**Replaces 003,** which was withdrawn, with the same content.

**Decision:** **scripts, core, server, web app and CLI are TypeScript; the voice server is Python.** Keeps GH-27 decision
006.

- **Why:** the studio's preview and the composer can run the same timeline and camera code; the event and reel formats have
  one definition; npm alone installs it.
- **Not chosen:** a Python core with a Node process for scripts (the preview code written twice, formats generated for two
  languages, a Python runtime on the host).
