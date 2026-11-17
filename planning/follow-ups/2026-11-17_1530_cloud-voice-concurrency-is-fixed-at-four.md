---
status: open
from: person
found-while: GH-76
resolved-by:
---

# A cloud voice always sends four requests at once, whatever the account allows

`cloudVoice` (`src/adapters/cloud/voice.ts:110`) voices comments through a pool of `concurrency` workers, 4 by
default, and nothing sets it: `flow-reel.json` and the CLI have no way to change it. An account with a high rate
limit voices a long script slower than it could, and an account on a low tier relies on the 429 retries (up to 4
tries, honouring `Retry-After`, capped at 30 s) to get through.

Left for later because it was asked about mid-release (0.5.0), and it is a feature of its own.

## What was asked

A `concurrency` setting on the voice in `flow-reel.json`:

- a number: that many requests in flight at once;
- `"auto"` (the default): the composer learns the account's limit from the provider and uses it, and falls back to
  4 when the provider doesn't say.

## What fixing it would take, as far as known

- **What each provider tells a client.** To check against each provider's live docs and a real response before
  designing anything (see the 0.3.0 lesson on provider defaults). Believed, not yet verified:
  - ElevenLabs answers with headers giving its current and maximum concurrent requests for the account's tier.
    That maps directly to a concurrency.
  - OpenAI-compatible servers (`/audio/speech`) send `x-ratelimit-limit-requests` and
    `x-ratelimit-remaining-requests`. Those are requests per minute, not requests in flight, so "auto" would have to
    turn them into a pool size, or pace the requests instead.
  - Gemini seems to send no limit headers, only 429s with a retry delay. "auto" there would start at the default
    and back off.
- **Where "auto" learns it.** Either from the first response's headers, growing or shrinking the pool as the
  answers come in (adaptive, no extra call), or from a separate lookup before voicing (one more request, and not
  every provider has one). Adaptive seems simpler and works the same way for every provider.
- **What must not change.** The reel stays deterministic: the order of the requests can change, but the clips and
  the transcript must not. One real failure still stops the other workers. Keys stay in the environment.
- **Docs.** README's voice settings, the settings validation in `src/settings.ts`, and the plugin's
  troubleshooting reference, which covers rate limits.
