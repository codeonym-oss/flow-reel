# 009: A workspace must be initialized, with a unique title

**Date:** 2026-11-25 (stated by the person: "a mandatory --init for workspaces, it requires a title of the project etc
(unique etc ..) and maybe other metadata such as optional description")

**Decision:** **a project becomes a workspace through an init command, which requires a unique title and takes optional
metadata such as a description.** Other commands need an initialized workspace.

- **Open:** the exact command, and how the title stays unique across clones and worktrees of one project.
