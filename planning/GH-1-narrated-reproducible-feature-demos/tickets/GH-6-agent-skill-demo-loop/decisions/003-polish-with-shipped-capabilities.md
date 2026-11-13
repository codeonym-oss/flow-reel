# 003: Premium demos come from editorial control over shipped capabilities

**Date:** 2026-11-13 (requested: "creating fancy demos using our tool"; implementation choice within the user's delegated approval)

**Question:** add new rendering features, or teach agents to direct the existing tool well?

**Decision:** teach audience-first storytelling, deliberate scene composition, short benefit-led narration, meaningful result states, concise typing, restrained SFX and feedback-driven revision using the actual API. Support reviewer evidence, product walkthrough and tutorial briefs as editorial starting points rather than renderer presets.

Document the current automatic 650 ms zoom-in, 2-second activity hold, 800 ms zoom-out and 4/3 zoom ceiling as capabilities/constraints, not script settings. Only `url` and `viewport` are public demo options today; CLI recording offers `--no-sfx`. An agent must not invent duration, camera, voice, music or export flags.

Plan a visible opening state, a demonstrated change and a readable payoff. Place explicit cues after their observed result; keep automatic click/typing sounds unless the brief calls for muting. Duration is a measured result of narration, actions and holds; editorial duration estimates are not precise timing guarantees.

- **Not chosen:** intro/outro cards, background music, custom zoom tracks, alternate TTS voices, portrait-export promises, arbitrary pre-recorded audio, app redesign, or PR delivery. These need separate product work.
