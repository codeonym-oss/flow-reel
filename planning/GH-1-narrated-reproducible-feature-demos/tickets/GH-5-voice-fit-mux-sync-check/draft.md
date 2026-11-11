# Hold each step for its voice clip, mux the audio, and check sync and reproducibility

## Problem

GH-4 records a silent video and generates separate narration clips. Speech can outlast its action window, and
users have no command to verify that recordings are synchronized and reproducible.

The current script API reveals narration when `step()` executes. Synthesizing everything before capture would
require another action pass or an API change. Qwen's CPU work must remain outside real-time capture.

## Change

- Execute actions once with the existing API. Capture first, synthesize afterward, then insert frame holds to fit
  narration into the recorded video (ticket decision 001). The UI is frozen during added holds.
- Start each clip with its step's action. Preserve action speed and actual callback completion in `actionEndMs`
  (decision 002).
- After each callback, use the existing bounded network-idle check (500 ms quiet, 10 s maximum), warn on timeout,
  and capture another 100 ms before choosing the held frame. Scripts still explicitly await their intended UI
  state (decision 003).
- Each step includes its captured action/settling window and at least its narration duration plus 200 ms from
  `startMs`. Existing captured time counts; add only necessary whole-frame holds, rounding upward. Blank narration
  gets no speech padding; all-blank demos retain silent-video behavior (decision 004).
- Shift transcript times, captions, events and the master used by later polish onto one final timeline. Retain
  schema version 1; original narration and source WAV bytes, durations and hashes stay intact.
- Assemble the clips at final step starts, normalize delivered voice to -16 LUFS with a -1.5 dBTP peak ceiling,
  and mux it into the MP4 (decision 005). Measure rendered output to verify the audio level and placement.
- Automatically check final recording sync. Add `flow-reel compare a.json b.json`, reading transcripts on the host
  without Docker, printing differences and returning nonzero on failure (decision 006).
- Compare step order, original narration, voice identity and audio metadata, with step starts within ±150 ms
  (story decision 009). Output/script paths do not establish a content difference. Comparison uses transcript
  data; it does not claim byte-identical MP4s or perceptual frame equality.

Decision 001 replaces this draft's earlier pre-capture synthesis proposal. Decision 006 makes a narrow exception
for host-side comparison to story decision 008; recording and rendering stay inside the image.

## Out of scope

Cursor/zoom polish, SFX, cloud adapters, voice changes, release publishing, PR delivery, a new script API, repeated
application actions, perceptual comparison and new rendering options. The existing odd-viewport/encoder-exit
follow-up and optional 4K master stay separate; this ticket takes up neither.

## Done when

- One `flow-reel record demo.ts` command writes a playable narrated MP4, SRT/VTT, transcript and matching events.
  Each application action runs once. Holds show the chosen settled frame at unchanged action playback speed.
- No narration overlaps another step; every voiced step has its 200 ms speech tail. Transcript, captions, events
  and the polish master agree with the final video timeline. Original source WAV hashes remain unchanged.
- The delivered voice meets the agreed loudness/peak targets under explicit measurement tolerances. Blank-only
  demos remain valid and silent. Invalid rendering/sync fails the command before a new success transcript is written.
- The comparison command reports valid matching runs as equal, identifies content/timing differences, rejects
  invalid input, and works without Docker. The sample pair matches under the ±150 ms rule.
- Automated media checks verify frame holds, decoded audio placement and real output streams. Sample narrated
  playback is inspected/listened to; unit tests, type checking, build and the full Docker E2E suite pass.
