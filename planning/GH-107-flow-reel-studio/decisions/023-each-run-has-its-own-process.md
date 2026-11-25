# 023: Each run has its own small process

**Date:** 2026-11-25 (grilling; agreed: "A, each run has its own small process")

**Question:** what keeps a run going?

**Decision:** **a process that starts with the run and exits when it ends.** It starts the containers, writes the journal,
passes commands to the script and moves the run through its phases. The studio, the CLI and agents connect to it to
watch or control, and closing them doesn't stop the run. A queued run's process waits for the recording slot itself.

- **Accepted cost:** a killed process must be detected (its lease expires), and different versions of flow-reel can meet
  (the interface has a version).
- **To check when built:** that a run's container shuts itself down when its process is killed.
- **Not chosen:** one background service (installed, updated and running when unused; its crash affects every run);
  the studio or CLI running its own runs (closing them loses the run).
