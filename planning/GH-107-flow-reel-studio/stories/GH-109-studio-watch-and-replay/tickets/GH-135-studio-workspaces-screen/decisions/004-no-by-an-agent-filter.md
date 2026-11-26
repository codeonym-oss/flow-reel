# 004: "Every run" has no "by an agent" filter yet

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** the mockup filters runs started by an agent. Can it?

**Decision:** no. A run doesn't record who started it (`request.json` has no such field), and guessing from the
environment would be wrong as often as right. The filters are: all, going on, failed, resumable. A search box finds a
run, a script or a workspace.

- **Why:** a filter that lies is worse than none.
- **Later:** a `startedBy` in the run's request, given by the plugin's skills, would make it possible.
