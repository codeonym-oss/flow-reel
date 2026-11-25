# Example: saved views in Orbit

A tiny app (no network, no installs) and a complete reel plan for it: the brief and the script. Copy the folder
somewhere of your own, then:

```sh
npx flow-reel init --title "Saved views"                # makes the copy a workspace
node serve.mjs                                          # Orbit on http://localhost:4173/
npx flow-reel compose reels/saved-views.reel.ts         # in another terminal; writes reels/out/saved-views.reel/
```

The script uses comments on four scenes, a toggle, an open and a success sound, and holds the camera on the chart with
`zoomIn`, then `.zoomOut()` chained on the next scene's click. See `reels/saved-views.brief.md` for why each choice was
made.
