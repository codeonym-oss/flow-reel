# 003: The server speaks WebSocket itself, on `node:http`

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** how does the server take WebSockets (story decision 008) without a runtime dependency (story decision 001)?

**Decision:** **a small WebSocket module in `src/studio/`: the opening handshake, text and binary frames, ping, pong and
close, from RFC 6455, with frame encoding and decoding pure and tested on their own.** No extensions, no fragmented
messages from the browser beyond what a browser sends for small commands, and a cap on a message's size.

- **Why:** the package keeps its single dependency (Playwright); the part needed is small and fully testable.
- **Accepted cost:** about 150 lines owned here.
- **Not chosen:** the `ws` package (a runtime dependency); server-sent events (dropped in story decision 008).
