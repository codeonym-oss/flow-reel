# 004: Ship only the local adapter in GH-4

**Date:** 2026-11-10 (ticket pass, Q4; agreed: "local for now! for cloud, its next ticket right? or thi one? idk !!")

**Question:** does GH-4 ship a cloud provider as well as the local engine?

**Decision:** **local Qwen only for now**, behind a small TTS adapter interface. Cloud provider implementations,
credentials and container secret forwarding are outside GH-4. This narrows the existing draft's cloud-adapter
promise; it preserves story decision 004's adapter boundary.

- **Why:** focus the first implementation on offline, repeatable local synthesis.
- **Not chosen:** adding a cloud adapter and its credentials and provider-specific tests now.
- **Sequencing:** the next existing ticket is GH-5 (holds and muxing), not cloud. A cloud provider would be separately
  planned work; this decision does not create a tracker issue or expand GH-5.
