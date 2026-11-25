# 011: A container per phase over plain streams; clients read the journal and send through a local socket

**Date:** 2026-11-25 (grilling, Q10; agreed: "1, streams, journal and socket, container per phase")

**Question:** how do a run's process, its containers and the clients talk?

**Decision:**

- **Containers:** the run's process starts one to record, and others to voice and to render. A container prints its events
  as JSON lines, takes commands on its input, and shuts down when that input closes.
- **Journal:** only the run's process writes it. Clients **watch** by reading it, so finished and dead runs can be watched
  too.
- **Socket:** clients **send** through a local socket only the person can use (a named pipe on Windows), so a command to a
  dead run fails at once.

- **Why:** resuming is the normal path with fewer phases left, and the studio server is one more client.
- **Checked:** a test container on Docker for Linux ended within 3 s of its `docker run` client being killed, by noticing its
  input had closed. Podman, macOS and Windows aren't checked.
- **Accepted cost:** several container starts per run, 0.4–0.7 s each; the Windows pipe's permissions have to be checked.
- **Not chosen:** one container per run (a render crash ends it, and a resume starts in the middle anyway); an HTTP server per
  run (a port and a token each); commands as files (unanswered on a dead run, too slow for the remote screen).
