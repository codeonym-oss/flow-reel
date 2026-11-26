# 003: The Log tab reads the run's log by HTTP while it shows

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** how does the Log tab get what the script, the browser and the renderer printed?

**Decision:** `GET /api/log?run=<id>` answers the run's log file as `flow-reel logs` prints it: at most its last
256 KB, with a line saying what was left out. The tab asks again every 2 seconds while it shows and the run is going.
No per-source filter: the log file doesn't say which part printed a line.

- **Why:** the log is a file the run's process writes; following it over the socket would need a second tail for one tab.
- **Not chosen:** the mockup's source chips (script, browser, renderer): the log doesn't keep the source.
