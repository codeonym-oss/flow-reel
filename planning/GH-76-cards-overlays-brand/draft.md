# Cards, overlays and a brand for reels

## Goal

A reel today is the app, a voice and a few effects. To tell a story around a feature, a script can only show a
still image (`showFrame`), drawn by hand elsewhere. This story gives scripts a catalog of animated **cards** (an
intro, chapters, a feature, a screenshot in a device frame, a before and after, an outro, or a card written as an
HTML page), **overlays** drawn over the app (a callout, a highlight, a lower third), and a **brand** set once in
`flow-reel.json` that every card and overlay follows. Each is one typed word, so an agent or a person finds them by
typing `card.` and reads their props from the types. The design was validated on the design canvas
(https://claude.ai/artifact/YaAajQV5VDssXY4Rfy8JCr).

## What it delivers

```ts
export default script({ url: "http://localhost:3000" }, async ({ page, comment, card, lowerThird, skip }) => {
  comment("Orbit 2.4 brings saved views.");
  await card.intro({ kicker: "Orbit 2.4", title: "Saved views", subtitle: "Your filters, one click away" });
  await card.chapter({ title: "Save a view" });                    // numbered "01 / 02" by itself
  await page.getByRole("button", { name: "Save view" }).comment("Save the filters.").click();
  await page.getByTestId("chart").callout("The chart follows the filter");
  await card.image("shots/mobile.png", { title: "On your phone too", frame: "phone" });
  await card.custom("cards/pricing.html", { plan: "Team", price: "$12" });
  await card.outro({ title: "Try saved views", url: "orbit.dev/views" });
});
```

- **Cards** (decisions 001, 002, 004): `card.intro`, `card.chapter`, `card.feature`, `card.image`, `card.compare`,
  `card.outro` and `card.custom(path, props)`. A card is an insertion: the app stops, the card plays, the app resumes
  on the frame it left. Every card takes `ms`, `enter`, `exit` and `theme`.
- **Custom cards** (decision 003): any HTML page in the script's folder, with its own CSS, JavaScript, images and
  fonts. `data-prop="name"` fills an element from the props, `window.flowReel` gives scripts the props and the
  theme, and the flow-reel atoms (`fr-*` classes, `--fr-*` colours) are always there.
- **Transitions** (decision 005): `fade` (the default), `slide`, `wipe`, `zoom`, `blur`, `iris`, `cut`, into and out
  of every card.
- **Brand** (decision 006): `"brand": { theme, accent, logo, fonts, enter, exit }` in `flow-reel.json`; four themes,
  `ink`, `paper`, `ocean`, `ember`.
- **Overlays** (decision 007): `locator.callout(text, { detail? })`, `locator.highlight()` and
  `lowerThird({ title, subtitle? })`, shown from their moment until the step ends.
- **The skip card** follows the brand, as a clock or a bar (decision 008).
- **`showFrame` is retired** for `card.image` (decision 004): a breaking change, released as 0.5.0 with a migration
  note, and the plugin teaches the catalog.

## Rules every ticket keeps

- **Deterministic** (decision 003): a card or overlay is rendered frame by frame in the composer's own Chromium on a
  virtual clock, with the network off: the same script and files give the same frames.
- **The timeline model holds:** a card is an insertion like a hold, and the recording resumes on the frame it left;
  a comment spoken before a card plays over it, and the card lasts until it ends unless `ms` says otherwise.
- **Checked where written:** a bad prop, an unknown option, a missing file or a file outside the script's folder
  throws where the script calls the word, naming it, as the effect words do.
- **One word per concept,** in `CONTEXT.md`: card, overlay, brand, theme and transition are added there first.
- **Every word is typed and documented** in `src/index.ts`, so an editor shows its props.

## Tickets, in the order they ship

1. Cards: the renderer, the brand and transitions, with `card.intro`, `card.chapter`, `card.outro` and `card.custom`;
   the skip card is drawn the same way, as a clock or a bar
2. `card.feature`, `card.image` and `card.compare`, retiring `showFrame`
3. Overlays: `callout`, `highlight` and `lowerThird`
4. Release 0.5.0 with a migration note
5. Teach the catalog in the plugin, and release it

## Not part of this story

- Cards with sound or video inside them; audio stays the voice and the sounds.
- A visual editor for cards; the design canvas stays the reference.
- Transitions between two app moments without a card.
- Remote assets in cards (fonts, images or scripts from the network).
