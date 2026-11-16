// The bundled fonts (GH-61 decision 002) and their advance widths, read from the font files, so text drawn by
// drawtext can be placed before it is drawn (drawtext doesn't kern these fonts, so advances add up exactly).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const FONTS_DIR = fileURLToPath(new URL("../../../docker/fonts/", import.meta.url));

const metrics = new Map<string, (codePoint: number) => number>();

// Reads a TrueType font's advance widths in em, through its Windows Unicode BMP cmap (format 4).
function advances(file: string): (codePoint: number) => number {
  const font = readFileSync(join(FONTS_DIR, file));
  const tables = new Map<string, number>();
  for (let i = 0; i < font.readUInt16BE(4); i++) tables.set(font.toString("latin1", 12 + 16 * i, 16 + 16 * i), font.readUInt32BE(20 + 16 * i));
  const units = font.readUInt16BE(tables.get("head")! + 18);
  const longMetrics = font.readUInt16BE(tables.get("hhea")! + 34);
  const hmtx = tables.get("hmtx")!;
  const cmap = tables.get("cmap")!;
  let sub = -1;
  for (let i = 0; i < font.readUInt16BE(cmap + 2); i++) {
    const at = cmap + 4 + 8 * i;
    if (font.readUInt16BE(at) === 3 && font.readUInt16BE(at + 2) === 1) sub = cmap + font.readUInt32BE(at + 4);
  }
  if (sub < 0 || font.readUInt16BE(sub) !== 4) throw new Error(`${file} has no Unicode BMP character map`);
  const segments = font.readUInt16BE(sub + 6) / 2;
  const ends = sub + 14, starts = ends + 2 * segments + 2, deltas = starts + 2 * segments, ranges = deltas + 2 * segments;
  const glyph = (c: number) => {
    for (let i = 0; i < segments; i++) {
      if (c > font.readUInt16BE(ends + 2 * i)) continue;
      const start = font.readUInt16BE(starts + 2 * i);
      if (c < start) return 0;
      const delta = font.readUInt16BE(deltas + 2 * i), range = font.readUInt16BE(ranges + 2 * i);
      if (!range) return (c + delta) & 0xffff;
      const g = font.readUInt16BE(ranges + 2 * i + range + 2 * (c - start));
      return g ? (g + delta) & 0xffff : 0;
    }
    return 0;
  };
  return (c) => font.readUInt16BE(hmtx + 4 * Math.min(c > 0xffff ? 0 : glyph(c), longMetrics - 1)) / units;
}

/** How wide `text` is in `file`'s font, in em; a character the font lacks counts as its missing-glyph box. */
export function advanceEm(file: string, text: string): number {
  if (!metrics.has(file)) metrics.set(file, advances(file));
  const width = metrics.get(file)!;
  return [...text].reduce((n, c) => n + width(c.codePointAt(0)!), 0);
}
