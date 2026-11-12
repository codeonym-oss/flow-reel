# 006: A restrained, narration-first sound mix

**Partly superseded by 008** (sound palette and calibration levels following listening feedback).

**Date:** 2026-11-11 (ticket pass, Q5; asked: "engineer this as a expert in SFX, what will they shouse for such a mixture?"; agreed to the concrete proposed preset: "ok")

**Question:** how prominent should effects be, and how should they coexist with speech?

**Decision:** **use a coordinated, restrained UI sound palette with speech dominant.**

- Short, soft tactile clicks; quieter typing taps with three similar variants in a deterministic sequence.
- Light paired open/close/back sounds, distinct toggle/select ticks, a warm brief success cue, a muted descending error cue and a gentle notification chime.
- Retain the existing voiced-delivery target of -16 LUFS and -1.5 dBTP true-peak ceiling; preserve original narration clips and hashes.
- Start clicks/action cues roughly 12–18 dB below active narration, with typing quieter. Treat these as calibration targets, verify with defined measurements and listening beneath actual narration; these are product starting settings, not a universal audio standard.
- Duck the combined SFX bus by another 6 dB during narration with 30 ms fade-down and 250 ms recovery. Select a deterministic envelope against known narration clip intervals during implementation; do not pump effects up between syllables.
- An explicit cue replaces a nearby automatic click, so one action does not produce competing sounds. The exact proximity window must be specified in the plan and regression-tested; it never removes the visual ripple or click event.
- When narration stops, return to the restrained normal SFX level. SFX-only demos keep that level rather than being normalized up to speech loudness.

**Sources checked:** [Microsoft audio cue guidance](https://blogs.windows.com/windowsdeveloper/2016/08/09/polishing-your-app-with-animations-and-audio-cues/) supports restrained, intentional use; [FFmpeg audio filters](https://ffmpeg.org/ffmpeg-filters.html#Audio-Filters) document available processing. Numerical settings above are this project's proposed preset, to tune against playback evidence.

- **Not chosen:** prominent effects competing with speech, random typing selection, or whole-track normalization that raises isolated clicks to narration loudness.
