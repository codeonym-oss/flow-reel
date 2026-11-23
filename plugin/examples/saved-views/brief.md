# Brief: saved views in Orbit

- **Audience:** customer — a team lead who checks project progress every week.
- **Takeaway:** "I can save a filtered board and get back to it in one click."
- **App:** http://localhost:4173/ (`node serve.mjs` in this folder) — starting state: all five projects, chart of
  all work, no saved views. Nothing persists: reloading resets it.
- **Runtime:** flow-reel 0.5 or later
- **Settings:** speaker Ryan, language english (`flow-reel.json`)
- **Expected length:** about 30 s

## Scenes

| # | Purpose | Action (observed locator) | Visible result to wait for | Comment | Sound | Effect |
|---|---|---|---|---|---|---|
| 1 | Opening + filter | click `getByRole("button", { name: "Active" })` | three active rows; chart redraws | "Here are this quarter's projects. Let's look at the active ones." | `controls.TOGGLE` on the click | polish |
| 2 | Read the chart | hover `getByRole("region", { name: "Tasks closed per week" })` | chart framed | "The chart follows the filter: active work is picking up every week." | — | `zoomIn`, held until scene 3's first click |
| 3 | Save the view | click `getByRole("button", { name: "Save view" })`, fill `getByLabel("View name")`, click `getByRole("button", { name: "Save", exact: true })` | status "View "Active work" saved" (after 600 ms) | "To come back to this view later, save it." | `navigation.OPEN` on the click; `feedback.SUCCESS` after the status | `.zoomOut()` chained on the Save view click |
| 4 | Payoff | click `getByRole("navigation", { name: "Saved views" }).getByRole("link", { name: "Active work" })` | the link in the sidebar, framed | "It's in the sidebar now, one click away." | — | polish's click zoom (2 s, through the comment's start) |

## Observed

- The filter buttons are a group named "Status"; each has `aria-pressed`.
- Saving waits 600 ms before the toast (`role="status"`) and the sidebar link appear: the script must wait for it.
- The dialog's own "Save" button needs `exact: true` to differ from "Save view".
- Clicking a saved view in the sidebar brings its filter back (the payoff click is real, not decorative).

## Assumed

- None left; all scenes were walked in a browser.
