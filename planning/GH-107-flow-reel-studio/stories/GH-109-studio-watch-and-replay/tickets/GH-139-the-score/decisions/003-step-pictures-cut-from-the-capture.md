# 003: Step pictures are cut from the capture after recording

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** story decision 007 keeps one small picture per step in the run's folder. Where does it come from?

**Decision:** **the record container cuts them from `capture.mp4` once the recording has passed its checks: one JPEG
per step, 320 pixels wide, at the end of the step's action (or 0.5 s in, when the action is shorter), in one ffmpeg
pass, as `steps/000.jpg`… in the record result.** `GET /api/step-picture?run=&step=` serves them. While the script
records and someone watches, the live picture at the moment a step starts stands in, in the browser only. Cutting
them failing is a warning, not a failure.

- **Why:** the grab only runs while watched (story decision 002), so it can't make pictures for every run; the
  capture holds every frame, and ffmpeg runs in the image.
- **Cost, measured** in the image on the check kit's `saved-views` capture (15 s): about 0.9 s and 2.2 CPU seconds
  added to the record phase, after the capture has stopped.
