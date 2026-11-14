# 009: One word per concept; the command is `flow-reel compose`
**Superseded by 010** for the term Cassette, which is now Reel.

**Date:** 2026-11-14 (global pass, Q9; agreed: "ok")

**Question:** which words does the project use, in `CONTEXT.md`, the code, the docs and the plugin?

**Decision:** **the table below, one word per concept.**

| Term | Meaning | Replaces |
|---|---|---|
| Script | The file a person or agent writes: the E2E tool's script plus flow-reel words. | scenario, flow, demo |
| Step | One action in a script, with whatever is attached to it. | phase |
| Comment | A spoken line; becomes voice audio and a caption. | narration |
| Sound | A short sound effect placed at a moment. | audio, SFX |
| Effect | A change to the picture: flash, show frame, zoom. | visual effect, SFX |
| Composer | The image that compiles a script into a cassette; the verb is compose. | runner, recorder |
| Integration | The adapter for one E2E tool. | driver |
| Voice | The speech model that speaks comments. | TTS, transcription model |
| Cassette | The whole compiled result of one script. | output, take |
| Transcript | The timed text of the comments, inside the cassette. | |
| Plugin | The skills and references that teach an agent this language. | |

The script word for sounds is `sound`, not `audio`. The CLI command is `flow-reel compose <script>`; "recording"
names only the raw screen capture.

- **Why:** the person used several words for the same thing; "audio" also describes the voice track and the mix, so
  it would be ambiguous as a script word; the command follows the composer's verb.
- **Not chosen:** keeping `audio` as the script word; keeping `flow-reel record`.
