# Use cases

A reel is worth it wherever a video of your app has to stay true to the app: built from a script in your repository,
composed again when the UI changes, and checked in CI.

## Release and launch videos

Announce a feature with an intro card, the feature live in the app, a before-and-after, and an outro with a link.
Since it's a script, the video for 2.5 starts as a copy of the one for 2.4.

```ts
comment("Orbit 2.4 brings saved views.");
await card.intro({ kicker: "Orbit 2.4", title: "Saved views", subtitle: "Your filters, one click away" });
// ... the feature, live ...
await card.compare({ before: "shots/2.3.png", after: "shots/2.4.png", title: "Six filters, or one click" });
await card.outro({ title: "Try saved views", url: "orbit.dev/views" });
```

Tutorial: [A launch video](tutorials/launch-video.md).

## Onboarding and product tours

A narrated walkthrough of a first session, with chapters for each part and callouts on what matters. When the UI
changes, compose it again instead of re-recording it, and only the changed comments are spoken again.

```ts
await card.chapter({ title: "Invite your team" });
comment("Invite people by email; they get access to every project.");
await page.getByRole("button", { name: "Invite" }).click();
await page.getByLabel("Emails").fill("ada@example.com, grace@example.com");
await page.getByRole("dialog").callout("Everyone you add joins as a member");
```

## Pull request demos

Show reviewers what a UI change does, without asking them to check out the branch. An agent with the
[plugin](tutorials/with-claude.md) can write and compose the reel from the pull request's description, and
attach the video.

```text
Make a short reel of what this branch changes in the checkout flow, for the PR description.
```

## Docs and help-center walkthroughs

Embed reels with captions in your docs (see [Embed a reel](recipes/embed-a-reel.md)). Because the composer fixes
the viewport, clock and random seed, a reel composed next month matches this one unless the app changed, and
[`flow-reel compare`](guide/reels.md#compare-two-reels) tells you which steps did.

## Localized videos

One script per language, each with its own voice settings, gives the same walkthrough in every language you
ship. See [Localized reels](recipes/localized-reels.md).

## Agent and AI features

Agent replies, builds and uploads take time that viewers shouldn't sit through. `speedUp` fast-forwards a wait where
the progress matters, and `skip` cuts one where only the result does:

```ts
comment("Ask the assistant to summarize the quarter.");
await page.getByRole("button", { name: "Send" }).click();
await speedUp(6, () => page.getByText("Summary ready").waitFor({ timeout: 120_000 }));
```

## Sales demos and changelog clips

Short, branded clips of a single feature: a lower third for the title, a highlight on the button, and your accent
colour and logo on every card ([Brand](guide/brand.md)).

## What a reel isn't for

- **Live recording of anything that isn't a web app.** The composer drives a browser through Playwright.
- **Music or a soundtrack.** Sounds are short UI effects, and there's no music.
- **Hand editing.** Nothing edits the video directly. Change the script and compose again.
- **Unscripted apps.** A login the fresh browser can't replay needs a test account, or a mode that doesn't need one.
