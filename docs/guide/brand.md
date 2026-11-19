# Brand

`brand` in `flow-reel.json` sets how every card, every overlay and the skip card look. Each key is optional, and a
card's or overlay's own `theme`, `enter` and `exit` win over it.

```json
{
  "version": 1,
  "brand": {
    "theme": "paper",
    "accent": "#D6336C",
    "logo": "brand/logo.svg",
    "fonts": { "heading": "brand/Display.woff2", "body": "brand/Text.woff2" },
    "enter": "fade",
    "exit": "fade"
  }
}
```

| Key | Values | Default |
|---|---|---|
| `theme` | `ink` (dark), `paper` (light), `ocean` (teal), `ember` (warm) | `ink` |
| `accent` | a `#rrggbb` colour. Replaces the theme's accent, and text on it is chosen to read against it. | the theme's |
| `logo` | an SVG, PNG, JPEG or WebP file. Shows on the intro and the outro. | none |
| `fonts.heading`, `fonts.body` | WOFF2, WOFF, TTF or OTF files. Replace Inter Tight (titles) and Inter (text). | bundled |
| `enter`, `exit` | the default transitions: `fade`, `slide`, `wipe`, `zoom`, `blur`, `iris`, `cut` | `fade` |

- Paths are relative to `flow-reel.json`, inside the script's folder.
- `theme` and `accent` colour the overlays and the skip card too.
- JetBrains Mono (labels), Inter Tight and Inter are bundled, and work offline.
- `--save-config` keeps the brand when it rewrites `flow-reel.json`.

Use the product's own colour and logo. One brand per folder means every reel in it looks the same.
