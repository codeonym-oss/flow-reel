import { describe, expect, it } from "vitest";
import { demo, type Step } from "../../src/index.ts";

describe("demo", () => {
  it("returns the options, with the default viewport, and the body, without running it", () => {
    let ran = false;
    const body = async () => { ran = true; };
    const d = demo({ url: "http://localhost:3000" }, body);
    expect(d.options).toEqual({ url: "http://localhost:3000", viewport: [1920, 1080] });
    expect(d.body).toBe(body);
    expect(ran).toBe(false);
  });

  it("keeps a viewport given by the script", () => {
    expect(demo({ url: "http://x", viewport: [1280, 720] }, async () => {}).options.viewport).toEqual([1280, 720]);
  });

  it("only takes narration text as a step's first argument", () => {
    const step: Step = async () => {};
    // @ts-expect-error narration must be a string
    void step(42, async () => {});
    expect(true).toBe(true);
  });
});
