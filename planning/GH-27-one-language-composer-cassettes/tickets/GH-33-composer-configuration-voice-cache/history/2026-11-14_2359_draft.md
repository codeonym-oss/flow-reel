# Configure the composer's voice and integration, and cache voiced comments

## Problem

The composer always uses Playwright and one built-in local voice; nothing can be chosen. A cloud voice would break
"same script, same reel" and would be billed again on every compile.

## Change

Start the composer with a configuration that names the integration and the voice, with credentials passed from the
environment when a voice needs them. Give the voice port a cache kept with the reel: a comment already voiced
with the same text, voice and settings is reused instead of synthesized again (story decision 005). Only local
voices ship; the port and the cache are built so a cloud voice is one more adapter.

## Out of scope

Shipping a cloud voice adapter; a second integration.

## Done when

- The configuration selects the voice and the integration; an unknown name fails with the list of known ones.
- Recomposing an unchanged script synthesizes nothing and yields an identical reel; changing one comment
  synthesizes only that comment. Both are tested with a fake voice that counts calls.
- Credentials never appear in the reel, the manifest or the logs.
- The README documents the configuration.

## For the ticket pass

Where the configuration lives (a file, flags, or both), the cache key, and how a second local voice is offered.
