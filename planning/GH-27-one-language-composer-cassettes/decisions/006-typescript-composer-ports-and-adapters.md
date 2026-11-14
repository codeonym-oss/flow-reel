# 006: The composer stays TypeScript and is built as a domain core with ports and adapters

**Date:** 2026-11-14 (shaping, Q5; agreed: "or typescript, but the composer should be built around solid DDD /
Ports and Adapters pattern right?? for future maintainance and extension !")

**Question:** TypeScript or Python for the composer, and how is it structured?

**Decision:** **TypeScript for scripts and composer; the composer is a domain core (the ubiquitous language of
`CONTEXT.md`) with ports and adapters.** Other languages live only behind a port, as the Python voice worker does
today.

- **Why:** chained script words wrap the E2E tool's objects in the same Node process, so a Python composer would
  need a Node process and a protocol anyway; the named integrations are Node tools; a rewrite would spend the
  effort on reaching today's behaviour again. Ports give the extension points the person wants (tools, voices).
- **Not chosen:** a Python composer with TypeScript scripts (full rewrite plus a two-process bridge).
- **Open:** which seams are ports; Q6.
