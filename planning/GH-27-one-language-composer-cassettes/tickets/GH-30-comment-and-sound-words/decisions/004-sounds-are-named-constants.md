# 004: Sounds are named by constants exported from flow-reel

**Date:** 2026-11-14 (ticket pass, after Q3; asked by the person: "for the sounds, instead of "sound", lets use
constants such as sound(Sounds.buttons.SUCCESS) (imported from the flow-reel)")

**Question:** how does a script name a sound?

**Decision:** **with a constant from the `Sounds` object exported by `flow-reel`, grouped**:
`sound(Sounds.<group>.<NAME>)`, standalone or chained. The word `sound` stays; its argument is a constant. The
constant's value is the sound's name, which is what the event log records.

- **Why:** the person's choice: discoverable through autocomplete, grouped, and no free-form strings in scripts.
- **Open:** the groups; Q4.
- **Changes:** decision 001's `sound("success")` examples become `sound(Sounds.<group>.SUCCESS)`.
