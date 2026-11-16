# Teach speedUp and skip in the plugin, and release it

## Problem

Agents write reels from the plugin's references. Until it teaches `speedUp` and `skip`, an agent recording a slow
agent reply or build shows the whole wait in real time.

## Change

- `plugin/references/language.md`: both words, their options and rules (only actions inside; a comment written just
  before the wait is spoken over it), and when to pick each: speed up when the viewer should see progress, skip
  when only the result matters.
- The reel skill's install line moves to `flow-reel@0.4`, and preflight's minimum runtime to 0.4.0, so an agent never
  writes these words for a 0.3 runtime.
- A plugin-only PR (`feat:`, only `plugin/`), then its own plugin release (GH-62 decision 001). Ships after 0.4.0 is
  published.

## For the ticket pass

- Whether other references (`direction.md`, `scenes.md`, `story.md`) and the reshoot skill should mention waits.
- Whether the worked example (`plugin/examples/saved-views`) should show a wait.

## Done when

- The plugin release lists both words; preflight refuses a 0.3 runtime with a clear message and accepts 0.4.
- The plugin's consistency tests pass.
