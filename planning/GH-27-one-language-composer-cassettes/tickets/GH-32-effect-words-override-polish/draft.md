# Direct the picture with effect words that override automatic polish

## Problem

The picture is polished automatically (cursor, click ripple, zoom on click, follow). A script cannot flash the
screen, hold a still image, or decide where the camera zooms.

## Change

Add the effect family to the script language: flash, show frame (an image for a duration), zoom in and zoom out,
standalone or chained. Automatic polish stays the default; an explicit zoom takes over the camera for its step, and
a script-level setting turns automatic zoom off (story decisions 002, 003). Effects are rendered in post from the
event log, like today's polish.

## Out of scope

Intro and outro cards, burned-in captions, background music, transitions between scripts.

## Done when

- Each effect is visible in a composed fixture and checked by a test on the rendered video or the event log.
- A script without effect words renders as before this ticket.
- The rule for explicit zoom against automatic zoom is documented and tested, including the off switch.
- Composing the same script twice gives the same effect timings.

## For the ticket pass

Each effect's parameters, how show frame affects the timeline (pause the action or overlay it), and image inputs.
