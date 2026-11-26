# 001: The pictures ride the pipes a run already has

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** how does a picture get from the record container to the browser, and how does the container learn that
someone watches?

**Decision:** **through the pipes that already exist.** The run's process writes `watch` and `unwatch` lines on the
container's input. The container answers with `picture` messages (a base64 JPEG) on its output, beside its progress.
The studio asks the run's process for pictures with a `picture` command on the run's control socket, which stays open
and carries one picture per line. The studio sends each one to the browser as a binary WebSocket message.

- **Why:** no new port, file or process; the control socket already proves the client can read the run's folder; the
  container's input already ends it when the run's process dies.
- **Accepted cost:** base64 costs a third more bytes between the container and the studio: about 30 KB a picture, 8 a
  second, on local pipes.
- **Not chosen:** a file the container rewrites (polling, and a picture half written); a second socket out of the
  container (a mount or a port for one feature).
