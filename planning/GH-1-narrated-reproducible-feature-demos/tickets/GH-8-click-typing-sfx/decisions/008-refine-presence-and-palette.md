# 008: Refine the palette and increase its presence after listening

**Date:** 2026-11-11 (implementation playback feedback; asked: “wel, its working and all, just the sounds, they are a bit low and generic, i need the smooth premium feel! (if possible)”).

**Partly supersedes 006** (palette and starting gains); speech priority, duck timing, deterministic variation and no video extension remain.

**Decision:** **revise the sound selection toward a smoother, more distinctive coordinated palette and make effects more audible.** The initial Kenney selection/mix was functional but not approved aesthetically. Audition a second CC0 web-sourced palette from DAEDAL, soften transients and shape tonal tails. Raise starting effects approximately 6 dB from the first preview (click/action calibration -12 dB relative to active speech RMS, typing -18 dB, SFX bus sample-peak cap -18 dBFS); retain the additional -6 dB narration duck. These are implementation starting values, to verify with another narrated preview rather than call “premium” on measurements alone.

- **Why:** explicit listening feedback says the first sounds are too low and generic.
- **Not chosen:** approving the initial preview unchanged, or simply making harsh/generic sounds louder.
- **Evidence:** https://daedal.art/resources/ui-sounds/ and the included CC0 licence; downloaded official release asset from https://github.com/luciansofronie/daedal-downloads/releases/download/packs-v1/DAEDAL_UI_Sounds.zip . Preserve source archive, hashes and transformations before shipping derived files. Listening approval remains pending.
