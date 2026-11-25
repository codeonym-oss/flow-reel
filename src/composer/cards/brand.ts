// The brand (GH-76 decision 006): the themes every card and overlay is drawn in, and the `brand` block of
// `flow-reel.json` that picks one, its accent, a logo, fonts and the default transitions. Imports nothing heavy: the
// host checks `flow-reel.json` with it too.
import { statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

/** A card's colours: its background, a raised surface, hairlines, text, quieter text, the accent and text on it. */
export interface Theme { bg: string; surface: string; line: string; fg: string; muted: string; accent: string; onAccent: string }

export const THEMES = {
  ink: { bg: "#0b0d12", surface: "#13161d", line: "#242935", fg: "#f2f4f7", muted: "#98a2b3", accent: "#6e9bff", onAccent: "#0b0d12" },
  paper: { bg: "#f6f5f1", surface: "#ffffff", line: "#e4e1d8", fg: "#14161b", muted: "#596070", accent: "#2b59d9", onAccent: "#ffffff" },
  ocean: { bg: "#08222c", surface: "#0e2f3b", line: "#1b4655", fg: "#e8f5f7", muted: "#9bc2ca", accent: "#46d3c8", onAccent: "#04191f" },
  ember: { bg: "#17100d", surface: "#241914", line: "#3d2c24", fg: "#fff3ea", muted: "#d0b2a1", accent: "#ff8f57", onAccent: "#17100d" },
} as const satisfies Record<string, Theme>;
export type ThemeName = keyof typeof THEMES;
export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

/** How a card comes in and goes out, and how long each takes (GH-76 decision 005). */
export const TRANSITIONS = { fade: 400, slide: 500, wipe: 500, zoom: 450, blur: 500, iris: 600, cut: 0 } as const;
export type Transition = keyof typeof TRANSITIONS;
export const TRANSITION_NAMES = Object.keys(TRANSITIONS) as Transition[];

export interface BrandFonts {
  /** A font file (WOFF2, WOFF, TTF or OTF) for titles; Inter Tight by default. */
  heading?: string;
  /** A font file for the rest of the text; Inter by default. */
  body?: string;
}
/** The `brand` block of `flow-reel.json`. Paths are relative to the scripts folder (GH-108 decision 002). */
export interface Brand {
  /** The theme cards use unless one sets its own; `ink` by default. */
  theme?: ThemeName;
  /** `#rrggbb`, replacing the theme's accent. */
  accent?: string;
  /** An image (SVG, PNG, JPEG or WebP) cards show where they have a logo. */
  logo?: string;
  fonts?: BrandFonts;
  /** How cards come in, unless one says otherwise; `fade` by default. */
  enter?: Transition;
  /** How cards go out, unless one says otherwise; `fade` by default. */
  exit?: Transition;
}

const HEX = /^#[0-9a-f]{6}$/i;
const LOGO_TYPES = [".svg", ".png", ".jpg", ".jpeg", ".webp"];
const FONT_TYPES = [".woff2", ".woff", ".ttf", ".otf"];
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const list = (names: readonly string[]) => names.map((n) => JSON.stringify(n)).join(", ");

/** The problems with a `brand` block, each starting with where it is. */
export function validateBrand(value: unknown): string[] {
  if (!isObject(value)) return ["brand must be an object"];
  const errors: string[] = [];
  const keys = ["theme", "accent", "logo", "fonts", "enter", "exit"];
  const extra = Object.keys(value).find((k) => !keys.includes(k));
  if (extra) errors.push(`brand: unknown key ${JSON.stringify(extra)}; it takes ${keys.join(", ")}`);
  if (value.theme !== undefined && !THEME_NAMES.includes(value.theme as ThemeName)) {
    errors.push(`brand.theme must be one of ${list(THEME_NAMES)}`);
  }
  if (value.accent !== undefined && (typeof value.accent !== "string" || !HEX.test(value.accent))) {
    errors.push("brand.accent must be a #rrggbb colour");
  }
  if (value.logo !== undefined && (typeof value.logo !== "string" || !LOGO_TYPES.includes(extname(value.logo).toLowerCase()))) {
    errors.push("brand.logo must be the path of an SVG, PNG, JPEG or WebP image");
  }
  for (const key of ["enter", "exit"]) {
    if (value[key] !== undefined && !TRANSITION_NAMES.includes(value[key] as Transition)) {
      errors.push(`brand.${key} must be one of ${list(TRANSITION_NAMES)}`);
    }
  }
  if (value.fonts !== undefined) {
    if (!isObject(value.fonts)) errors.push("brand.fonts must be an object");
    else {
      const extraFont = Object.keys(value.fonts).find((k) => k !== "heading" && k !== "body");
      if (extraFont) errors.push(`brand.fonts: unknown key ${JSON.stringify(extraFont)}; it takes heading, body`);
      for (const key of ["heading", "body"]) {
        const font = value.fonts[key];
        if (font !== undefined && (typeof font !== "string" || !FONT_TYPES.includes(extname(font).toLowerCase()))) {
          errors.push(`brand.fonts.${key} must be the path of a WOFF2, WOFF, TTF or OTF font`);
        }
      }
    }
  }
  return errors;
}

/** Where files named by a script are: paths are relative to `dir`, the script's own folder, and stay inside `root`. */
export interface ScriptFiles {
  /** The scripts folder, the only one the composer has (GH-108 decision 002). */
  root: string;
  dir: string;
}

/**
 * A file a script or the brand names, checked: relative, inside the scripts folder and there. Returns its path relative
 * to the scripts folder, with forward slashes. `who` names the word, for the error.
 */
export function scriptFile({ root, dir }: ScriptFiles, path: unknown, who: string, types?: readonly string[]): { file: string; inside: string } {
  if (typeof path !== "string" || !path) throw new Error(`${who} takes a file's path, relative to the script`);
  if (isAbsolute(path)) throw new Error(`${who}: ${path} must be relative to the script's folder, not absolute`);
  const file = resolve(dir, path);
  const inside = relative(root, file);
  if (!inside || inside.startsWith("..") || isAbsolute(inside)) {
    throw new Error(`${who}: ${path} is outside the scripts folder; only that folder is available to the composer`);
  }
  if (types && !types.includes(extname(file).toLowerCase())) {
    throw new Error(`${who}: ${path} must be a ${types.map((t) => t.slice(1).toUpperCase()).join(", ")} file`);
  }
  if (!statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error(`${who}: ${path} doesn't exist`);
  return { file, inside: inside.split(sep).join("/") };
}

/** Checks that the brand's logo and fonts exist inside the scripts folder; call it before composing. */
export function checkBrandFiles(scriptsDir: string, brand: Brand): void {
  const files = { root: scriptsDir, dir: scriptsDir };
  if (brand.logo) scriptFile(files, brand.logo, "brand.logo", LOGO_TYPES);
  for (const key of ["heading", "body"] as const) {
    if (brand.fonts?.[key]) scriptFile(files, brand.fonts[key], `brand.fonts.${key}`, FONT_TYPES);
  }
}

/** A theme with the brand's accent, and text on the accent that reads against it. */
export function themeFor(name: ThemeName, brand: Brand = {}): Theme {
  const theme: Theme = { ...THEMES[name] };
  if (brand.accent) {
    theme.accent = brand.accent.toLowerCase();
    theme.onAccent = luminance(theme.accent) > 0.4 ? "#0b0d12" : "#ffffff";
  }
  return theme;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
