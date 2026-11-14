# 008: The 0.1 script API is removed and replaced in one breaking release

**Date:** 2026-11-14 (shaping, Q7; agreed: "yes remove them .. replace them")

**Question:** do `demo`, `step` and `sfx` stay, get deprecated, or go?

**Decision:** **they are removed and replaced by the new language in one breaking release (0.2.0).** The README gets
a short "moving from 0.1" table; 0.1.x stays installable with its own image.

- **Why:** one way to say each thing is the point of a ubiquitous language; the package is days old and the plugin
  that teaches agents has not shipped, so this is the cheapest moment to change it.
- **Not chosen:** deprecated aliases for one release (two vocabularies in the core and in what agents learn);
  keeping both for good.
- **Changes:** GH-1 decision 010, to be superseded when the level is created.
