# Configure the composer's voice and integration, and cache voiced comments

## Problem

The composer always uses Playwright and one built-in local voice; nothing can be chosen. A cloud voice would break
"same script, same reel" and would be billed again on every compile.

## Change

- **Configuration:** a `flow-reel.json` file in the script's folder, and the flags `--integration`, `--voice`,
  `--speaker` and `--language`. A flag wins over the file, the file over the defaults. `compose` writes the file
  after a successful run when there is none, or with `--save-config` (decisions 001, 005).
- **A second local voice:** any speaker and language of the shipped Qwen model, checked against its lists; the
  transcript's voice records the language (decision 003).
- **Credentials:** each adapter declares the environment variables it needs; the host checks them and passes them
  into the container by name only (decision 004).
- **Reel cache:** the previous reel's clips. A comment with the same text and voice settings, whose clip is
  undamaged, is reused instead of synthesized again (decision 002, story decision 005).

Only local voices ship; the port and the cache are built so a cloud voice is one more adapter.

## Out of scope

Shipping a cloud voice adapter; a second integration; a second model.

## Done when

- The configuration selects the voice and the integration; an unknown name fails with the list of known ones.
- Recomposing an unchanged script synthesizes nothing and yields identical audio and transcript; changing one
  comment synthesizes only that comment. Both are tested with a fake voice that counts calls.
- Credentials never appear in the reel, the manifest, the configuration file or the logs.
- The README documents the configuration.
