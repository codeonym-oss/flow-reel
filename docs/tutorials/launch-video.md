# A launch video

A release announcement mixes live footage of the app with designed screens: a title, what's new, a screenshot
on a phone, a before-and-after, and a call to action. This tutorial builds one with [cards](../guide/cards.md), a
[brand](../guide/brand.md) and a [custom card](../guide/cards.md#custom-cards).

## The folder

The composer sees only the scripts folder, so everything a reel uses lives in it:

```text
flow-reel.json
reels/
├── launch.reel.ts
├── brand/
│   ├── logo.svg
│   └── Display.woff2
├── shots/
│   ├── mobile.png      ← a screenshot of the mobile app
│   ├── 2.3.png         ← the old screen
│   └── 2.4.png         ← the new one
└── cards/
    └── pricing.html    ← a custom card
```

Images are PNG, JPEG, WebP or SVG, and paths are relative to the script. Use real screenshots: take them with your
OS's screenshot tool or with Playwright's `page.screenshot()`.

## The brand

```json
{
  // ...
  "voice": { "adapter": "elevenlabs", "apiKeyEnv": "ELEVENLABS_API_KEY" },
  "brand": {
    "theme": "paper",
    "accent": "#D6336C",
    "logo": "brand/logo.svg",
    "fonts": { "heading": "brand/Display.woff2" },
    "enter": "slide",
    "exit": "fade"
  }
}
```

The logo shows on the intro and the outro. The accent colours the kickers, buttons and overlays, and text on it is
chosen to read against it.

## The script

```ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173" }, async ({ page, comment, card, sound, lowerThird }) => {
  // Title. The comment is spoken over the card, which lasts until it ends.
  comment("Orbit 2.4 is here, and it's all about saved views.");
  await card.intro({ kicker: "Orbit 2.4", title: "Saved views", subtitle: "Your filters, one click away", layout: "center" });

  // What's new, at a glance.
  comment("Save any filter, share it with your team, and pin it to the sidebar.");
  await card.feature({ title: "One click", points: ["Save any filter", "Share it", "Pin it"], image: "shots/2.4.png" });

  // Live: the feature in the app.
  await card.chapter({ title: "See it live" });
  comment("Pick a filter, and save it as a view.");
  await lowerThird({ title: "Saved views", subtitle: "New in 2.4" });
  await page.getByRole("button", { name: "Active" }).click();
  await page.getByRole("button", { name: "Save view" }).sound(Sounds.navigation.OPEN).click();
  await page.getByLabel("View name").fill("Active work");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "saved" }).waitFor();
  sound(Sounds.feedback.SUCCESS);

  // Screens you can't film live.
  comment("It's on your phone too.");
  await card.image("shots/mobile.png", { title: "On your phone too", frame: "phone" });

  comment("Six filters to set before. One click now.");
  await card.compare({ before: "shots/2.3.png", after: "shots/2.4.png", title: "Six filters, or one click" });

  // A screen of your own design.
  comment("Saved views come with every Team plan.");
  await card.custom("cards/pricing.html", { plan: "Team", price: 12 }, { enter: "zoom" });

  comment("Try saved views today.");
  await card.outro({ title: "Try saved views", url: "orbit.dev/views", links: ["Docs", "Changelog"] });
});
```

## Pacing cards

- A card lasts **3 s**, or until the comment written before it has been spoken. That's the easiest way to pace
  one: write the line, and the card waits for it.
- `ms` (500 to 60000) sets an exact length, transitions included: `card.chapter({ title: "Live", ms: 1500 })`.
- `enter` and `exit` pick the transition (`fade`, `slide`, `wipe`, `zoom`, `blur`, `iris`, `cut`). The camera eases
  back to the full screen as a card comes, so the transition starts from what was on screen.

## The custom card

`cards/pricing.html` counts up to its price. It uses the built-in classes, so it matches the other cards and follows
the brand:

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
    const { price } = window.flowReel.props, start = performance.now();
    requestAnimationFrame(function tick(now) {
      const k = Math.min(1, (now - start) / 1000);
      document.getElementById("price").textContent = Math.round(price * k);
      if (k < 1) requestAnimationFrame(tick);
    });
  </script>
</body></html>
```

It's drawn frame by frame on a frozen clock, so the animation plays the same way on every compose.

## Compose and share

```sh
export ELEVENLABS_API_KEY=...
npx flow-reel compose reels/launch.reel.ts
npx flow-reel verify reels/out/launch.reel
```

`video.mp4` is ready for a release post, and `captions.vtt` goes with it on a web page (see
[Embed a reel](../recipes/embed-a-reel.md)).
