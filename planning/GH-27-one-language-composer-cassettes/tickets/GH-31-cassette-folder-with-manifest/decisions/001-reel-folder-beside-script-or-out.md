# 001: The reel is `<name>.reel/` beside the script, or inside the folder `--out` names

**Superseded by GH-108 003** in part (2026-11-25): reels go to the output folder, not beside the script. `--out` stands.

**Superseded by 002** for where work files go: the reel's `work/`, not `.flow-reel/`.

**Date:** 2026-11-14 (ticket pass, Q1 and Q2; agreed: "ill pick 3" and "ok")

**Question:** where does the reel folder go, what is it called, and what does `--out` name?

**Decision:** **`flow-reel compose demos/settings.ts` writes `demos/settings.reel/`; `--out <dir>` writes
`<dir>/settings.reel/` instead.** The reel's name always comes from the script's file name, without its extension.
`--out` is resolved from the current directory and may point outside the script's folder: the host launcher then
mounts that folder into the container too. Work files stay in the self-ignoring `.flow-reel/<name>/` beside the
script.

- **Why:** the reel pairs visibly with its script by default; one output folder can hold the reels of many scripts
  (a CI artefact folder), and names stay predictable.
- **Not chosen:** a `cassettes/<name>/` folder beside the script (weaker pairing); no `--out` (a CI job wanting one
  output folder must move files itself); `--out` naming the reel folder itself (two scripts aimed at one path
  overwrite each other, and pointing it at an existing folder that isn't a reel replaces that folder).
