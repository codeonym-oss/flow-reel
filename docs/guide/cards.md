# Cards

Cards are designed screens inserted into the reel: an intro, chapters, a feature, a framed screenshot, a before and
after, an outro, or a card of your own written in HTML. Each is one word on `card`, awaited where it shows. The app
stops on its frame, the card plays with a transition in and out, and the app resumes where it left off.

```ts
export default script({ url: "http://localhost:4173" }, async ({ page, comment, card }) => {
  comment("Orbit 2.4 brings saved views.");
  await card.intro({ kicker: "Orbit 2.4", title: "Saved views", subtitle: "Your filters, one click away" });
  await card.chapter({ title: "Name your view" });                 // "Chapter 01 / 02"
  await page.getByLabel("Name").fill("Active work");
  await card.feature({ title: "One click", points: ["Save any filter", "Share it", "Pin it"], image: "shots/views.png" });
  await card.image("shots/mobile.png", { title: "On your phone too", frame: "phone" });
  await card.compare({ before: "shots/2.3.png", after: "shots/2.4.png", title: "Six filters, or one click" });
  await card.custom("cards/pricing.html", { plan: "Team", price: 12 }, { enter: "zoom" });
  await card.chapter({ title: "Share it", theme: "paper" });
  await page.getByRole("button", { name: "Share" }).click();
  await card.outro({ title: "Try saved views", url: "orbit.dev/views", links: ["Docs", "Changelog"] });
});
```

## The cards

| Word | Props |
|---|---|
| `card.intro({ … })` | `title`, `kicker?` (a short line above, in the accent), `subtitle?`, `layout?: "left"` (default) or `"center"` |
| `card.chapter({ … })` | `title`, `subtitle?`. Numbered among the script's chapters by itself: "Chapter 02 / 03". |
| `card.feature({ … })` | `title`, `points` (one to five short lines), `kicker?`, `image?` (shown in a browser window), `imageSide?: "right"` or `"left"` |
| `card.image(image, { … }?)` | `kicker?`, `title?`, `caption?`, `frame?: "browser"` (default), `"phone"` or `"none"`, `fit?: "cover"` or `"contain"`, `url?` (the browser bar's) |
| `card.compare({ … })` | `before`, `after`, `kicker?`, `title?`, `labels?` (two, "Before" and "After" by default) |
| `card.outro({ … })` | `title`, `url?` (shown as a button), `links?` (up to four) |
| `card.custom(page, props?, options?)` | any JSON props, for an HTML page of your own |

## Options every card takes

In its props object, or as `options` for `card.custom`:

| Option | Values | Default |
|---|---|---|
| `ms` | the exact length, 500 to 60000, transitions included | 3 s, or until the comment before it has been spoken |
| `enter`, `exit` | `fade`, `slide`, `wipe`, `zoom`, `blur`, `iris`, `cut` | the brand's, else `fade` |
| `theme` | `ink`, `paper`, `ocean`, `ember` | the brand's, else `ink` |

- **A comment written just before a card is spoken over it**, and the card stays until it ends. That's how to pace
  one.
- The camera eases back to the full screen as a card comes, so the transition starts from what was on screen. No
  cursor or zoom is drawn on a card.
- **Images** are PNG, JPEG, WebP or SVG files in the script's folder, given relative to the script.
- A wrong prop, option or path throws where the card is written, naming it.
- Cards can't go inside `speedUp` or `skip`.
- The event log records each card as a `card` event, with its props, its look and the hash of each file it uses.
  `compare` checks them.

## Custom cards

A custom card is an HTML page in the script's folder, with its own CSS, JavaScript, images and fonts, laid out at
the reel's size. The composer draws it frame by frame on a frozen clock, so `setTimeout`, `requestAnimationFrame`,
`performance.now()`, CSS animations and transitions all play the same way every time. The network is off: the page
loads only files from the script's folder.

```html
<!doctype html>
<html><head><style>.price { font-size: 6rem }</style></head>
<body>
  <div class="fr-card">
    <span class="fr-kicker fr-enter">Pricing</span>
    <h1 class="fr-title fr-enter fr-d1" data-prop="plan">Plan</h1>
    <b class="price fr-enter fr-d2">$<span id="price">0</span></b>
  </div>
  <script>
    // Counts up to the price over a second.
    const { price } = window.flowReel.props, start = performance.now();
    requestAnimationFrame(function tick(now) {
      const k = Math.min(1, (now - start) / 1000);
      document.getElementById("price").textContent = Math.round(price * k);
      if (k < 1) requestAnimationFrame(tick);
    });
  </script>
</body></html>
```

```ts
await card.custom("cards/pricing.html", { plan: "Team", price: 12 }, { enter: "zoom", ms: 4000 });
```

What a custom card's page gets:

`data-prop="name"`
: Fills the element with `props.name`: its text, an image's `src`, or a list's items.

`window.flowReel`
: `props`, `theme` (its colours), `durationMs` and `logo`.

Colours
: `--fr-bg`, `--fr-surface`, `--fr-line`, `--fr-fg`, `--fr-muted`, `--fr-accent`, `--fr-on-accent`, from the theme
  and the brand.

Fonts
: `--fr-font-heading`, `--fr-font-body`, `--fr-font-mono`.

Classes
: `fr-card` (a full-screen card), `fr-kicker`, `fr-title`, `fr-title-m`, `fr-subtitle`, `fr-mono`, `fr-muted`,
  `fr-accent`, `fr-surface`, `fr-badge`, `fr-pill`, `fr-logo`, `fr-stack`, `fr-row`. `fr-enter`, with the delays
  `fr-d1` to `fr-d5`, brings things in one after another.

Sizes
: A rem is 1/54 of the screen's height, so a card fits any viewport.

Build on these, so a custom card matches the built-in ones and follows the brand.
