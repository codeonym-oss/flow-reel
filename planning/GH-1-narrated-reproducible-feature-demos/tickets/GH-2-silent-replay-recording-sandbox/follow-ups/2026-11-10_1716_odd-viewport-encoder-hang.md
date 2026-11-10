---
status: open
from: agent
found-while: GH-4
resolved-by:
---

# Odd scaled viewports can hang recording after encoder failure

In src/runner/display.ts, a 640×360 viewport scales to 853×480.
libx264 rejects the odd width. In src/runner/recorder.ts, the
recorder can then wait after the encoder has exited. The test
timed out after 120 seconds; its container kept Xvfb alive and
interfered with the next recording.

Investigate even capture dimensions and reliable encoder-exit
handling, with regression coverage. This is separate from GH-4.
