# 006: The studio's theme: what each color means, type and components

**Date:** 2026-11-26 (agreed: "NICE, APPROVE!" on `prototypes/theme.html`)

**Question:** how do the Dusk colors (decision 005) work in the studio, in dark and light?

**Decision:** **the theme in `prototypes/theme.html`. Dark is the default; light is offered.**

- **Meanings:** emerald is running and done; a yellow line is the playhead, "now"; a solid yellow badge with black text
  is what needs a person; red is only a failure; grey is waiting and stopped. Each state also has its own shape and word,
  so color is never the only sign.
- **Tokens:** `--bg`, `--surface`, `--raised`, `--line`, `--ink`, `--ink2`, `--ink3`, `--yellow`, `--yellow-ink`,
  `--emerald`, `--emerald-ink`, `--fail`, with the values in the page. Every text token passes WCAG AA (4.5:1) on its
  background in both themes. In light, yellow is only a fill under black text, and the emerald fill is `#047857`.
- **Type:** IBM Plex Sans for what people read; JetBrains Mono for time, names from scripts and numbers.
- **Components:** one yellow button per screen for the main action; emerald to carry on a run; tabs underlined in
  yellow; the score's lanes with a yellow playhead.
- **Logo below 24 px:** one turn, no clips.

- **Why:** the person approved the page as shown.
- **Replaces:** the "now" and "needs a person" red of epic decision 024.
