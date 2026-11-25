# 003: The core is TypeScript; Python is for the voice service

**Withdrawn 2026-11-25:** the person says nothing was agreed ("i havent agreed on anything yet! we are starting again"); their "ok" was read as agreement.

**Date:** 2026-11-25 (grilling, raised by the person: "can core be written in python? is it a good approach?"; agreed to
the recommendation: "ok")

**Question:** is the core written in Python, with scripts in TypeScript?

**Decision:** **no: scripts, core, server, web app and CLI are TypeScript, and Python is for the local voice and any
later machine learning, behind an interface.** This keeps GH-27 decision 006 after asking it again on the merits.

- **Why:** the app's instant preview and the composer can run the same timeline and camera code (those modules import
  no Node or ffmpeg code today); one definition of the event and reel formats; npm alone installs it.
- **Not chosen:** a Python core with a Node process for scripts. It is sound, but the preview code would be written
  twice, the formats generated for two languages, and a Python runtime installed on the host. Rendering gains little,
  because ffmpeg does the encoding either way.
- **Would change it:** flow-reel becomes mostly machine learning; the app drops instant preview; the maintainers are
  much stronger in Python.
- **Open:** whether the voice becomes a separate service is part of the architecture question, not settled here.
