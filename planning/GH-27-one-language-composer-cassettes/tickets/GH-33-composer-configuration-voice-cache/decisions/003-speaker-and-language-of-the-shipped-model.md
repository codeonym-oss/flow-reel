# 003: A second local voice is another speaker or language of the shipped model

**Date:** 2026-11-14 (ticket pass, Q3; agreed: "ok")

**Question:** how is a second local voice offered?

**Decision:** **the `qwen3-tts-0.6b` voice takes a speaker and a language from the shipped model's own lists.**

```json
{ "voice": { "adapter": "qwen3-tts-0.6b", "speaker": "Aiden", "language": "english" } }
```

- Flags `--speaker` and `--language`; defaults `Ryan` and `english`, as today.
- Speakers: Aiden, Dylan, Eric, Ono_Anna, Ryan, Serena, Sohee, Uncle_Fu, Vivian. Languages: chinese, english,
  french, german, italian, japanese, korean, portuguese, russian, spanish (model revision `85e237c`). An unknown value
  fails with the list of known ones.
- The seed stays 0 and is not configurable.
- The transcript's `voice` gains `language`; speaker and language are part of the cache key (decision 002).

- **Why:** a real choice of voice at no cost to the image; the values are checked against the model's own lists; a
  cloud voice later is another `adapter` with its own settings.
- **Not chosen:** speaker only (no way to narrate in another language, and a second schema change later); a second
  model (about 3.5 GB more on a 6.9 GB image).
