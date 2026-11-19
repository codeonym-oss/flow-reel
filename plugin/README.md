# flow-reel plugin

Teaches a coding agent to make reels with [flow-reel](https://github.com/codeonym-oss/flow-reel): narrated,
polished videos of a web app's features, composed from a Playwright script with comments, sounds and effects.

| Skill | Use it to |
|---|---|
| `reel` | go from "make a demo of this feature" to a finished, checked reel |
| `reshoot` | change an existing reel from feedback, compose it again and compare |
| `screening` | judge a reel without changing it |

The skills share references (`references/`: the language, story, scenes, direction, comments, sound design, shot
recipes, exploring, screening, troubleshooting), two helpers (`scripts/preflight.mjs`, `scripts/stills.mjs`),
templates (`assets/`) and a worked example (`examples/saved-views/`).

**Needs:** a project with `flow-reel` installed (supported versions: see `references/language.md`), Node 22.18 or
later, and Docker or Podman. The plugin contains no composing logic; flow-reel does the work.

**Install:**

```text
# Claude Code
/plugin marketplace add codeonym-oss/claude-plugins
/plugin install flow-reel@codeonym-oss

# Codex
codex plugin marketplace add codeonym-oss/claude-plugins
codex plugin add flow-reel@codeonym-oss
```

The plugin and the flow-reel package update separately.

A walkthrough of a session, prompts that work well, and how keys and logins are handled:
[Make reels with Claude](https://docs.codeonym.work/projects/flow-reel/en/latest/tutorials/with-claude/).
