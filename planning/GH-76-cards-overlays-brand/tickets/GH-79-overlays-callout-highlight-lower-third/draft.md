# Overlays: callout, highlight and lowerThird

`await locator.callout(text, { detail? })` spotlights an element with a bubble, `await locator.highlight()` spotlights it alone, and `await lowerThird({ title, subtitle? })` shows a title bar; each shows from its moment until its step ends, in the brand's theme. A callout and a highlight move with the camera; a lower third stays put.

**Done when** each overlay composes over the app in a reel, lasting through the step's comment.
