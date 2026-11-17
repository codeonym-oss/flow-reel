# card.feature, card.image and card.compare, retiring showFrame

Three more cards: a feature with points beside a screenshot, a screenshot in a browser or phone frame, and a before and after with a wipe. `card.image` replaces `showFrame`, which is removed (a breaking change).

**Done when** each card composes in a reel from images in the script's folder, and a script calling `showFrame` gets an error naming `card.image`.
