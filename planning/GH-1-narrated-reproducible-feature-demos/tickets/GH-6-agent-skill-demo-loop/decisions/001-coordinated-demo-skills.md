# 001: A coordinated suite teaches the full demo-making workflow

**Date:** 2026-11-13 (requested: "build the full break down of the agents skill for creating fancy demos using our tool! must be a reach set of skills, with scripts and references and evrything needed!")

**Question:** retain the original one-skill draft, or expand the agent-facing capability?

**Decision:** expand GH-6 into eight focused skills in one `flow-reel` plugin: `demo`, `plan-demo`, `explore-app`, `write-demo`, `polish-demo`, `record-demo`, `review-demo`, and `repair-demo`. The main skill routes the end-to-end job; specialists can be invoked independently. Shared references, templates and small deterministic helpers support them.

This expands the original GH-6 draft. It preserves story decision 005: recording, synthesis, camera rendering and mixing remain in the CLI/image. A rich skill suite does not become a second renderer or browser automation framework.

- **Why:** good demos need editorial choices and verified app behavior as well as a successful recording command. Separately discoverable skills also support revising an existing demo without restarting exploration.
- **Not chosen:** one large skill that loads every reference on every task; separate plugins that duplicate the same API and runtime guidance.
