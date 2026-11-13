# GH-6: Demo-making skill suite

## Product outcome

A request such as “make a polished demo of the new saved views feature for a customer” produces a deliberate,
truthful narrated walkthrough, not an unedited screen capture. The agent explores the actual application, writes
a replayable script, records through flow-reel, checks the resulting files and playback, and hands over the MP4,
captions and reproducible source with an honest statement of what was verified.

The plugin is called `flow-reel`. Its eight skills share one set of references and helpers. The `demo` entry point
runs the whole loop; each specialist also works on an existing brief, script or take without requiring a restart.
Skills remain ordinary Markdown and small local helpers, without a new orchestration service or mandatory MCP.

## Skill responsibilities

| Skill | Use it for | Inputs | Concrete output and stopping point |
|---|---|---|---|
| `demo` | “Show this feature”, “make a product demo”, complete end-to-end requests | User goal, app access, existing project conventions | Routes the needed specialists; returns a checked demo bundle and remaining review notes. Resumes from existing artifacts rather than redoing completed work. |
| `plan-demo` | Choose the audience, story, scope and narration before scripting | Feature goal, audience, desired takeaway, approximate time budget | A compact brief with an opening state, beats, payoff and a narration draft. Ask only for consequential unknowns; label unverified feature assumptions for exploration. |
| `explore-app` | Discover a real, repeatable path through the running UI | Brief, app URL, available browser tool | A route map: accessible locators, starting state, expected visible outcomes, relevant loading behavior and reset requirements. Do not invent selectors or treat a screenshot as proof of an action. |
| `write-demo` | Turn the verified route into a deterministic TypeScript demo | Brief, observed route, selected runtime version | A self-contained `demo.ts` with one `step(narration, action)` per beat, explicit outcome waits and restrained semantic cues. Valid imports and erasable TypeScript; no execution of a guessed workflow. |
| `polish-demo` | Improve pacing, framing, narration or sound in an existing script | Script, brief, current preview/feedback if available | A focused revision using shipped behavior: concise text, supported pointer actions, readable results and purposeful SFX. It identifies renderer feature requests instead of inventing flags. |
| `record-demo` | Check prerequisites, record, and preserve useful takes | App URL, script, selected flow-reel version | Preflight report, recording exit status, output paths and a preserved take when requested. Diagnose failures before retrying; never hide a failed recording behind an older MP4. |
| `review-demo` | Assess correctness, media integrity, pacing and reproducibility | Recorded bundle, brief, optional second take | Automated inspection report plus editorial/playback findings. Separate file/sync checks, same-platform reproducibility and perceptual quality; do not conflate their evidence. |
| `repair-demo` | “The zoom is rushed”, “the voice cut off”, “update this demo” | Existing script/take, concrete feedback, changed UI | Diagnose the smallest relevant cause, preserve a baseline, revise only the affected beats and re-record/review. Stop when acceptance criteria pass or name the precise external blocker. |

Each skill description should distinguish these triggers. `demo` routes to relevant specialists and references;
it does not load the entire library on every invocation. The skills must still be usable when the client cannot
programmatically invoke another skill: read its instructions and perform the relevant procedure.

## A polished demo, in practical terms

1. **A clear story.** Open at a useful context, demonstrate a meaningful change, finish with its visible benefit.
   Prefer one coherent task over a tour of unrelated controls. A reviewer needs evidence; a customer needs the
   outcome; a tutorial needs enough context to repeat the workflow.
2. **Intentional screen composition.** Use an appropriate supported landscape viewport, short realistic fixture
   text and stable starting data. Dismiss irrelevant overlays through actual UI actions where appropriate.
   Keep important UI visible before clicking; automatic camera bounds are captured before the action.
3. **Narration earns its time.** One short idea per beat; explain the user-visible value rather than reading every
   pointer movement. Use concrete nouns and speakable text. Align narration with its action and await the payoff
   before returning from that step. Split long paragraphs rather than forcing an exact word count.
4. **Pacing is measured.** A short product walkthrough might target roughly 30–60 seconds and a tutorial longer,
   but these are editorial suggestions. Check the synthesized duration. Avoid long typing passages and arbitrary
   sleep chains. A deliberate reading pause is appropriate when the visible information needs it; it is not a
   substitute for waiting for a real UI state.
5. **Use the automatic motion well.** Supported clicks, hovers, fills, checks and scrolling produce intentional
   input motion. Click zoom is automatic: 650 ms in, activity extends the hold by 2 seconds, 800 ms out, maximum
   about 1.33×. These timings cannot be configured through the public script API. Extra clicks to “trigger zoom”
   are not an editorial control and can change application behavior.
6. **Sound supports the result.** Automatic clicks and typing are already mixed beneath narration. Explicit
   `success`, `error`, `notification`, `open`, `close`, `toggle`, `back`, or `select` cues mark meaningful observed
   states. Place them after the corresponding state wait; do not play a success cue merely because a request was
   sent. Avoid cue stacking. Use `--no-sfx` for a deliberately quieter version.
7. **Review the actual result.** Inspect more than the first frame. Check transitions and final payoff, listen to
   whole narration lines, and confirm that the target remains visible through the zoom. If playback tools are
   unavailable, request human playback and report that perceptual review remains pending.

The guide must not promise cards, music, editable zoom tracks, voice selection, burned-in captions, exact duration,
portrait output presets, or live agent capture. Those are not shipped capabilities. The default master is 1440p
with a sharp 1080p delivery; old story examples referring to a 4K master are not the current contract.

## Planned repository layout

```text
.claude-plugin/plugin.json
plugin.json
skills/
  demo/SKILL.md
  plan-demo/SKILL.md
  explore-app/SKILL.md
  write-demo/SKILL.md
  polish-demo/SKILL.md
  record-demo/SKILL.md
  review-demo/SKILL.md
  repair-demo/SKILL.md
references/
  workflow.md
  demo-api.md
  app-exploration.md
  storytelling.md
  narration.md
  visual-direction.md
  sound-direction.md
  quality-review.md
  troubleshooting.md
  publishing-and-installation.md
scripts/agent/
  preflight.mjs
  inspect-recording.mjs
  snapshot-take.mjs
assets/demo/
  brief.md
  demo.ts
  review.md
  handoff.md
examples/agent-demo/
  index.html
  demo.ts
  brief.md
  README.md
test/unit/agent-plugin.test.ts
test/unit/agent-helpers.test.ts
test/e2e/agent-plugin.test.ts
test/agent-scenarios/
  scenarios.md
```

This is the intended useful inventory, not a requirement to generate empty scaffolding. Keep resource names and
links synchronized if implementation finds a simpler organization. Shared resources are reached relative to the
loaded skill's installed directory, never a developer's absolute checkout or plugin-cache path. Do not require
Claude-specific environment variables to find shared files in Codex. Per-skill `agents/openai.yaml` is only needed
if client validation shows that the portable root manifest is insufficient; do not duplicate UI metadata by default.

## References and when to load them

| Reference | Needed content | Consumers |
|---|---|---|
| `workflow.md` | Phase routing, resumable artifacts, version selection, capability boundaries, handoff contract | `demo`, `repair-demo` |
| `demo-api.md` | Exact imports/options/context, supported wrapped actions, `.waitFor()` examples, local-file import boundary, real commands and output stems | `write-demo`, `record-demo`, `repair-demo` |
| `app-exploration.md` | Tool discovery, real navigation/locator evidence, asynchronous outcomes, starting state, auth limits and fixture/reset decisions | `explore-app` |
| `storytelling.md` | Reviewer, product and tutorial briefs; opening/action/payoff; what to cut; beat table with expected outcomes | `plan-demo`, `polish-demo` |
| `narration.md` | Benefit-led copy, one idea per step, pronunciation-friendly text, narration starts with action, split/shorten based on actual clips | `plan-demo`, `write-demo`, `polish-demo` |
| `visual-direction.md` | Supported pointer actions, current camera behavior, pre-action bounds, scrolling, input length, visible result states and limits | `polish-demo`, `review-demo` |
| `sound-direction.md` | Automatic taps, eight cues, when to place/omit each, narration-first mix, explicit cue replacement and `--no-sfx` | `polish-demo`, `review-demo` |
| `quality-review.md` | Mechanical inspection, editorial rubric, perceptual checks, two-take comparison and its limits | `review-demo` |
| `troubleshooting.md` | Diagnose startup, URLs/network, authentication, selectors, hangs, CPU overload, speech, cropping, cue placement and stale output | `record-demo`, `repair-demo` |
| `publishing-and-installation.md` | Supported install routes, version compatibility, plugin update vs runtime update, optional browser tools | Setup and release tasks only |

Keep exact API facts in `demo-api.md`, not repeated in every skill. Behavioral examples should import only public
`flow-reel` and same-folder helpers. Do not teach `@playwright/test` imports, internal package subpaths or unshipped
commands such as `flow-reel validate`, `init`, `doctor`, `--voice`, `--duration`, or `--zoom`.

## Three helper contracts

All helpers use Node standard modules, argv arrays for subprocesses, bounded operations and clear text/JSON reports.
They run from an installed plugin directory without its development dependencies or access to `planning/`.
Paths containing spaces must work. They accept an explicit runtime version; avoid silently selecting npm `latest`.
Exit codes: 0 means required automated checks pass; 1 means a check failed; 2 means invalid input or a prerequisite
is unavailable. Report optional/unperformed checks explicitly; never turn an omitted check into a success claim.

### `preflight.mjs`

Proposed invocation: `node <plugin>/scripts/agent/preflight.mjs --url URL --version VERSION [--script FILE] [--json]`.

- Check Node >=22.18, availability of npm, an installed Docker/Podman engine and a reachable engine daemon.
- Validate the supplied script exists when provided, the selected version is explicit and the app URL is reachable
  with a short timeout. Preserve useful HTTP status information; an auth redirect is not proof of ready app state.
- Inspect the matching local image and platform when present; report a missing image and the explicit pull command.
  Do not pull, build, install tools, start/stop the app, or change daemon configuration as a hidden check.
- Report known operational expectations: large first image pull, CPU/memory-intensive local speech, host networking
  on Linux and Docker Desktop mapping with platform testing limits. Detect facts; do not invent a universal CPU
  availability score or replace the recorder's existing overload guard.

### `inspect-recording.mjs`

Proposed invocation: `node <plugin>/scripts/agent/inspect-recording.mjs FILE.transcript.json --version VERSION [--json]`.

- Invoke version-selected `flow-reel compare FILE FILE` to reuse public transcript/schema/sync checks. Use explicit
  `npx --yes --package flow-reel@VERSION flow-reel ...` or a verified matching local executable so a same-named
  enclosing checkout cannot masquerade as the registry package.
- Open the referenced video, expected caption/event sidecars and narrated audio files. Resolve them relative to
  the transcript directory. Recompute each WAV SHA-256 and compare it to the transcript; report missing, changed
  or empty artifacts. Handle blank narration and schema-v1/v2 event compatibility according to shipped contracts.
- Probe audio/video streams and duration with host `ffprobe` when available, or the already available matching
  recording image using an explicit `--entrypoint ffprobe` and a read-only mounted bundle. Do not pull/build a
  new image solely for an inspection. If neither probe is available, report the unmet required media check.
- Emit a concise result per category. File and sync checks do not prove UI correctness, listenability, final
  mixed-audio equality, identical encoded MP4 bytes or reproducibility. Playback remains a separate review.
- Only read the bundle. A failed inspection must not “repair” hashes, captions or timing metadata to make it pass.

### `snapshot-take.mjs`

Proposed invocation: `node <plugin>/scripts/agent/snapshot-take.mjs FILE.transcript.json --to NEW_DIRECTORY`.

- Preserve a complete take before recording over the script's generated outputs: transcript, MP4, SRT/VTT, events
  and referenced audio, keeping their relative paths and bytes intact. Exclude caches and multi-GB intermediates.
- Refuse an existing destination or a destination inside the source audio tree; validate paths before copying.
  Do not move or rename the source. Missing required files fail before a partial copy is published as a take.
- Write a small receipt containing the source, recording version/platform when verified, and preserved files.
  Missing historical platform/version evidence stays unknown rather than guessed.
- Comparing two preserved takes uses the existing `flow-reel compare` command and its exit codes (0 match, 1
  difference, 2 invalid). Same-platform speech comparison is supported; cross-architecture byte identity is not.

## Templates and example app

- **`brief.md`:** goal, audience, single takeaway, chosen runtime version, app URL, safe starting state, approximate
  duration, and a beat table containing action, observed locator, visible outcome, narration and optional cue.
  Mark observed facts separately from remaining assumptions. Keep this a compact editable document, not a new
  configuration language that every helper must parse.
- **`demo.ts`:** a commented minimal public-API starter with an explicit result wait before `sfx("success")`.
  Clearly identify app-specific locators to replace; do not present a template as an explored application.
- **`review.md`:** mechanical results, opening/payoff, framing/zoom, narration completeness, cue appropriateness,
  actual duration, playback status and concrete revision notes.
- **`handoff.md`:** local links to MP4/captions/source, selected version, exact rerun command, comparison result
  if performed, verification limitations and necessary fixture/reset instructions. Publishing/uploading is a
  separate user action, not an implied part of recording a demo.
- **`examples/agent-demo`:** a tiny self-contained local HTML app and a real runnable script showing a coherent
  create/select/save workflow with useful result states. No external fonts, services, accounts or data downloads.
  Include a simple documented serving command and a complete example brief. Keep it small enough to inspect.

## Behavioral evaluation

Test the suite against tasks, not whether a document contains a preferred heading:

| Scenario | Required observable behavior |
|---|---|
| Fresh product demo | Explore the local example, select real locators, write a script, record, inspect and hand over a narrated MP4/captions/source. |
| Existing script, rushed payoff | Preserve the first take, adjust only relevant narration/actions, verify the new result and explain measured timing. No invented zoom or duration option. |
| Changed locator or delayed save | Diagnose the observed UI change, wait for the actual result, then emit success; no selector guessing or blanket sleep increase. |
| Missing Docker or app unreachable | Report the exact unmet prerequisite and next command; do not install/start software as a read-only preflight side effect. |
| Authenticated app without replayable login | Explain that exploration session cookies do not automatically reach the fresh runner; choose an explicitly authorized fixture/public route or stop on the missing setup. |
| Corrupt/missing WAV or captions | Inspection fails rather than accepting transcript metadata alone or silently regenerating artifacts. |
| Invalid sync or differing takes | Preserve CLI exit semantics and diagnostics; report differences honestly. A self-comparison is never called a repeatability test. |
| No playback capability | Finish mechanical checks, request a focused playback review and label perceptual quality unverified. |
| Same-named source checkout | Explicit package selection/independent consumer avoids the GH-9 npm resolution failure. |
| Requested background music/custom camera | State the current capability boundary and offer achievable editorial changes without changing runtime source. |

Run manifest/link/helper checks cheaply in ordinary CI. Run the shipped example against an already-built candidate
image as a focused media check, reusing existing image preparation. Before publication, perform one fresh-session
agent trial with the packaged plugin in a clean client workspace and document what was actually executed.
