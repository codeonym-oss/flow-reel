# 003: Adding a workspace takes an absolute folder, and reads only its flow-reel.json

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** what may "add a workspace by its path" read, and how does it offer `flow-reel init` (epic decision 021)?

**Decision:**

- The path must be absolute; `~/` means the home folder. Anything else is refused with what was wrong.
- **It has a flow-reel.json:** it is remembered as `flow-reel init` does (`rememberWorkspace`), including the
  error when its name is taken on this computer.
- **It has none:** the answer says so, with the title and scripts folder `init` would propose. The person confirms or
  changes the title, and a second POST with `init: { title }` makes it, as `flow-reel init --title` does.
- The answer never holds the folder's files: only whether the config is there, and the workspace once it is remembered.

- **Why:** story decision 010 keeps the readable files to workspaces' and runs'. Checking a config file is the least a
  folder can be asked.
- **Not chosen:** a folder picker (a browser can't give a local path); relative paths (relative to what?).
