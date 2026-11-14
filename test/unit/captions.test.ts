import { describe, expect, it } from "vitest";
import { renderCaptions } from "../../src/composer/captions.ts";

describe("renderCaptions", () => {
  it("writes empty SRT and header-only WebVTT when no cues remain", () => {
    expect(renderCaptions([])).toEqual({ srt: "", vtt: "WEBVTT\n\n" });
    expect(renderCaptions([
      { index: 0, comment: "", startMs: 0, actionEndMs: 1, endMs: 1 },
    ])).toEqual({ srt: "", vtt: "WEBVTT\n\n" });
  });

  it.each([
    [59_999, 60_001, "00:00:59,999 --> 00:01:00,001", "00:00:59.999 --> 00:01:00.001"],
    [3_599_999, 3_600_001, "00:59:59,999 --> 01:00:00,001", "00:59:59.999 --> 01:00:00.001"],
    [360_000_000, 360_000_001, "100:00:00,000 --> 100:00:00,001", "100:00:00.000 --> 100:00:00.001"],
  ])("keeps millisecond precision across timestamp boundaries at %i ms", (startMs, endMs, srtTime, vttTime) => {
    expect(renderCaptions([{ index: 0, comment: "Next.", startMs, actionEndMs: endMs, endMs }])).toEqual({
      srt: `1\n${srtTime}\nNext.\n\n`,
      vtt: `WEBVTT\n\n1\n${vttTime}\nNext.\n\n`,
    });
  });

  it("keeps a long comment in one cue without inserting line breaks", () => {
    const comment = "Open the settings page and choose the theme that makes this application easier to read on your display.";
    expect(renderCaptions([
      { index: 0, comment, startMs: 0, actionEndMs: 1000, endMs: 1000 },
    ])).toEqual({
      srt: `1\n00:00:00,000 --> 00:00:01,000\n${comment}\n\n`,
      vtt: `WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\n${comment}\n\n`,
    });
  });

  it("skips missing, blank and nonpositive-duration comment and numbers only emitted cues", () => {
    expect(renderCaptions([
      { index: 0, startMs: 0, actionEndMs: 100, endMs: 100 },
      { index: 1, comment: " \t\r\n", startMs: 100, actionEndMs: 200, endMs: 200 },
      { index: 2, comment: "Instant.", startMs: 200, actionEndMs: 200, endMs: 200 },
      { index: 3, comment: "Backwards.", startMs: 300, actionEndMs: 200, endMs: 200 },
      { index: 4, comment: "Save.", startMs: 400, actionEndMs: 600, endMs: 600 },
    ])).toEqual({
      srt: "1\n00:00:00,400 --> 00:00:00,600\nSave.\n\n",
      vtt: "WEBVTT\n\n1\n00:00:00.400 --> 00:00:00.600\nSave.\n\n",
    });
  });

  it("writes one cue per step on the final video timeline in SRT and WebVTT", () => {
    expect(renderCaptions([
      { index: 0, comment: "Open settings.", startMs: 512, actionEndMs: 1200, endMs: 2401 },
      { index: 1, comment: "Save changes.", startMs: 2500, actionEndMs: 3000, endMs: 3000 },
    ])).toEqual({
      srt: "1\n00:00:00,512 --> 00:00:02,401\nOpen settings.\n\n2\n00:00:02,500 --> 00:00:03,000\nSave changes.\n\n",
      vtt: "WEBVTT\n\n1\n00:00:00.512 --> 00:00:02.401\nOpen settings.\n\n2\n00:00:02.500 --> 00:00:03.000\nSave changes.\n\n",
    });
  });

  it("normalizes caption whitespace and escapes original text once without mutating comment", () => {
    const steps = Object.freeze([Object.freeze({
      index: 0, comment: "  <b>Réglages</b>\r\n\r\n\t & &lt; --> 保存 😀  ",
      startMs: 0, actionEndMs: 1000, endMs: 1000,
    })]);
    const captions = renderCaptions(steps);
    expect(captions).toEqual({
      srt: "1\n00:00:00,000 --> 00:00:01,000\n&lt;b&gt;Réglages&lt;/b&gt; &amp; &amp;lt; --&gt; 保存 😀\n\n",
      vtt: "WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\n&lt;b&gt;Réglages&lt;/b&gt; &amp; &amp;lt; --&gt; 保存 😀\n\n",
    });
    expect(renderCaptions(steps)).toEqual(captions);
    expect(steps[0].comment).toBe("  <b>Réglages</b>\r\n\r\n\t & &lt; --> 保存 😀  ");
  });
});

it("serializes fractional frame times as valid millisecond timestamps across second boundaries", () => {
  const captions = renderCaptions([{ index: 0, comment: "Held.", startMs: 999.7, actionEndMs: 1100, endMs: 1733.333333 }]);
  expect(captions.srt).toContain("00:00:01,000 --> 00:00:01,733");
  expect(captions.vtt).toContain("00:00:01.000 --> 00:00:01.733");
});
