# 001: A workspace has one `flow-reel.json`, at the project's root

**Date:** 2026-11-25 (grilling, Q1; agreed: "1, one flow-reel.json at the project root")

**Question:** where does a workspace start, when today each scripts folder can have its own `flow-reel.json`?

**Decision:** **one `flow-reel.json` at the project's root, holding the id, slug, title, voice and brand.** flow-reel finds
it by walking up from the script. Another one below it is refused, with a message saying how to merge it.

- **Changes:** GH-33 decision 001 (the file beside the scripts).
- **Why:** one project, one file, one place to look.
- **Accepted cost:** a 0.7 project with two brands needs two workspaces.
- **Not chosen:** overrides in subfolders (two levels to merge on top of the global and local config, epic 006; they can be
  added later); a workspace per scripts folder (one project would show up as several).
