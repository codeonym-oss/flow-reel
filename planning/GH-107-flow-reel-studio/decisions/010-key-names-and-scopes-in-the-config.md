# 010: The config names a key and its scope; prefixes are internal, and plain environment variables don't count

**Date:** 2026-11-25 (grilling, "does a plain OPENAI_API_KEY count?"; agreed: "NO! also user doesnt see the prefix only sees
the name in his flow-reel.json cfg … there will be another sub entry like scope:'local'|'global'")

**Question:** how does a workspace say which key it uses?

**Decision:** **the voice entry in the config names the key, such as `OPENAI_API_KEY`, and its scope, `local` or
`global`.** The prefix that tells the same name apart is internal; the person never sees it. An unprefixed environment
variable never counts.

- **Refines 008:** the prefixes remain, as an internal detail.
- **Not chosen:** a plain variable as the last resort (a project missing its key could bill the wrong account).
- **Open:** whether an omitted scope has a default, and how CI gives a key.
