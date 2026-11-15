# Exploring the app

The script must use what the app really has: real labels, real states, real timings. Find them before writing it.

## Use what the client gives you

Use the browser tool available in this session (a browser automation tool, Playwright via a shell, or ask the
person for screenshots and the page's HTML). No particular tool is required. If there is none, write the plan with
the locators marked as unverified, and verify them through a first compose.

## What to collect, scene by scene

For each scene in the brief:

1. **The locator**, by role and accessible name first: `getByRole("button", { name: "Save view" })`,
   `getByLabel("View name")`, `getByRole("region", { name: "…" })`. Fall back to `getByText`, then `getByTestId`.
   Avoid CSS paths and indexes; they break with the next redesign.
2. **The state before it:** what's on screen, is the element visible without scrolling, is anything covering it.
3. **The visible result after it,** and how long it takes: a message, a new row, a heading, a changed value. That
   is what the script will `waitFor`.
4. **Loading and empty states:** a spinner, a skeleton, an empty list. Note which locator means "ready".
5. **What it changes:** does the action create data that will be there next time (a second "Spring launch")? Then
   the reel needs a reset (seed data, a fresh account, deleting the item at the end) or the second compose won't
   match the first.

Write each of these in the brief's scene table, marked as observed.

## Logins and data

The composer starts a **fresh browser** from `url`, with only the script's folder mounted. Nothing from your
exploration carries over: cookies, local storage, a signed-in session.

- Prefer a route that needs no login (a local dev server with seed data, a demo mode).
- If the reel must sign in, the script does it, with a test account the person provides for this purpose, from a
  file in the script's folder or a fixture they set up. Never put a real person's password in a script.
- If neither is possible, stop and say so: the reel can't be composed until there is a replayable way in.

## The URL

`localhost` in a script means the machine running the compose (on macOS and Windows it is mapped for you). Start the
app before composing and check it with `scripts/preflight.mjs --url …`.
