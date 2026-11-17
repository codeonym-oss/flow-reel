# GH-79 implementation plan: overlays

Story decision 007. Planned on top of GH-78, in the same session.

## Ticket decisions (taken in the pass)

- **How long:** an overlay is an action that waits its `ms` (1.5 s by default) and stays open until the script's next
  action starts, which is after the step before it ended: so it lasts through the hold that lets its comment finish.
  It stops where a card starts.
- **Where it is drawn:** a callout and a highlight on the app, at the capture's size, before the camera, so they move
  with it; a lower third on the screen, after the camera. While a callout or a highlight shows, the camera eases to
  the full screen and automatic zoom waits: a spotlight needs the whole screen.
- **Painting:** only the frames that move are painted (the way in, one still, the way out); the held frames link to
  the still. The painter now draws at given times, on a transparent page for an overlay.

## Steps

1. `overlay` events (kind, words, bounds, `ms`, `durationMs`, theme); `overlayRequest` checks the words and options;
   `overlayBody` places the bubble below or above. → check: `cards.test.ts`, `schema` via `validateEvents`.
2. The step timer's `overlay` (logs, waits, closes at the next action or the end); `Stage.overlay`;
   `locator.callout` / `locator.highlight` in the wrapper (the element scrolled in, no pointer move); `lowerThird`
   in the integration. → check: `steps.test.ts`, `wrap.test.ts`, `api` types.
3. Retime: start mapped, end mapped and clipped at the next card. → check: `cards.test.ts`.
4. Draw (`media/overlays.ts`) and composite in `polishFilters` (app layer before `zoompan`, screen layer after). The
   camera rule in `polish.ts`. → check: `polish.test.ts`; `record.test.ts` "overlays in a composed reel" (CI); a local
   compose looked at frame by frame.
5. README "Overlays", CONTEXT.md "Overlay".
