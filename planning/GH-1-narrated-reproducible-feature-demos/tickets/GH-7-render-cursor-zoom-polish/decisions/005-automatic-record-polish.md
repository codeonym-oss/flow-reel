# 005: Record automatically renders polish with existing FFmpeg

**Date:** 2026-11-11 (ticket pass, Q5; agreed: "ok")

**Question:** render polish automatically in record alone, or also add a separate polish command?

**Decision:** **render polish automatically as part of `record`**, using the existing FFmpeg installation and a separate pure camera planner. Preserve the clean retimed master for subsequent work. Keep GH-5's delivery frame count, narration placement, transcript times and caption times unchanged. Verify repeated renders by comparing decoded video frames on the same image. Do not add CLI controls, a separate polish command, or rendering dependencies.

- **Why:** one command produces the finished demo, with deterministic behavior testable independently from recording and TTS.
- **Not chosen:** a separate polish command (additional CLI and input-validation scope); another rendering stack (unneeded dependencies).
