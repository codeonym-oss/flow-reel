# Sound design

Sound tells the viewer that something happened before they've read it. A reel with the right two or three sounds
feels finished; one with a sound on every action feels like a toy.

## What you get without writing anything

- **Clicks** have a soft click, **typing** has quiet taps (three, cycling), mixed under the voice.
- The mix is done for you: sounds sit beneath speech and duck 6 dB further while a comment plays; the voice is
  normalised. There are no volume controls, and none are needed.

## The eight sounds and what they mean

| Constant | Means | Use it | Don't |
|---|---|---|---|
| `Sounds.feedback.SUCCESS` | It worked. | After the saved message, the new row, the green state is **visible**. Once per reel, usually at the payoff. | When the request was merely sent. |
| `Sounds.feedback.ERROR` | It failed. | On a validation message or a failure the reel shows on purpose. | On an unexpected failure: fix the reel instead. |
| `Sounds.feedback.NOTIFICATION` | Something arrived. | A toast, a badge, a message from someone else appearing. | As a generic "look here". |
| `Sounds.navigation.OPEN` | Something opened. | A dialog, a drawer, a menu, a new panel. Chained on the click that opens it. | On ordinary links (the click sound is enough). |
| `Sounds.navigation.CLOSE` | It closed. | Dismissing that dialog or drawer. | Pair it with every OPEN mechanically: only when the close is part of the story. |
| `Sounds.navigation.BACK` | Back to where we were. | Returning to a list or a previous page. | For a forward navigation. |
| `Sounds.controls.TOGGLE` | A switch flipped. | Checkboxes, switches, filter chips, on/off. Chained on the click. | On ordinary buttons. |
| `Sounds.controls.SELECT` | A choice made. | Picking from a dropdown, a tab, a list item. | On text fields. |

## Placing a sound

- **Chained on the action** when the sound belongs to the click: `button.sound(Sounds.navigation.OPEN).click()`.
  It replaces that click's own sound.
- **Standalone after a wait** when the sound marks a result:
  `await page.getByText("Saved").waitFor(); sound(Sounds.feedback.SUCCESS);`
- One sound per moment. Two sounds at the same instant blur into noise; drop the lesser one.
- Leave silence. Most clicks should only have their automatic click.

## Pairing sound with picture

The strongest moments use both senses, once:

- **Success payoff:** wait for the result → `sound(SUCCESS)` → `flash()`, or a `zoomIn` on the result when another
  scene follows (`direction.md`: a zoom at the very end eases out early).
- **Error:** submit → wait for the message → `sound(ERROR)` → `zoomIn` on the message while the comment explains.
- **Open a panel:** `.sound(OPEN).click()`; polish already zooms on the click.

## A quiet cut

`npx flow-reel compose <script> --no-sound` mutes every sound (automatic ones too) and keeps the voice: useful for
a reel that will play under a talk, or for viewers who find UI sounds distracting. The script is unchanged.

## Checking sound

Stills can't show sound. In `events.json`, `{ "type": "sound", "name": "success", "t": … }` gives each sound's time;
check that it is after the result it marks (compare with the step's `startMs`/`endMs` in `transcript.json`). Then
ask a person to listen, unless you can play audio yourself.
