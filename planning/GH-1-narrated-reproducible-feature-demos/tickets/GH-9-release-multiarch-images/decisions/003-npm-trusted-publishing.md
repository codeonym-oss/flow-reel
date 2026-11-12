# 003: Authenticate npm publishing with OIDC after one-time setup

**Date:** 2026-11-12 (ticket pass, Q3; agreed: "ok")

**Question:** use npm trusted publishing or keep an npm publishing token in GitHub?

**Decision:** **use npm trusted publishing (OIDC)** from GitHub-hosted Actions runners. Include instructions for the one-time npm package/publisher setup and keep automated npm publishing disabled until that setup is ready. Do not require a stored npm publishing token for routine releases.

- **Why:** follows the organization's trusted-publishing approach in its Python projects and avoids maintaining an expiring publishing credential.
- **Not chosen:** a stored npm publishing token requiring expiry and rotation management.
- **Observed state:** on 2026-11-12, the public registry returned HTTP 404 for `flow-reel`; this does not reserve the name or prove the current user can claim it. Repository secret, variable and environment lists were empty. Setup and initial publication must be verified explicitly during implementation.
- **Reference:** [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/) specifies supported runners, npm/Node requirements and workflow identity configuration.
