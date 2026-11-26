# Scripts in the studio

## Problem

Starting a run, and seeing a script's last reel, needs the terminal.

## Change

- **Scripts** from the mockup: each script with its steps, comments, sounds, effects, cards, its last reel and its state;
  opening one by path; the script shown read only, with the lines changed since the last reel.
- **Run** starts a compose as `flow-reel compose --detach` would.
- **Run again on save,** off by default.

## Done when

- Run starts a run that shows up in the terminal's `flow-reel runs` too.
- Run again on save starts one run per save, and never two at once for one script.
