# The studio's server and its shell

## Problem

flow-reel has only the CLI. There is no way to open the studio.

## Change

- **`flow-reel studio`** starts the embedded server, opens the browser and stays in the foreground; Ctrl+C stops the
  studio, never a run (story decisions 003; epic 023, 027).
- **Three locks** (010): 127.0.0.1 only; `Host` and `Origin` checked; a one-time key in the URL traded for a cookie,
  required on every request and WebSocket.
- **The shared types file** (008) and the HTTP and WebSocket skeleton.
- **The shell** in Preact and Vite (001): side bar, top bar, the Orbit logo, dark and light (005, 006), each screen
  empty.

## Done when

- `flow-reel studio` opens the shell; Ctrl+C stops it and leaves running runs alone.
- A request from another origin, another `Host`, or without the cookie is refused, tested.
- The shell matches the mockup's frame at 375, 768 and 1440 px, in dark and light.
