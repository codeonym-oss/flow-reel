# 002: Adding a workspace and cleaning are POSTs of JSON, with the page's Origin

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** the studio only answered GET until now. How do the two writes of this screen get through the locks
(story decision 010)?

**Decision:**

- `POST /api/workspaces` (add one, or make one with `init`) and `POST /api/clean` take a JSON body of 64 KB at most.
- A POST needs, on top of the cookie: an `Origin` header that is the studio's own (a browser always sends it on a
  POST), and `Content-Type: application/json` (a form on another site can't send that without asking first).
- Anything else is 403 or 415, and nothing is written.

- **Why:** the cookie is `SameSite=Strict`, so another site can't use it; the two extra checks make that hold even if a
  browser got it wrong.
- **Not chosen:** a separate CSRF token (the three checks already cover it).
