# 002: No stutter warning in this ticket

**Date:** 2026-11-20 (asked for: "speed baseline + warn 1 on same ticket"; dropped after measuring, see below)

**Question:** how does the composer know a step was recorded with too few frames, so it can warn?

**Decision:** **it doesn't, in this ticket.** Nothing measured gave a signal worth a warning, and the case that
prompted it isn't a busy machine.

- **Why:** measured in the image (light and heavy test pages, 2 to 8 CPUs):
  - a native `requestAnimationFrame` counter read 3.6 frames a second while the capture had a clean 30;
  - Chromium's frame reporter (`PipelineReporter` states) said 14 presented frames a second while the capture had 30;
  - the container's `cpu.pressure` read 36 % on a perfect recording and 67 % on a starved one: host-dependent, no
    safe threshold;
  - the VPX-922 retry reel's ring changes 4 times a second because the app drops its easing under
    `prefers-reduced-motion` (`motion-reduce:transition-none`) and steps on a 250 ms timer; the composer sets reduced
    motion (GH-1 decision 009). A frame-count check on the capture would have blamed the machine for that.
- **Not chosen:** a check on the capture's own frames (changes per second): it can't tell a starved animation from
  one that steps by design.
