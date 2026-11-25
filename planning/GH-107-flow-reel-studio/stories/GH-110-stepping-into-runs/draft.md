# Stepping in

## Goal

A person can stop a run before a step, use the run's own browser tab, and let it go on. A script can ask for that itself,
so a login, a one-time code or a payment can be part of a reel without secrets in the script or the recording.

## What it delivers

- **Hold, step, release** from the studio, at gates before each step and each phase (epic decisions 014, 031).
- **The remote screen** (020): the runner's screen in the studio, with the person's mouse and keyboard, popups and copy-paste.
- **`interrupt`** (015, 019): a message the person answers with Continue, an element that appears (`until`), or a value they
  type (`input`); with `timeout` and `autoResolve`.
- **Capture stops while held** (018): a hold splits the recording into files that the composer joins.
- **Waiting, then `stopped`** (016): 15 minutes for an interrupt, 5 after the controlling client disappears, both
  configurable. `--unattended` fails at the first required interrupt.
- **`redact`** (017): a block or a blur, drawn in the page before capture, that stays through scrolling and updates.
- **Typed text kept out of files:** text typed in password or redacted fields isn't written in the event log or any file.
- **The page's clock** (020): logins and payments work; a fixed date stays possible for reels that need it.

## Rules every ticket keeps

- Nothing a person types while a run is held is recorded, logged or sent anywhere but the run's browser.
- One client controls a run at a time; anyone can watch.
- A terminal waiting on a held run says who holds it and since when.

## To check early

- The delay of the remote screen, and that popups and menus are shown.
- Restarting capture after a hold: the timing, and the marker.
- Freezing and resuming the page's clock during a hold, and that it keeps running during an interrupt.

## To settle in its pass

- How `interrupt` options combine. Proposed: stepping in stops the countdown; `--unattended` passes optional interrupts;
  `input` needs a default to auto-resolve; `until` and a `"never"` timeout can't auto-resolve.
- How `redact` is written for elements inside frames, and what `input: "secret"` promises.
- Real time or the fixed date as the default clock.

## Done when

- A login, a five-stage form and a test payment are done by hand in the same tab, and the reel shows none of it.
- A search of the run's files finds none of the secrets typed by hand or in password and redacted fields.
- A held run whose studio closes becomes `stopped` after its limit, and frees the recording slot.
- A reel with holds matches the same reel without them, except for data the app changed meanwhile.

## Not part of this story

- Editing the cue sheet, approval before publishing, breakpoints, a TUI. The gates leave room for them.
- Passkeys, security keys and saved passwords of the person's own browser.
