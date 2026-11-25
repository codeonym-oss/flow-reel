# 022: The local voice becomes a separate, optional voice server

**Date:** 2026-11-25 (grilling; agreed: "B, ship it as a separate optional voice server")

**Question:** what happens to the local voice that ships in the composer image today?

**Decision:** **it moves to its own image and answers like any OpenAI-compatible endpoint, started and stopped with
flow-reel commands.** The main image is one, without it. Every voice is a connector or an endpoint the person chose;
with none configured, a compose is silent, with captions, and says how to add one.

- **Why:** free narration without a key stays, the connector is the same as for any endpoint, and the model stays loaded
  between runs.
- **Changes:** GH-101 decisions 001 to 005 (the voice picks the image) and GH-1 decision 004 (local voice by default), to
  be superseded when the level is created.
- **Accepted cost:** a second image to build and release.
- **Not chosen:** dropping it (a new user's first reel would be silent, and today's users would have to switch); keeping it
  in the image (two versions of the main image, and the model reloads at every compose).
