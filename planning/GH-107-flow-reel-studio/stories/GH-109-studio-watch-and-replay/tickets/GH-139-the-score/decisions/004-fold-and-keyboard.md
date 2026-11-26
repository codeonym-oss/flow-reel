# 004: Fold steps without a comment; every mark is a button

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** how does a 60-step score stay readable, and how is it read by keyboard?

**Decision:**
- **Fold** joins each run of two or more steps without a comment into one measure named by its step numbers
  (`4–6`), as narrow as a step picture. Commented steps are what a viewer hears, so they stay.
- **Zoom:** −, Fit and +; Fit is the default and fits the score to its width, never below 10 pixels a second.
- **Keyboard:** each step, comment, sound, effect and card is a button whose name says what it is and when; focus
  shows the same tip as hovering. Left and right arrows move along a line. With focus in the score, `[` and `]` zoom,
  `0` fits, `F` folds.
- **Pictures / Lines only** is remembered in the browser (story decision 007).
