import { describe, expect, it } from "vitest";
import { jpegCutter } from "../../src/composer/media/pictures.ts";

// A JPEG's shape: SOI, a segment with its length (holding FF D9, which doesn't end it), SOS, data with escaped FF, EOI.
const jpeg = (fill: number) => Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0xff, 0xd9, 0xff, 0xda, 0x00, 0x02,
  fill, 0xff, 0x00, fill, 0xff, 0xd0, fill, 0xff, 0xd9]);

describe("jpegCutter", () => {
  it("cuts pictures whatever pieces they arrive in", () => {
    const stream = Buffer.concat([Buffer.from("noise"), jpeg(1), jpeg(2), jpeg(3)]);
    for (const size of [1, 3, 7, stream.length]) {
      const got: Buffer[] = [];
      const cut = jpegCutter((picture) => got.push(picture));
      for (let at = 0; at < stream.length; at += size) cut(stream.subarray(at, at + size));
      expect(got).toEqual([jpeg(1), jpeg(2), jpeg(3)]);
    }
  });

  it("skips the end of a picture it joined midway", () => {
    const got: Buffer[] = [];
    jpegCutter((picture) => got.push(picture))(Buffer.concat([jpeg(8).subarray(5), jpeg(9)]));
    expect(got).toEqual([jpeg(9)]);
  });
});
