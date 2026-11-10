# 012: Polish (cursor, click ripple, zoom on click, follow cursor, SFX) is part of this story

**Partly superseded by GH-2 decision 005** (the master is 1440p at device scale 4/3, not 4K at scale 2).

**Date:** 2026-11-02 (GH-2 ticket pass, Q2; asked: "i need something good, lets a tool that offers SFX , zoom on
click, follow cursor etc ....", agreed: "ok")

**Supersedes 003** (its "polish is a later story" line) **and 007** (the five-ticket split).

**Question:** polish was out of v1; the person wants demos that look good. Does it come into this story?

**Decision:** **yes.** Recording stays clean and polish is rendered in post from an event log:

- GH-2 also writes an **event log** (pointer positions, clicks, keystrokes, with timestamps on the step clock),
  captures at **device scale 2** (3840×2160, output 1080p) so zooms stay sharp, and moves the mouse along **eased
  paths** so hover states show.
- Two tickets are added after GH-5: **render polish** (synthetic cursor, click ripple, zoom on click, follow cursor)
  and **SFX** (click and typing sounds, mixed under the voice).
- Posting demos on pull requests stays out of this story.

- **Why:** Playwright's input never moves a real cursor, so without a drawn cursor the video shows clicks with no
  pointer; once the cursor is drawn in post, ripple, zoom and follow come cheaply. No headless off-the-shelf tool does
  this (Screen Studio is a macOS GUI; Cap and OpenScreen are desktop recorders).
- **Not chosen:** a later story with GH-2 preparing for it (demos without a cursor until then); Remotion for the polish
  layer (company licence above three people, a heavy React render stack in the image).
