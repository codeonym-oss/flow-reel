# 001: The configuration is a `flow-reel.json` file in the script's folder, and flags override it

**Superseded by GH-108 001** in part (2026-11-25): one file at the workspace's root, written by `flow-reel init`. Flags still win.

**Superseded by 004** for credentials.

**Date:** 2026-11-14 (ticket pass, Q1; agreed: "lets use both, CLI flags and config file .. when running CLI, it uses
default params and write them to the config file ... so user can either hand write the cfg file, or run the CLI
(with/without flags and they get written to the file) .... the highest priority is to run CLI with CLI flags,
followed by file followed by default, user can choose to run --save-config to write/override the settings in the cfg
file")

**Question:** where does the composer's configuration (integration, voice, credentials) live?

**Decision:** **both a file and flags.**

- **The file:** `flow-reel.json` in the script's folder, the one folder the container can see. People can write it
  by hand.
- **Priority:** a flag wins over the file, and the file wins over the defaults.
- **Writing the file:** when there is no `flow-reel.json`, `compose` writes one with the settings it used, flags
  included, so the next compose and the people who share the scripts use the same ones. An existing file is
  rewritten only with `--save-config`, which writes the settings of that run.
- **Credentials:** the file and the flags name environment variables, never their values.
- The host side resolves the settings and writes the file; the container receives the resolved settings.

- **Why:** the voice decides what the reel sounds like, so it travels with the scripts; flags let one run try another
  setting without editing the file.
- **Not chosen:** flags only (the setting isn't kept with the scripts); the file only (no quick override); the
  script's own options (they can't choose the integration that loads the script).
