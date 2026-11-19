# Sounds

Clicks and per-character typing taps sound by themselves. To mark a meaningful moment, play one of the `Sounds`
constants, chained on the element whose action it belongs to, or standalone from the script's context:

```ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173" }, async ({ page, sound }) => {
  await page.getByRole("button", { name: "Delete" }).sound(Sounds.navigation.OPEN).click();
  await page.getByText("Deleted").waitFor();
  sound(Sounds.feedback.SUCCESS);
});
```

| Group | Sounds |
|---|---|
| `Sounds.feedback` | `SUCCESS`, `ERROR`, `NOTIFICATION` |
| `Sounds.navigation` | `OPEN`, `CLOSE`, `BACK` |
| `Sounds.controls` | `TOGGLE`, `SELECT` |

## When a sound plays

- **Chained**, `locator.sound(…)` plays when that element's action is logged (for a click, with the click). A sound
  within ±150 ms of a click replaces the click's own sound. The ripple and the logged click stay.
- **Standalone**, `sound(…)` plays now and returns at once. It adds no pause, does nothing in the browser, and doesn't
  check whether anything succeeded. **Call it after the state it describes**, never before the wait.
- A sound is named only by a `Sounds` constant. A bare string is a type error, and an unknown name fails at run time.
- There are no other sounds, and no music.

## Mute

```sh
npx flow-reel compose demos/settings.ts --no-sound
```

`--no-sound` mutes every sound and keeps them in the event log, with the comments, captions and visuals unchanged.

## How they're mixed

- Sounds never add frames, change speech holds or lengthen the video. Tails that reach the end of the video fade out
  and are trimmed.
- Sounds sit beneath speech, and duck another 6 dB under each speech clip (30 ms lead-in, 250 ms recovery).
- The final mix is normalized to -16 LUFS with a -1.5 dBTP peak ceiling, and encoded as 48 kHz stereo AAC at 192
  kb/s.
- The palette is short, related DAEDAL CC0 UI sounds, bundled in the package and image, and they work offline. See
  [asset sources and licences](https://github.com/codeonym-oss/flow-reel/blob/main/docker/sfx/README.md).
