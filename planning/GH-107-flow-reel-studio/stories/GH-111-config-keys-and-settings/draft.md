# Config and keys

## Goal

Defaults are set once for everything and overridden per workspace. Keys are kept safely, never leave for the wrong server,
and two projects can use different keys under the same name.

## What it delivers

- **Global and local configuration** (epic decision 006), with commands that write either one, as npm and pnpm do, and show
  where each value comes from.
- **Keys** (008): in the system keychain, or a protected file where there is none, on Linux, macOS and Windows. They are
  typed hidden or read from standard input, never given on a command line.
- **Names and scopes** (010): the voice entry names a key and its scope, `local` or `global`. Prefixes are internal, and a
  plain environment variable never counts.
- **Keys tied to servers** (011): a key is never sent to a server other than the one it was saved for.
- **The Settings screen** (021): configuration, keys and voices, with a button to test a voice.
- **The migration** from `apiKeyEnv` and environment variables, documented, including for CI.

## Rules every ticket keeps

- No command, screen, log or error shows a key.
- A protected file that others can read is refused, with how to fix it.
- Saving to the fallback file is always announced.

## To settle in its pass

- The order between flags, environment, local and global settings. Proposed: the nearest wins.
- Whether a scope may be left out (proposed: never), and that a voice entry is replaced whole, not merged.
- The keychain library, and protecting the file on Windows.

## Done when

- Two workspaces use two values of `OPENAI_API_KEY`, one global and one local, and each reaches only its own server.
- A cloned project that points a global key at another server is refused.
- It works in CI without a keychain, and on Linux, macOS and Windows.

## Not part of this story

- The voice server and the calls from outside the container (story 5).
