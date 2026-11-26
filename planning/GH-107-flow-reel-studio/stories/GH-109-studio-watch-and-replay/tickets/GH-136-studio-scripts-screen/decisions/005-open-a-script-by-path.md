# 005: Opening a script by path takes a full path to a script in a workspace

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** what may "Open a script by path" open?

**Decision:** a full path (`~/` works) to a `.reel.ts` or `.reel.js` file inside a workspace's scripts folder, as
`compose` takes. Its workspace is remembered on this computer, as `compose` does, and the screen shows it at
`/scripts/<workspace>/<script>`. Anything else is refused with what was wrong.

- **Why:** story decision 010 keeps the readable files to workspaces'.
