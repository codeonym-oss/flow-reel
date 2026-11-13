# GH-6 implementation plan

Baseline tests: main `691069a` (0.1.0 runtime), 2026-11-13. Release PR #19 then merged as `79837ca`, changing
only release metadata to 0.1.1; use that current runtime version when implementation starts. All 86 unit tests and type checking pass outside the sandbox. The initial
sandbox run failed three subprocess-dependent tests with EPERM; the same unchanged tests pass when permitted.
No heavy media baseline was repeated just for this planning pass; GH-9's latest native suites/consumers passed.

## Read first

- This ticket's decisions 001–004, `skill-suite.md`, `publishing.md` and inherited GH-1 decisions.
- `src/index.ts`: only public authoring API (`demo`, `url`, `viewport`, `page`, `step`, `sfx`).
- `src/cli.ts`, `src/host/launch.ts`: actual commands/exit codes, matching image, script-folder mount and network mapping.
- `src/runner/wrap.ts`, `run.ts`, `load.ts`: supported visible actions, explicit UI waits, script loading/import limits.
- `src/runner/polish.ts`, SFX modules and `docker/sfx/README.md`: current automatic motion and sound contracts.
- `src/schema/{transcript,events,sync}.ts`, `src/compare.ts`: schema compatibility, speech tail and comparison limits.
- `scripts/consumer.ts`, `test/e2e/image.ts`, existing record/media tests: reusable real-consumer/image checks.
- `.github/workflows/{ci,publish,release-please}.yml`, `release-please-config.json`, `scripts/package.ts`.
- The pinned groundwork/marketplace files listed in `publishing.md`, re-read at implementation time for drift.

## Delivery breakdown

One coordinated GH-6 outcome can use multiple reviewable PRs, all linked `Part of #6` until final verification.
Do not create extra tracker issues or relabel GH-1 merely to mirror document sections. The marketplace change is
a separate repository PR. If implementation finds a separately useful product feature, plan it separately.

### 1. Package a minimal usable demo workflow

Add the two plugin manifests, a concise `demo` entry point, the shared workflow/API references and the local sample
app/script. Keep the runtime implementation untouched. Add the two JSON version fields to the existing Node
release-please package configuration; do not manually advance a published package version.

→ Check: first add failing repository-consistency tests for mismatched versions, missing declared skills, broken
resource links and invalid portable onboarding paths. Make them pass with actual files. Copy only plugin runtime
resources into a temporary installation and resolve its references there, without a checkout or `planning/`.
Check the npm package allowlist still excludes plugin assets and model weights. Check release-please updates both
plugin versions with package/lock metadata in the same release PR.

### 2. Teach planning, exploration and scripting

Add `plan-demo`, `explore-app`, `write-demo`, their selected references and brief/script templates. The brief records
audience, payoff, approximate time budget, runtime version and observed route. Teach real locator discovery and
visible-result waits. Document that exploration cookies/storage are not automatically transferred to the fresh
runner and that only the script folder is mounted; account-dependent demos need a supported replayable setup.

→ Check: exercise the instructions against the local sample app using an available browser tool. Produce a script
that reaches the actual expected states and imports only public API/same-folder resources. Typecheck the example
against the selected runtime API and run it through the existing recording path. Do not test wording with regexes.

### 3. Teach visual, narration and sound direction

Add `polish-demo`, storytelling/narration/visual/sound references and the useful review/handoff templates. Include
concrete before/after editorial examples: a long form fill shortened to readable input, a result awaited before
success, a paragraph split into two meaningful beats, and repeated cues reduced to a single semantic cue.

→ Check: a realistic revision scenario improves the intended beat while preserving unrelated app actions. The
script uses only shipped options/cues, does not fabricate camera controls or new voices, and waits for the result
described in narration. Replay the reference example and inspect/listen to its full payoff. If playback cannot be
performed, record that gap and request focused human review instead of claiming premium quality by inspection.

### 4. Add and test the three deterministic helpers

Implement `scripts/agent/preflight.mjs`, `inspect-recording.mjs` and `snapshot-take.mjs` to the contracts in
`skill-suite.md`. Keep each helper independent of dev dependencies; share code only for substantial duplicated
mechanics. Use the public compare CLI for transcript semantics rather than exposing or copying private validators.
Resolve bundle-relative references safely and reject references that escape the bundle when preserving a take.

→ Check: write red-to-green tests at the external process/filesystem boundaries. Cover missing engine/daemon,
unreachable app, invalid URL/version, spaces in paths, no side-effectful setup during preflight, explicit package
selection, absent/corrupt WAVs, mismatched hashes, absent captions/video, invalid sync, known event versions and
unsupported versions, ffprobe stream/duration failures, unavailable probe, valid blank narration and preservation
of bytes/relative paths. Snapshot tests cover existing destination, missing source and out-of-bundle references;
an unsuccessful snapshot must not be presented as a completed take. Use fixture tools only to isolate tool
availability; confirm actual subprocess behavior once with a real recorded sample.

### 5. Close the record/review/repair loop

Add `record-demo`, `review-demo`, `repair-demo`, troubleshooting and quality-review references. Route from `demo`
according to current artifacts. Record with a selected package/image version; preserve a baseline before reruns
when comparison matters. Distinguish valid media, app correctness, perceptual quality and reproducibility.
Keep retries evidence-driven: do not replay a state-changing scenario repeatedly without a reset plan.

→ Check: the packaged plugin's example records a complete narrated MP4 with captions and inspectable artifacts
using the existing prebuilt image support. Inspect the actual bundle. Preserve two takes on the same platform and
run public comparison; explain what a mismatch means. Run the scenarios in `skill-suite.md` with special attention
to stale output after a failed run and authenticated apps without reusable setup. No silent success on old files.

### 6. Validate the installed agent experience

Add light repository/helper checks to ordinary CI and a focused shipped-example check to the native media path,
reusing the existing built/candidate image rather than starting another independent build. Confirm resources are
available from plugin-cache paths and the npm tarball has no newly required plugin files.

→ Check: `npm test`, `npm run typecheck`, package verification and workflow linting pass. Run each helper with
`--help` from the minimal plugin copy. Use a fresh supported agent session on the local sample, supplying the
request and installed plugin without feeding it the intended solution. Evaluate the generated script/artifacts
and resulting choices, not just its prose. Document client/version/tool access and which scenarios actually ran.
An independent evaluating agent is appropriate when available and authorized; do not substitute a role-play of
the agent's answer for execution. Scope any such trial to the local example and temporary output directories.

### 7. Publish the verified suite through the existing marketplace

Follow `publishing.md`: reviewed flow-reel PR(s), normal feature release with synchronized plugin/runtime versions,
then a separate PR adding flow-reel to both organization catalogs. Document install/update paths and a complete
example invocation. Preserve the existing catalogs and plugin entries.

→ Check: released manifests agree with npm/package version and all resource paths exist in the installable source.
Both catalogs validate and point to flow-reel. Perform actual clean-client installs where available; in each
verified client, discover all eight skills and run the main workflow against the sample. Report any unavailable
client/platform check explicitly. Close GH-6 only after the agreed deliverables and publication evidence exist;
GH-1 can then be evaluated for completion rather than closed early.

## Scope and risks

- **Eight skills can become repetitive.** Keep entry points short, use focused trigger descriptions and central
  facts in shared references. A rich suite means useful capabilities, not a large default prompt.
- **Plugin and runtime may update independently on a user's machine.** Record a selected version and use only
  supported API/flags. Explain mismatches before recording rather than silently changing the project dependency.
- **The recording container has a fresh browser and limited mounts.** Do not assume a human login, an agent's
  exploration session, parent-folder imports or arbitrary host paths are available inside it.
- **A good report is not a good demo.** Mechanical checks must open the real artifacts, and visual/audio quality
  needs playback. Do not manufacture a passing review from transcript metadata.
- **Runtime controls are intentionally limited.** No new voice/camera/export options, rendering features, hosted
  service, MCP server, PR posting or paid asset dependency is part of this ticket.
- **Documentation is code-adjacent.** Keep examples typechecked/executed and version/schema claims checked against
  source; examples must reflect the shipped 1440p master, event schema 2 and transcript schema 1.
- **Publication spans repositories and services.** Record exact release/PR links and install evidence. Do not
  replace existing tags or republish conflicting versions to get a green status.
