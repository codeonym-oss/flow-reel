# SFX audition library

Open [the searchable sound browser](index.html). Use the volume slider and play buttons; playback stops the previous sound.

Downloaded on 2026-11-11: **152 OGG files, 1,447,457 bytes** (includes the UI pack preview). Creator: **Kenney**. Both included licence files declare **CC0**. Original audio files are preserved, with SHA-256 hashes in `manifest.json`. Licence text is retained with LF line endings and trailing whitespace removed.

Official sources:
- https://kenney.nl/assets/interface-sounds
- https://kenney.nl/assets/ui-audio

Retrieval: the official ZIP URLs returned HTTP 403. Downloaded the public mirror https://github.com/GeorgeQLe/assets-sfx-ui at revision `760afd035e8fc3cd7fb5bc58d49a967649875e3e`. Its included licences agree with the official source pages. The mirror bytes have not been compared against an original ZIP.

## Candidate palette

| Action | Candidates to audition |
| --- | --- |
| Click / mouse | `click_001`–`click_005`, `click1`–`click5`, `mouseclick1`, `mouserelease1` |
| Typing | Short `tick_*` or `switch*` sounds; audition for fatigue in repeated sequences. These are UI taps, not recorded keyboard keystrokes. |
| Toggle / checkbox | `toggle_*`, `switch_*` |
| Hover / select | `rollover*`, `select_*` |
| Open / close / back | `open_*`, `close_*`, `back_*` |
| Expand / collapse | `maximize_*`, `minimize_*` |
| Success | `confirmation_*` |
| Error / warning | `error_*` |
| Notification / question | `question_*`, `bong_001` |
| Scroll / drop | `scroll_*`, `drop_*` |
| Decorative accents | `glass_*`, `glitch_*`, `pluck_*`, `scratch_*` |

Professional direction to audition: a short click, a quieter typing tap, and restrained confirmation/error cues from one family. Avoid sounding every pointer movement or layering several cues on one action. Final defaults require listening in repetition and beneath narration.

## GH-8 scope

The broad library is for selection. GH-8 now includes automatic click/per-character typing sounds, eight explicit named cues (`success`, `error`, `notification`, `open`, `close`, `toggle`, `back`, `select`) and `--no-sfx`. Decisions 003–007 supersede the initial click/typing-only scope. The implementation will add explicit cue events; it will not infer semantic actions automatically or ship the entire audition library in the runtime package.

Verification: all 152 files decoded successfully with FFmpeg; SHA-256 hashes match the manifest. The player script passed a JavaScript syntax check. Sound quality and final defaults still need listening approval.

## Revised runtime palette

After listening, the person found the first Kenney selection too low and generic. Decision 008 records a smoother DAEDAL-based selection and ~6 dB stronger starting presence. [DAEDAL source archive and licence evidence](daedal/SOURCE.md) are retained here; runtime derivation recipes and hashes are in `docker/sfx/manifest.json`. The original Kenney browser above remains an audition library, not the final shipped palette. The revised narrated preview and palette were approved on 2026-11-11: “Yes — this sound selection and mix feel good.”
