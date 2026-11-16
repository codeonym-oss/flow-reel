# Skip a wait in a reel with a card, and release 0.4.0

## Problem

Some waits are too long even sped up (a two-minute build is 30 s at ×4). The viewer only needs the result.

## Change

- A new awaited effect word, `skip(fn, { label? })`: the stretch while `fn` runs is cut from the reel and replaced by
  a card on the dimmed last frame, "⏭ 38 s skipped" by default, for about 1.5 s, longer while a comment is still
  being spoken (story decisions 003, 005, 007). Sounds inside the stretch are dropped.
- Built on the previous ticket's retiming.
- Release 0.4.0: merge release-please's PR (#64) once `skip` is in, and check npm and the image are published.
- The plugin's teaching is its own ticket, after this one (decision 001).

## For the ticket pass

- The card's default text and how the cut length is written (rounding, minutes); whether `label` can include it.
- The card's exact duration rules, and the fade in and out.
- What the event log and transcript record for a cut stretch, and what `compare` checks.

## Done when

- A script waiting about 60 s, wrapped in `skip(…)`, composes into a reel where the wait is replaced by the card,
  the comment before it is spoken whole over the card, and `verify` and `compare` pass.
- `label` replaces the card's text; a bad option throws where it is written.
- npm `flow-reel@0.4.0` and the image are published for amd64 and arm64.
