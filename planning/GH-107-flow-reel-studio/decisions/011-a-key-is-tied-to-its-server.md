# 011: A key is tied to the server it was saved for

**Date:** 2026-11-25 (grilling; agreed: "A, tie each key to its server")

**Question:** a committed `flow-reel.json` can set the voice's `baseUrl`; how is a cloned project kept from sending a
person's global key to another server?

**Decision:** **a key is tied to a server when it is saved, and flow-reel refuses to send it to any other.** A known
provider's key goes only to that provider. A custom endpoint names its server once, when its key is saved.

- **Not chosen:** asking the first time a workspace uses a global key (people click yes by habit, and CI can't answer);
  doing nothing (any cloned project could take the keys).
