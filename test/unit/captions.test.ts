import { describe, expect, it } from "vitest";
import { renderCaptions } from "../../src/runner/captions.ts";

describe("renderCaptions", () => {
  it("writes empty SRT and header-only WebVTT when no cues remain", () => {
    expect(renderCaptions([])).toEqual({ srt: "", vtt: "WEBVTT\n\n" });
    expect(renderCaptions([
      { index: 0, narration: "", startMs: 0, actionEndMs: 1, endMs: 1 },
    ])).toEqual({ srt: "", vtt: "WEBVTT\n\n" });
  });

  it.each([
    [59_999, 60_001, "00:00:59,999 --> 00:01:00,001", "00:00:59.999 --> 00:01:00.001"],
    [3_599_999, 3_600_001, "00:59:59,999 --> 01:00:00,001", "00:59:59.999 --> 01:00:00.001"],
    [360_000_000, 360_000_001, "100:00:00,000 --> 100:00:00,001", "100:00:00.000 --> 100:00:00.001"],
  ])("keeps millisecond precision across timestamp boundaries at %i ms", (startMs, endMs, srtTime, vttTime) => {
    expect(renderCaptions([{ index: 0, narration: "Next.", startMs, actionEndMs: endMs, endMs }])).toEqual({
      srt: `1\n${srtTime}\nNext.\n\n`,
      vtt: `WEBVTT\n\n1\n${vttTime}\nNext.\n\n`,
    });
  });

  it("keeps long narration in one cue without inserting line breaks", () => {
    const narration = "Open the settings page and choose the theme that makes this application easier to read on your display.";
    expect(renderCaptions([
      { index: 0, narration, startMs: 0, actionEndMs: 1000, endMs: 1000 },
    ])).toEqual({
      srt: `1\n00:00:00,000 --> 00:00:01,000\n${narration}\n\n`,
      vtt: `WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\n${narration}\n\n`,
    });
  });

  it("skips missing, blank and nonpositive-duration narration and numbers only emitted cues", () => {
    expect(renderCaptions([
      { index: 0, startMs: 0, actionEndMs: 100, endMs: 100 },
      { index: 1, narration: " \t\r\n", startMs: 100, actionEndMs: 200, endMs: 200 },
      { index: 2, narration: "Instant.", startMs: 200, actionEndMs: 200, endMs: 200 },
      { index: 3, narration: "Backwards.", startMs: 300, actionEndMs: 200, endMs: 200 },
      { index: 4, narration: "Save.", startMs: 400, actionEndMs: 600, endMs: 600 },
    ])).toEqual({
      srt: "1\n00:00:00,400 --> 00:00:00,600\nSave.\n\n",
      vtt: "WEBVTT\n\n1\n00:00:00.400 --> 00:00:00.600\nSave.\n\n",
    });
  });

  it("writes one cue per step on the final video timeline in SRT and WebVTT", () => {
    expect(renderCaptions([
      { index: 0, narration: "Open settings.", startMs: 512, actionEndMs: 1200, endMs: 2401 },
      { index: 1, narration: "Save changes.", startMs: 2500, actionEndMs: 3000, endMs: 3000 },
    ])).toEqual({
      srt: "1\n00:00:00,512 --> 00:00:02,401\nOpen settings.\n\n2\n00:00:02,500 --> 00:00:03,000\nSave changes.\n\n",
      vtt: "WEBVTT\n\n1\n00:00:00.512 --> 00:00:02.401\nOpen settings.\n\n2\n00:00:02.500 --> 00:00:03.000\nSave changes.\n\n",
    });
  });

  it("normalizes caption whitespace and escapes original text once without mutating narration", () => {
    const steps = Object.freeze([Object.freeze({
      index: 0, narration: "  <b>Réglages</b>\r\n\r\n\t & &lt; --> 保存 😀  ",
      startMs: 0, actionEndMs: 1000, endMs: 1000,
    })]);
    const captions = renderCaptions(steps);
    expect(captions).toEqual({
      srt: "1\n00:00:00,000 --> 00:00:01,000\n&lt;b&gt;Réglages&lt;/b&gt; &amp; &amp;lt; --&gt; 保存 😀\n\n",
      vtt: "WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\n&lt;b&gt;Réglages&lt;/b&gt; &amp; &amp;lt; --&gt; 保存 😀\n\n",
    });
    expect(renderCaptions(steps)).toEqual(captions);
    expect(steps[0].narration).toBe("  <b>Réglages</b>\r\n\r\n\t & &lt; --> 保存 😀  ");
  });
});
