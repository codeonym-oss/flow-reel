# 006: Configuration is global and per workspace, with config commands

**Date:** 2026-11-25 (stated by the person: "the flow-reel will ofer config commands, there are two kinds of configs, the
global config: sets the default for everything … and there is the local version, per workspace .. trait it how npm / pnpm
has both --global and --local")

**Decision:** **a global configuration sets the defaults for everything, and each workspace can override it locally.**
`flow-reel config` commands write either one, with `--global` and `--local`.

- **Open:** where API keys are stored, the order between flags, environment, local and global, and the exact commands.
