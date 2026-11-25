# flow-reel studio

## Goal

Today a compose is one long command: it shows almost nothing while it works, can't be paused, and a failed render loses
the recording. This epic makes flow-reel a tool you can watch and step into. A person opens the **studio**, a web app on
their computer, sees their projects and scripts, starts a run, watches the reel form as a score, stops it when needed,
uses the run's own browser tab, and replays the result. The **CLI** offers the same runs to terminals, CI and agents.

Cypress's open mode is the reference for the loop. The difference is the question it answers: not "did it pass?", but "is
this the reel I want?".

## Why now

- Nobody can see or stop what a compose is doing (decisions 014, 021, 023).
- A dead container loses everything, and work in progress appears in the project (005, 007).
- A login, a one-time code or a payment can't be part of a reel without putting secrets in a script (015, 020).
- Two projects can't hold different values for the same key (008, 010).
- The local voice forces two versions of the main image (022).

## What it looks like

```
$ flow-reel init                                  # once per project
$ flow-reel studio                                # watch, step in, replay
$ flow-reel compose reels/checkout.reel.ts        # the same run, from a terminal
$ flow-reel compose reels/checkout.reel.ts --detach
```

```ts
import { script } from "flow-reel";

export default script({ url: "http://localhost:3000" }, async ({ page, comment, interrupt }) => {
  comment("Checkout takes three steps.");
  await page.getByRole("button", { name: "Checkout" }).click();
  await page.getByLabel("Card number").redact();
  await interrupt("Pay with your card", { until: page.getByText("Thank you") });
  comment("And the order is placed.");
});
```

Command and option names are proposals until their tickets settle them.

## Rules every story keeps

- **One kind of run** (014): it runs to its end by itself and can be intercepted. The studio, the CLI and agents use the
  same commands on the same interface (031).
- **Nothing finished is lost** (005, 031): no container holds the only copy of a finished phase's result.
- **Nothing unfinished reaches the project** (007): run data stays in flow-reel's data folder, and a finished reel is
  swapped in whole.
- **Scripts run only in containers** (004), and a script never sees an API key once voices are called from outside (022).
- **Secrets stay out of files:** keys never enter `flow-reel.json`, a reel, the journal or a command line (008, 010, 011),
  and what a person types while a run is held is never recorded (018).
- **The core stays pure** (030, 031): no Docker, SQL, HTTP or ffmpeg in it; CI fails a forbidden import. ffmpeg runs only
  in the composer image.
- **The studio answers this computer only,** and refuses requests from other sites.
- **No account, and offline** with a local voice (032).
- **One word per concept:** new terms enter `CONTEXT.md` first. Each story updates the docs, and the plugin in its own
  plugin-only pull requests.

## Stories, in the order they are built

1. **Workspaces and runs:** init, `*.reel.ts` scripts, the output folder, run data outside the project, the run engine, and
   the CLI commands around it.
2. **The studio:** the local server and its Workspaces, Scripts, Run and Reel screens, drawn as a score.
3. **Stepping in:** hold and step, the remote screen, `interrupt`, `redact`, and the page's clock.
4. **Config and keys:** global and local configuration, the keychain, scopes, keys tied to servers, the Settings screen.
5. **Voices:** one composer image, the optional voice server, and any OpenAI-compatible endpoint.

## Delivery

Work is integrated on a `studio` branch, one pull request per ticket; `main` stays at 0.7 and can still be fixed (026).
Each story ends in a private check by the person. **Nothing is released until the five quality gates have passed** (025,
029):

1. A day with three projects works from start to end, on real apps.
2. Killing the container, the run's process, the studio and the computer at each phase loses nothing finished.
3. Stepping in works for a login, a five-stage form and a test payment, in the same tab.
4. The same scripts give reels as good as 0.7's, and compose no slower.
5. The person uses it for two weeks without finding anything they'd be ashamed to ship.

## Earlier decisions it changes

To be marked superseded in their own folders when this epic has a key: GH-1 004 (the image ships a local voice), GH-1 009
(the fixed clock, in part), GH-31 005 (`<name>.reel.partial/` beside the script), GH-33 001 (settings), GH-33 004 and
GH-49 001 (keys in environment variables), GH-101 001 to 005 (the voice picks the image).

## Not part of this epic

- A local runner, Cypress or any integration other than Playwright (004). The interfaces leave room for them.
- A TUI, editing the cue sheet, picking an element for its locator, comparing two reels side by side, inspecting a past
  step's HTML (014, 021).
- A hosted or team version, accounts, Postgres, message queues.
- The fix for typed text saved in `events.json` on 0.7, if it is released earlier on its own.
