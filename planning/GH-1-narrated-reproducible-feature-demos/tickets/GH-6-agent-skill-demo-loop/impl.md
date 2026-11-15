# GH-6 implementation plan

Re-planned 2026-11-15 against `main` at e79bde9 (runtime 0.2.0). Typecheck passes; unit tests: 181 pass. No
`plugin/` folder exists yet. The marketplace (`codeonym-oss/claude-plugins` 4eadb33) and groundwork (aa6f5ea) are
unchanged since the first plan read them. Decisions 005–011; the earlier plan is in `history/2026-11-15_1306_impl.md`.

## Read first

- `CONTEXT.md` (every word the plugin uses) and `README.md` sections Write a script, Direct the picture, Compose,
  Configure the composer, Sounds, Verify a reel, Compare reels: the facts `language.md` restates.
- `src/index.ts`: the public API (`script`, the context words, the chained `Locator` words, `Sounds`).
- `src/composer/effects.ts` (effect options and limits), `src/composer/schema/events.ts` (`Sounds`),
  `src/composer/schema/transcript.ts` (`startMs`, `endMs`), `src/settings.ts` (speakers, languages).
- `src/host/launch.ts`: `imageFor`, the engine search, what is mounted, the `localhost` mapping.
- `src/cli.ts`: `USAGE`, `verify` and `compare` exit codes.
- `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/{release-please,publish,ci}.yml`.
- `test/e2e/app/index.html`, `test/e2e/image.ts`: the existing local app and image preparation, for the sample check.
- groundwork's `.claude-plugin/plugin.json`, `plugin.json` and `tests/test_repo.py` at main (re-read for drift).

## Steps

### Pull request 1: plumbing (`ci:` … `Part of #6`, branch `ci/6-plugin-component`)

1. **Plugin component:** `release-please-config.json` gets a second package `plugin` (`component:
   flow-reel-plugin`, `release-type: simple`, `include-component-in-tag: true`, `changelog-path: CHANGELOG.md`,
   `initial-version: 0.1.0`, `extra-files` updating `$.version` in `.claude-plugin/plugin.json` and `plugin.json`);
   the manifest file lists `plugin`. The root package excludes `plugin/` (`exclude-paths`) so a plugin commit
   doesn't count toward the runtime.
   → check: `npx release-please release-pr --dry-run` (or the action's dry run) against a branch with a
   `feat:` touching only `plugin/` proposes only `flow-reel-plugin`; with a `fix:` in `src/`, only the runtime.
2. **Publish only runtime releases:** `release-please.yml` passes the root package's outputs to `publish`; check
   which outputs v5 sets for path `.` with two packages, and use the per-path one if the unprefixed output can be
   set by the plugin.
   → check: the job condition reads the root release only; `actionlint` passes.
3. **Manifests and the range:** `plugin/.claude-plugin/plugin.json` and `plugin/plugin.json` (name `flow-reel`,
   version `0.0.0` until the first release sets it, MIT, the three skill paths; portable onboarding skill
   `./skills/reel/SKILL.md`), `plugin/references/language.md` with only its range line for now, `plugin/
   CHANGELOG.md` empty.
4. **Consistency test** `test/unit/plugin.test.ts`, written first and seen to fail:
   - both manifests agree on name and version, and list exactly the folders in `plugin/skills/`;
   - every relative link in `plugin/**/*.md` resolves inside a temporary copy of `plugin/` alone;
   - `package.json`'s version satisfies the range in `language.md` (decision 010);
   - `npm pack --dry-run` lists nothing from `plugin/`.
   → check: `npm test`, `npm run typecheck`, `npm run pack:check`.
5. **`groundwork.md`** (only with a separate yes): the `feat:`/`fix:` rule names the plugin: "changes that reach the
   published npm package, the image or the plugin".
6. PR (after a yes): title `ci: release the agent plugin as its own component (#6)`, body `Part of #6`. Board: #6 In
   Progress at the branch (board 6 has no In Review option), squash-merge after CI.
   → check: CI green; no release PR for the runtime appears from this merge.

### Pull request 2: the suite (`feat:` … `Part of #6`, branch `feat/6-plugin-suite`)

7. **`language.md`** in full, every fact taken from `src/` and the README, with a typechecked example per word.
   → check: the examples are extracted by the consistency test into a temporary folder and typechecked against
   `src/index.ts` (a `.ts` file per example).
8. **Craft references:** `story.md`, `scenes.md`, `direction.md`, `comments.md`, `sound-design.md`, `shots.md`
   (decision 008). Each shot recipe is a typechecked fragment, checked like step 7. No flag or option outside
   `language.md`.
   → check: a test lists every `--flag` and every context word used in `plugin/**` and fails on one not in
   `src/cli.ts`'s `USAGE` or `src/index.ts`.
9. **`exploring.md`, `screening.md`, `troubleshooting.md`.**
10. **The three skills:** `plugin/skills/{reel,reshoot,screening}/SKILL.md` (decision 007), each with a description
    whose triggers don't overlap, steps naming the references they load, and the stopping point. `reshoot` keeps
    `<name>.reel.before/` by copying and verifying.
11. **`preflight.mjs`** (decision 009), tests first in `test/unit/plugin-helpers.test.ts` with fake `docker`/
    `podman` executables on `PATH` and a local HTTP server: missing engine, daemon down, image absent (no pull is
    attempted), version out of range, URL unreachable or redirecting, a path with spaces, `--json`.
12. **`stills.mjs`**, tests first: a reel fixture made once by the e2e run (or a tiny generated MP4 with a matching
    transcript and manifest), stills and contact sheet for each step, `verify` failing stops it, a broken video →
    1, no ffmpeg → 2, `--to` inside the reel refused, no image pull attempted.
13. **Templates and sample:** `plugin/assets/{brief.md,script.ts,handoff.md}`, `plugin/examples/saved-views/`.
    → check: `test/e2e/plugin.test.ts` composes the sample script with the candidate image (reusing `image.ts`),
    then `flow-reel verify` and `stills.mjs` on the reel pass.
14. **Agent trial:** a fresh Claude Code session with only the packaged `plugin/` installed (from a local copy), in
    a temporary folder holding the served sample app, given "make a short reel showing how to save a view". Record
    the client version, what it ran, the script it wrote, the verify and stills results, and the scenarios from
    `skill-suite.md` that ran. Not a role-play: an actual session.
    → check: the reel exists and verifies; the script uses comments, a sound and an effect; the notes are added
    to this ticket.
15. PR (after a yes): title `feat: add the flow-reel agent plugin with reel, reshoot and screening (#6)`, body
    `Part of #6`, no line starting with `word(`. Squash-merge after CI; then a release PR for `flow-reel-plugin`
    0.1.0 only; merge it (after a separate yes).
    → check: tag `flow-reel-plugin-v0.1.0`, both manifests say 0.1.0, no `publish.yml` run, no npm or image release.

### Pull request 3: the listing (`codeonym-oss/claude-plugins`)

16. Follow `publishing.md`: add `flow-reel` to `.claude-plugin/marketplace.json` and `.agents/plugins/
    marketplace.json` with `git-subdir` sources, re-reading both clients' source docs first. PR after a yes, with
    links to the release and the trial notes; `Closes codeonym-oss/flow-reel#6` isn't possible across
    repositories, so #6 is closed by hand after the checks below.
    → check: both JSON files validate; in Claude Code, `/plugin marketplace add codeonym-oss/claude-plugins` and
    `/plugin install flow-reel@codeonym-oss` show the three skills and their references resolve; Codex the same where
    available, otherwise the gap is stated. Then close #6 (Done on board 6) and set this ticket `done`.

## Tests

- Unit (`plugin.test.ts`): manifests, skill list, links from a copy of `plugin/` alone, the range against
  `package.json`, no plugin files in the npm package, every flag and word used exists, examples typecheck.
- Unit (`plugin-helpers.test.ts`): both helpers at their process and filesystem boundaries, with fake engines and a
  local server; nothing installed, pulled or started.
- E2E (`plugin.test.ts`): the sample composes with the candidate image; verify and stills pass on its reel.
- Release: a dry run of each component; the plugin release runs no publish.
- Agent: one real fresh-session trial, written up.

## Risks

- **release-please with two packages:** the root package must not take plugin commits, and the publish condition
  must read only the root release. Both are checked by dry run in pull request 1, before any content depends on it.
- **Drift between plugin and runtime:** the range test (decision 010) and the flags-and-words test catch the
  mechanical part; editorial advice about timings (650 ms, 2 s, 800 ms, 4/3) is checked against `src/composer/
  polish.ts` by hand in review.
- **Typechecking examples** needs `flow-reel` resolvable from the temporary folder; the test points it at `src/
  index.ts` through `paths`, without publishing.
- **The trial depends on the client** and its browser tool; what it couldn't do is written down, not smoothed over.
- **The composer image is ~7 GB:** the e2e sample reuses the image the e2e run already builds.
- **Not changed:** `docker/sfx/` and `assembleSfx` keep the old word (internal); no runtime source changes in this
  ticket. Anything the agent trial shows missing from the composer becomes a follow-up, not part of GH-6.
