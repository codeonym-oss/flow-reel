# Teach agents to make polished reels with the flow-reel plugin

## Problem

flow-reel 0.2 ships the language: scripts with comments, sounds and effects, settings for the voice, and a reel
with a manifest. An agent still has to turn "show this feature" into a reel worth watching: pick the story, find the
real path through the app, write the script, direct the picture and the sound, compose, and judge the result
honestly. A command reference doesn't teach any of that.

## Change

Ship one `flow-reel` plugin, in `plugin/`, with three skills (decisions 006, 007):

- **`reel`:** a request from start to finish: plan, explore the app, write the script, compose, review, hand over.
  It picks up from an existing script or reel.
- **`reshoot`:** feedback on an existing reel: change the script's comments, sounds and effects where the feedback
  points, compose again, review.
- **`screening`:** judge a finished reel without changing it: verify, compare, look at the picture, listen.

The know-how sits in ten shared references (decision 008): the language, story, scenes, direction, comments, sound
design, shots (worked recipes), exploring the app, screening and troubleshooting. Two helpers (decision 009):
`preflight.mjs` checks what composing needs and changes nothing; `stills.mjs` pulls frames at each step's start and
end into a contact sheet, so an agent can see the reel. A small sample app and templates complete the suite. The
skills use the `CONTEXT.md` words; the plugin contains no composing logic.

The plugin releases as its own release-please component, `flow-reel-plugin` (decision 005), so a plugin change cuts
no npm or image release, and is listed in both catalogs of `codeonym-oss/claude-plugins` with `git-subdir` sources.
It supports runtime `>=0.2.0 <0.3.0`, and a test ties that range to `package.json` (decision 010). It ships in three
pull requests: plumbing, the suite, the listing (decision 011).

## Out of scope

New composer features (music, more voices, new effects or sounds, export formats), a hosted service or MCP server,
editing the video file, and tested support for agents other than Claude Code and Codex.

## Done when

- The three skills are discoverable, and their references, helpers and templates resolve from an installed copy of
  `plugin/` alone, without the checkout.
- A fresh agent session with the packaged plugin explores the sample app, writes a script that uses comments,
  sounds and at least one effect, composes it, screens the reel (verify plus stills) and hands over the reel and the
  command to compose it again.
- Every example uses the 0.2 API and flags and typechecks against it; nothing teaches a flag or option the composer
  doesn't have.
- `preflight.mjs` reports missing prerequisites and an unsupported runtime without changing the machine;
  `stills.mjs` writes stills for every step of a real reel and fails on a missing or broken video.
- A `plugin/`-only change proposes only a plugin release, a runtime change only a runtime release, and a plugin
  release doesn't run `publish.yml`.
- Plugin 0.1.0 is released, both catalogs list it, and installs are checked in clean clients where available, with
  any gap stated.
- The existing unit, type, package and media checks stay green.

## Breakdown and evidence

- [Skills, references, helpers and scenarios](skill-suite.md)
- [Implementation plan](impl.md)
- [Publishing](publishing.md)
- Decisions 005–011 (005 from the first plan; 006–011 from the 0.2 re-plan, which supersede 001, 003 and 004).
  Inherited GH-1 and GH-27 decisions still apply.
