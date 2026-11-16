# Speed up or skip long waits in a reel

## Goal

A reel shows every wait in real time: when a script waits for an agent to reply, a build to finish or an upload to
complete, the viewer watches nothing happen for as long as it took. A script can already wait for anything
(Playwright's `waitFor`, `waitForResponse`, `waitForFunction`), but it can't shorten what the viewer sees. This story
lets a script speed a wait up, with a badge saying so, or skip it, with a card saying how long was cut, while the
narration stays natural and in sync.

## What it delivers

- **`speedUp(factor, fn)`:** the wait inside `fn` plays `factor` times faster, with a "▶▶ ×4" badge in a corner
  (decisions 002, 005, 007).
- **`skip(fn, options?)`:** the wait inside `fn` is cut and replaced by a short card on the dimmed last frame,
  "⏭ 38 s skipped", whose text `label` can replace (decisions 002, 005, 007).
- **Release 0.4.0,** and the plugin teaching both words.

```ts
comment("The agent is thinking it through.");
await speedUp(4, () => page.getByText("Done").waitFor({ timeout: 120_000 }));

comment("The build takes a while; here is the result.");
await skip(() => page.waitForResponse(/\/api\/build/), { label: "38 s plus tard" });
```

## Rules every ticket keeps

- **Speech keeps its normal speed and is never cut** (decision 003). A comment over a sped-up stretch plays at normal
  speed, and the last frame holds if it runs longer; a comment over a skip plays over the card. Sounds in a sped-up
  stretch play at their moment; sounds in a skip are dropped.
- **The stretch is exactly the callback's run, inside one step** (decisions 005, 006). Only actions run inside it:
  `comment()`, `showFrame` and a nested `speedUp`/`skip` there throw where they are written.
- **Effects stay one word family** (GH-27 decisions 002, 003): the new words are checked where they are written, like
  the others, and automatic polish (cursor, ripple, zoom) keeps working in a sped-up stretch.
- **The transcript, captions and event log follow the final timeline,** and two composes of the same script give
  the same structure; `compare` keeps working.
- **One word per concept,** as in `CONTEXT.md`: a ticket that needs a new term (e.g. for a stretch) adds it there
  first.

## Tickets, in the order they ship

1. Speed up a wait in a reel, with a badge showing the factor (includes the timeline retiming both words use)
2. Skip a wait in a reel with a card, and release 0.4.0
3. Teach `speedUp` and `skip` in the plugin, and release it (split from 2: a plugin release touches only `plugin/`;
   GH-62 decision 001)

## Not part of this story

- A separate pause word (decision 002).
- Several scenarios in one script file, and handling failures inside a script (decision 001); shaped later.
- Styling options for the badge or the card beyond skip's `label` (decision 007).
- Speeding up or skipping anything but a wrapped wait (e.g. a whole step, or between two marks; decision 005).
