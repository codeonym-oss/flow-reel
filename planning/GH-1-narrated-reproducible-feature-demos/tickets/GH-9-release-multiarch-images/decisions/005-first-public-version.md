# 005: The first public release is 0.1.0

**Date:** 2026-11-12 (ticket pass, Q5; agreed: "ok")

**Question:** start public releases at the existing package version 0.1.0 or advance to 0.2.0?

**Decision:** **publish 0.1.0 as the initial public version**, matching the current package. Configure release-please's first release explicitly so accumulated feature commits do not unintentionally move the first public version to 0.2.0. Subsequent releases use release-please version bumps.

- **Why:** there is no existing public release to advance from, and the package already identifies itself as 0.1.0.
- **Not chosen:** 0.2.0 as the first public release.
