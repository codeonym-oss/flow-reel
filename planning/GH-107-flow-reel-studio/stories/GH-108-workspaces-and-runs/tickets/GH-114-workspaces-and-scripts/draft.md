# Workspaces, scripts and the output folder

## Problem

Today any folder with a `flow-reel.json` is a place to compose, a script can have any name, and a reel lands beside it. A
project has no identity, so nothing can list its scripts or its runs.

## Change

- **`flow-reel init`** writes one `flow-reel.json` (version 2) at the project's root: id, slug, title, optional description,
  scripts and output folders (decisions 001 to 003, epic 009). It asks in a terminal and takes flags everywhere. It takes over
  a 0.7 file's voice and brand, and lists the scripts to rename.
- **Every compose needs a workspace,** found by walking up from the script. A second `flow-reel.json` above or below is
  refused, with how to merge it. A 0.7 file is refused with the `init` to run.
- **Scripts** are `*.reel.ts` or `*.reel.js` in the scripts folder; `admin/refund.reel.ts` composes to
  `<output>/admin/refund.reel/`. Two scripts that would give the same reel are refused. `--out` stays.
- **Workspaces are known to the computer** in flow-reel's data folder: two checkouts share an id, and another project with the
  same slug is refused until it gets a local alias (`init --alias`).
- The scripts folder is mounted read-only, and compose no longer writes settings unless `--save-config` asks.

## Not part of it

Run data outside the project (next ticket), config commands and keys (story 4), the plugin.

## Done when

- A 0.7 project is taken over with `init` and its renamed script composes to a reel that `compare` matches.
- Each refusal above has a test and says what to do.
- The e2e tests compose through workspaces.
