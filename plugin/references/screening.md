# Screening: judging a reel honestly

Screening says what is right and wrong with a reel, and how each finding was checked. It changes nothing.

## Three kinds of evidence, never mixed

| Evidence | How | What it proves | What it doesn't |
|---|---|---|---|
| **Files** | `npx flow-reel verify <reel>` | Every file the manifest lists is there, unchanged; nothing extra. | That the video shows the right thing, or sounds right. |
| **Pictures** | `node <plugin>/scripts/stills.mjs <reel> --to <dir>`, then look at `contact-sheet.png` and the frames | What is on screen at each step's start and end: framing, zoom, the payoff, cut-off UI. | Motion between stills, timing feel, sound. |
| **Playback** | Watching and listening to `video.mp4`, yourself or a person | Pace, sound, speech quality, whether it's good. | Anything, if nobody actually played it. |

**Same reel twice:** `npx flow-reel compare a.reel b.reel` checks steps, comments, the voice, audio hashes, step
starts within ±150 ms and effects. Use it to show a reshoot changed only what it meant to, or that a script
composes the same way twice on the same machine. It does not compare pixels, sounds or MP4 bytes, and comparing a
reel with itself proves nothing.

If you can't look at images, say the pictures weren't checked. If nobody played the video, say playback is pending,
and ask for it. Never report "looks great" from file checks alone.

## The rubric

Go through the stills in order with the brief's scene table beside them.

**Story**
- The first still shows the starting state the brief describes; the viewer can tell where they are.
- Each scene's end still shows its visible result.
- The last still shows the payoff, on screen and readable. The reel doesn't end on a navigation or a blank state.

**Picture**
- Zooms frame their targets whole; nothing important is cut at the edges.
- A zoom meant to hold through a comment is still on at that step's end still (a standalone `zoomOut` between
  scenes ends it early; `direction.md`).
- No cookie banner, tour, error overlay or loading spinner where a result should be.
- No wait of more than a few seconds plays in real time; a `skip` card's words fit and read (`events.json` lists
  each `speed` and `skip`).
- Typed values are short and readable; the data looks real.

**Comments** (`transcript.json`, `captions.vtt`)
- Each comment matches what its scene shows; none describes something not on screen.
- No step is much longer than its actions (a comment too long for its scene): compare `endMs - startMs` with
  `actionEndMs - startMs`.

**Sound** (`events.json`)
- Each `sound` event comes after the result it marks; no two at the same moment; no more than a few in the reel.

**Playback** (when possible)
- Speech is clear and complete; nothing is cut off.
- The pace feels right for the audience; sounds sit under the voice.

## Writing the findings

For each finding: the step number, what is wrong, how it was checked (files, stills, events, playback), and the
change that would fix it, in the script's words ("step 3: the zoom ends before the comment; zoom out at step 4's
start instead"). Group them: must fix, should fix, fine as is. End with what wasn't checked.
