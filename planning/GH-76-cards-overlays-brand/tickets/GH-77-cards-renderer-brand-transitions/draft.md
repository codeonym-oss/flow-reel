# Cards: the renderer, the brand and transitions, with intro, chapter, outro and custom cards

A script inserts animated cards with `card.intro`, `card.chapter`, `card.outro` and `card.custom(path, props)`. The composer renders each frame by frame in its own Chromium on a virtual clock with the network off, and plays a transition into and out of it (`fade`, `slide`, `wipe`, `zoom`, `blur`, `iris`, `cut`). `flow-reel.json` takes a `brand` block (theme, accent, logo, fonts, enter, exit), and the four themes ship with bundled fonts. The skip card is drawn the same way, in the brand's theme, as a clock or a bar (`skip(fn, { style })`).

**Done when** a script with an intro, two chapters, a custom HTML card, a skip and an outro composes into a reel where each card animates, the app resumes where it left, a comment before a card plays over it, and two composes give the same frames.
