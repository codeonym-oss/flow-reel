# Plan: the studio's server and its shell (GH-134)

Decisions relied on: epic 023, 027, 031, 032; story 001, 003, 005, 006, 008, 010; this ticket's 001 to 004.

## Read first

- `src/cli.ts`, `src/cli/commands.ts`, `src/cli/command.ts`: how a command is added and parses its flags.
- `src/host/control.ts`: how a run's process takes commands (the studio is another client of it, in later tickets).
- `package.json`, `tsconfig*.json`, `scripts/package.ts`, `.github/workflows/ci.yml`: the build, the pack check, the
  path rules.
- `prototypes/studio-mockup.html`: tokens, rail, top bar, Orbit logo, the small-screen rules.

## Steps

1. **Types:** `src/studio/api.ts`: the screens, the session check answer (`GET /api/hello`: the version), and the
   WebSocket message envelope (`{ v: 1, type, ... }`) for later tickets.
   → check: typecheck.
2. **WebSocket codec** `src/studio/websocket.ts`: accept key, encode a server frame, decode client frames (masked, text,
   binary, ping, pong, close, size cap), and `accept(request, socket)` giving a small connection object.
   → check: unit tests for each frame kind, an unmasked frame refused, an oversize one closed, a round trip with Node's
   own `WebSocket` client.
3. **Locks** `src/studio/locks.ts`: `Host` in {`127.0.0.1:<port>`, `localhost:<port>`}; `Origin` absent or
   `http://` + one of them; the key exchange (`/?key=` → cookie `flow-reel-studio-<port>`, 303 to the same path without
   the key); every other request needs the cookie.
   → check: unit tests: wrong Host, foreign Origin, no cookie, wrong cookie, the key exchange, the cookie's attributes.
4. **Server** `src/studio/server.ts`: `startStudio({ port, web })` on 127.0.0.1 with `node:http`; the locks on every
   request and upgrade; `GET /api/hello`; `/ws` upgrade echoing a `hello`; static files from `dist/web/` with no path
   escaping it, the right types, and `index.html` for the screens' paths.
   → check: unit tests against a real server on port 0: a file, a `..` path refused, a screen path served the shell, the
   upgrade refused without the cookie and accepted with it.
5. **Command** `src/cli/studio.ts`: `flow-reel studio [--port <n>] [--no-open]`; prints the URL, opens the browser
   (`xdg-open`, `open`, `start`), stays until Ctrl+C, never touches runs; a busy port names it and exits 1; a missing
   `dist/web/` says to build it.
   → check: unit test running the command on a free port with `--no-open`, reading the URL, fetching it, then SIGINT
   ends it with 0.
6. **Web app** `web/`: Vite + Preact, fonts from `@fontsource`, the tokens of decision 006, the shell (rail, top bar,
   Orbit logo, theme switch remembered in `localStorage`), path routes for Workspaces, Scripts, Run and Reel, each an
   empty screen with its title; Settings shown off.
   → check: `npm run build` writes `dist/web/`; in Chrome at 375, 768 and 1440 px, dark and light, the frame matches the
   mockup and nothing scrolls sideways.
7. **Build and CI:** `npm run build` runs `tsc` and `vite build`; `typecheck` also checks `web/`; the pack check
   requires `dist/web/index.html`; ci.yml counts `web/` and `vite.config.ts` as runtime.
   → check: `npm run typecheck`, `npm test`, `npm run pack:check`.
8. **Docs:** the command in the CLI docs and README's command list.
   → check: read them.

## Tests

Unit tests at the seams: the codec (pure), the locks (pure), the server (real HTTP on port 0), the command (a child
process). The shell is checked by eye in Chrome.

## Risks

- **The pack check and consumers:** a new folder in `dist/`; the check installs the package and runs it.
- **Windows and macOS** (the systems job): the command test uses a child process and SIGINT; on Windows it is skipped
  for the signal part, as other tests do.
- **Cookies ignore ports:** the cookie's name carries the port, so two studios on two ports don't overwrite each other.
