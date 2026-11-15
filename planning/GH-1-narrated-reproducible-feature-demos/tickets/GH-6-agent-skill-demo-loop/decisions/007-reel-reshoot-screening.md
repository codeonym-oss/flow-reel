# 007: Three skills: `reel`, `reshoot` and `screening`

**Date:** 2026-11-15 (re-plan for 0.2, Q2; agreed: "1, reel, reshoot and screening", after "direct-script seems to
be a consufin term! use better term! use cenematography terms here!")

**Question:** besides the all-in skill (decision 006), which skills ship, and what are they called?

**Decision:** **three skills.**

| Skill | Job | Changes files? |
|---|---|---|
| `reel` | A request from start to finish: plan, explore the app, write the script, compose, review, hand over. It picks up from an existing script or reel instead of starting again. | Yes |
| `reshoot` | Feedback on an existing reel ("the zoom is rushed", "add a success sound"): change the script's comments, sounds and effects where the feedback points, compose again, review. | Yes |
| `screening` | Judge a finished reel: `flow-reel verify`, `compare` when there are two reels, playback of the picture and the sound, a list of findings. | No |

The names are film terms, chosen as triggers people recognise; installed they read `flow-reel:reel`,
`flow-reel:reshoot`, `flow-reel:screening`. The skills' own text keeps the `CONTEXT.md` words: script, comment,
sound, effect, compose, reel.

- **Why:** each is a different job: make one, change one, judge one without touching it. "Reshoot" is exact (the
  script changes and the composer shoots it again); "screening" says nothing is changed.
- **Not chosen:** `direct-script` (confusing); `recut` (suggests editing the video file, which flow-reel never
  does); `dailies` (few people know it); `retake` ("take" is an avoided word, and a retake repeats the same shot);
  `final-cut` (it runs on every round of feedback).
