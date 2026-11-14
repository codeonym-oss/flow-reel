# 001: A script is the E2E tool's own script plus flow-reel words; Playwright is the only integration built now

**Date:** 2026-11-14 (shaping, Q1; agreed: "ok good!")

**Question:** is the script language flow-reel's own, or each tool's native script with flow-reel additions, and
which tools are built now?

**Decision:** **each tool's own script, with the same flow-reel words added to it (comment, audio, effect), chained
or standalone; only the Playwright integration is built now.** An integration is a thin adapter between one E2E
tool and the composer. Cypress and others are later work, each its own deliverable.

- **Why:** the chained language and the composer boundary arrive soonest on the code that already works; users keep
  everything their tool does; nothing is bet on a second tool yet.
- **Not chosen:** a neutral flow-reel language translated to any tool (a new E2E framework to build and maintain);
  building Playwright and Cypress adapters together (doubles the first delivery).
- **Changes:** GH-1 decision 010 (`step(narration, action)`), to be superseded when the level is created.
