# Teach agents to create polished demos with a complete flow-reel skill suite

## Problem

The recorder, offline narration, automatic camera/cursor polish and SFX are shipped, but an agent still needs to
turn a feature request into a compelling, truthful and reproducible demo. A single command reference does not
teach story selection, real app exploration, narration, pacing, result verification or feedback-driven repair.

## Change

Ship one `flow-reel` plugin with eight focused skills:

- `demo`: route and complete an end-to-end demo request, resuming from existing work.
- `plan-demo`: choose the audience, takeaway, opening/action/payoff and a concise narrated beat plan.
- `explore-app`: inspect the actual UI and record reliable locators, starting state and visible results.
- `write-demo`: turn observed behavior into a replayable TypeScript script using the public API.
- `polish-demo`: improve narration, pacing, framing and SFX using the capabilities already shipped.
- `record-demo`: check prerequisites, select a runtime version, record and preserve useful takes.
- `review-demo`: inspect the real artifacts, review playback and distinguish each kind of verification.
- `repair-demo`: diagnose concrete feedback, revise the affected beats and verify the new take.

Support the skills with shared workflow/API/editorial/quality/troubleshooting references, brief/script/review/
handoff templates, three deterministic Node helpers and a runnable local sample. Helpers cover preflight,
artifact inspection and preserving a take; they do not implement a second renderer or browser framework.

Follow groundwork's inspected manifests (`.claude-plugin/plugin.json` and portable `plugin.json`) inside a
`plugin/` folder, released as its own release-please component so skill changes never cut a runtime release
(decision 005). Publish through both Claude and Codex catalogs in `codeonym-oss/claude-plugins` with `git-subdir`
sources, so clients install only `plugin/`. Keep the runtime in npm/image and agent guidance in `plugin/`.

## Out of scope

New camera/voice/music/export options, intro/outro cards, burned-in captions, a recording MCP server or hosted
service, app redesign, paid assets, PR delivery, and dedicated integrations for other agents. Plain skill text is
portable, but unsupported clients are not claimed as tested.

## Done when

- All eight skills are discoverable and their shared resources resolve from an installed plugin location without
  access to the development checkout, planning tree or dev dependencies.
- A fresh supported agent session explores the sample app, writes and records a meaningful narrated demo, inspects
  the actual MP4/captions/transcript/events/audio and returns the script plus a concrete rerun command.
- Examples use the actual public API and supported flags. Instructions distinguish observed app behavior from
  guesses, wait for meaningful outcomes and never invent adjustable camera/voice controls.
- Preflight reports missing prerequisites without silently changing the machine. Artifact inspection detects
  corrupt/missing media and reuses public sync semantics. Snapshotting preserves complete take bytes/relative
  paths and refuses conflicting destinations.
- Automated helpers and plugin consistency are tested with meaningful fixtures. The shipped example records
  through an existing matching image; playback/agent-evaluation evidence is recorded separately from file checks.
- Same-platform two-take comparison is demonstrated when making a repeatability claim. Self-comparison, valid
  metadata or matching source WAVs are not described as proof of perceptual quality or encoded MP4 identity.
- Both manifests track the plugin component's version through release-please; a plugin release triggers no image
  or npm publication, and runtime releases leave the plugin version alone. The suite release and both marketplace entries
  are verified, with real clean-client installation checks where clients are available and explicit gaps otherwise.
- Existing unit/type/package/media checks remain green; no unrelated runtime feature is added.

## Breakdown and evidence

- [Skill inventory, resources, helper contracts and evaluation scenarios](skill-suite.md)
- [Implementation slices, checks and risks](impl.md)
- [Groundwork publishing research and cross-repository delivery](publishing.md)
- Decisions 001–004 record the expanded scope and packaging choices. Inherited GH-1 decisions still apply.

Planning baseline, 2026-11-13: 86 unit tests and type checking pass outside the sandbox; the three initial
subprocess failures are sandbox EPERM restrictions, not code failures. GH-9's native media and registry consumers
have already passed. This ticket is planned; the skill suite itself has not been implemented or published yet.
