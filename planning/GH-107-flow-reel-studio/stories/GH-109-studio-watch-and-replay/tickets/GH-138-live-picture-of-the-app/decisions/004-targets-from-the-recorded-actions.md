# 004: The targets come from the actions the recording logs

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** where do the targets drawn over the picture come from?

**Decision:** **the record phase reports a `target` progress, the locator and its box as shares of the viewport, each
time it logs a click or a typing with a box.** The Run screen draws the latest one over the picture, with its locator,
and a Targets switch hides them.

- **Why:** the recording already measures these boxes for the reel's events; reporting them costs nothing more.
- **Accepted cost:** a click's target shows as the click is logged, not while the pointer heads for it.
- **Not chosen:** asking the integration for each step's target (a new port for every integration).
