# Example: saved views in Orbit

A tiny app (no network, no installs) and a complete reel plan for it: the brief, the script and the settings.

```sh
node serve.mjs                      # Orbit on http://localhost:4173/
npx flow-reel compose script.ts     # in another terminal; writes script.reel/
```

Copy the folder somewhere of your own first: composing writes `script.reel/` beside the script. The script uses
comments on four scenes, a toggle, an open and a success sound, and holds the camera on the chart with
`zoomIn`, then `.zoomOut()` chained on the next scene's click. See `brief.md` for why each choice was made.
