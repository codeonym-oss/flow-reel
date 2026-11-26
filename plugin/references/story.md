# Story: what the reel is for

A reel is short and has one job. Decide it before exploring the app or writing a line of script.

## Three questions first

1. **Who watches it?**
   - A **reviewer** (a pull request, a QA check) wants evidence: the exact change, the before and after, no
     selling. Short, literal comments.
   - A **customer or stakeholder** wants the outcome: why it matters to them, shown on realistic data. Benefit
     first, mechanics second.
   - A **learner** wants to repeat it: every step visible, a slower pace, the names of the controls in the comments.
2. **What is the one takeaway?** One sentence the viewer should be able to say afterwards ("I can save a filtered
   view and get back to it in one click"). If there are two, there are two reels.
3. **Where does it start and end?** A starting state the composer can reach from `url` with a fresh browser, and a
   final frame that shows the result.

Ask the person only what you can't find out and what changes the reel: usually the audience and the takeaway.
Everything about the app, find out by exploring it (`exploring.md`).

## The arc: opening → change → payoff

- **Opening (one scene, 3–6 s):** the context, before anything changes. The viewer must recognise where they are.
  One comment that says what we're about to do, not a welcome speech.
- **Change (one to four scenes):** the feature at work. Each scene has one purpose and one visible result.
- **Payoff (one scene):** the result, held on screen and framed (`direction.md`): the saved item in its list, the
  chart that changed, the success message. End on it; don't navigate away.

Cut everything else: log-in screens, settings that don't matter, a tour of unrelated menus, the same action twice.

## Length

Measured, not set: a reel lasts as long as its actions plus the speech. As a guide, a feature for a reviewer is
15–40 s, a product walkthrough 30–60 s, a tutorial longer but split into reels of under two minutes. A comment of
about 12 words takes about 4 s to say.

## The brief

Write the plan down before the script (template: `../assets/brief.md`). Its heart is the scene table:

| # | Scene's purpose | Action (observed locator) | Visible result | Comment | Sound | Effect |
|---|---|---|---|---|---|---|
| 1 | Opening | — | Projects list, all statuses | "Here are this quarter's projects…" | — | — |
| 2 | Filter | `getByRole("button", { name: "Active" })` click | Only active rows; chart redraws | — | `controls.TOGGLE` | — |
| 3 | Read the chart | hover the chart region | Chart framed | "The chart follows the filter…" | — | `zoomIn` … next scene's `zoomOut` |

Keep what you observed apart from what you assume ("Save is instant": assumed, check while exploring). The
example `../examples/saved-views/reels/saved-views.brief.md` is a complete one.
