# Implementation

1. `src/workspace/config.ts`: `flow-reel.json` version 2, read, checked and written. → check: `workspace.test.ts`.
2. `src/workspace/workspace.ts`: find the workspace and a script, name its reel, refuse what doesn't fit. → check: same.
3. `src/host/data.ts`: the data folder of each system, the workspaces known there, slugs and aliases. → check: `init.test.ts`.
4. `src/workspace/init.ts`, `src/cli/init.ts`: `init`, its questions, taking over a 0.7 file. → check: `init.test.ts`.
5. `src/cli/`: one module per command, one way to read arguments. → check: `cli.test.ts`.
6. `src/container/`: the image's own entry point, given the whole request by the host; the scripts folder is read-only. →
   check: the e2e suites, which compose through workspaces.

**Risks:** the plugin still teaches 0.7 and is tested against its example moved into a workspace; GH-121 updates it.
