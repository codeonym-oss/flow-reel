// The public API a script imports (GH-27 decisions 001 and 008; GH-30 decisions 001-005; GH-32 decisions 001-006;
// GH-61; the cards, GH-76 decisions 001-008).
import type { Page } from "playwright";
import type { Sound } from "./composer/schema/events.ts";
import type { FlashOptions, ShowFrameOptions, SkipOptions, ZoomInOptions, ZoomOutOptions } from "./composer/effects.ts";
export { Sounds, type Sound } from "./composer/schema/events.ts";
export type { FlashOptions, ShowFrameOptions, SkipOptions, ZoomInOptions, ZoomOutOptions } from "./composer/effects.ts";
export type { Brand, BrandFonts, ThemeName, Transition } from "./composer/cards/brand.ts";
import type { CardOptions } from "./composer/cards/words.ts";
export type { CardOptions } from "./composer/cards/words.ts";

/** A title card that opens the reel: a kicker above the title, a subtitle below, the brand's logo. */
export interface IntroCard extends CardOptions {
  /** A short line above the title, in the accent colour, such as the product and its version. */
  kicker?: string;
  title: string;
  subtitle?: string;
  /** `left` (the default) or `center`. */
  layout?: "left" | "center";
}
/** A card that opens a part of the reel, numbered by itself: "Chapter 02 / 03". */
export interface ChapterCard extends CardOptions {
  title: string;
  subtitle?: string;
}
/** A card that closes the reel: the title, a link to go to, and a few more links. */
export interface OutroCard extends CardOptions {
  title: string;
  /** Shown as a button, such as "orbit.dev/views". */
  url?: string;
  /** Up to four more, shown quietly under it. */
  links?: string[];
}
/** What `card.custom` passes to the page: `data-prop` elements show them, and `window.flowReel.props` holds them. */
export type CardProps = Record<string, CardProp>;
export type CardProp = string | number | boolean | null | CardProp[] | { [key: string]: CardProp };

/**
 * Cards: each is inserted into the reel where the script awaits it. The app stops on its frame, the card plays with a
 * transition in and out, and the app resumes where it left. A card lasts 3 s, or until the comment before it has been
 * spoken; `ms` sets an exact length. Its look follows the `brand` in flow-reel.json.
 */
export interface Cards {
  /** A title card: `await card.intro({ kicker: "Orbit 2.4", title: "Saved views", subtitle: "…" })`. */
  intro(card: IntroCard): Promise<void>;
  /** A chapter card, numbered among the script's chapters: `await card.chapter({ title: "Save a view" })`. */
  chapter(card: ChapterCard): Promise<void>;
  /** A closing card: `await card.outro({ title: "Try saved views", url: "orbit.dev/views" })`. */
  outro(card: OutroCard): Promise<void>;
  /**
   * A card of your own: an HTML page in the script's folder, with its own CSS, JavaScript, images and fonts, drawn on
   * a frozen clock with the network off. `data-prop="name"` elements show `props.name`, `window.flowReel` holds the
   * props, the theme and the duration, and the flow-reel atoms (`fr-*` classes, `--fr-*` colours) are always there.
   * `await card.custom("cards/pricing.html", { plan: "Team", price: "$12" })`.
   */
  custom(page: string, props?: CardProps, options?: CardOptions): Promise<void>;
}

declare module "playwright-core" {
  interface Locator {
    /** Speaks `text` as this element's step: the step opens with the next action. */
    comment(text: string): Locator;
    /** Plays `sound` when this locator's next action happens. */
    sound(sound: Sound): Locator;
    /** Flashes the screen when this locator's next action happens. */
    flash(options?: FlashOptions): Locator;
    /** Zooms in on this element as the pointer heads for it; the zoom holds until `zoomOut`. */
    zoomIn(options?: ZoomInOptions): Locator;
    /** Zooms back out to the full screen after this locator's next action. */
    zoomOut(options?: ZoomOutOptions): Locator;
  }
}

export interface ScriptOptions {
  /** Where the script starts: the URL the agent used while exploring. */
  url: string;
  /** CSS pixels; the composer records at device scale 4/3. */
  viewport?: [width: number, height: number];
  /** False turns automatic zoom off; the cursor, the click ripple and `zoomIn` still work. True by default. */
  autoZoom?: boolean;
}

export interface ScriptContext {
  page: Page;
  /** Speaks `text`. It opens a step, which starts with the next action; not awaited. */
  comment(text: string): void;
  /** Plays `sound` at this moment. */
  sound(sound: Sound): void;
  /** Flashes the screen at this moment. */
  flash(options?: FlashOptions): void;
  /**
   * Shows `image` (a PNG, JPEG or WebP in the script's folder, relative to the script) for `ms` milliseconds, inserted
   * into the video; the app is shown again exactly where it was. An action of its step.
   */
  showFrame(image: string, ms: number, options?: ShowFrameOptions): Promise<void>;
  /** Zooms in on wherever the pointer is; the zoom holds until `zoomOut`, and automatic zoom waits meanwhile. */
  zoomIn(options?: ZoomInOptions): void;
  /** Zooms back out to the full screen. */
  zoomOut(options?: ZoomOutOptions): void;
  /**
   * Runs `fn` as one action, played `factor` times faster in the video (above 1, at most 16), with a "▶▶ ×N" badge in
   * the top-right corner. For waits: only actions, sounds, `flash` and zoom go inside; `comment`, `showFrame` and
   * another `speedUp` or a `skip` throw. A comment spoken over it keeps its normal speed.
   */
  speedUp(factor: number, fn: () => Promise<unknown>): Promise<void>;
  /**
   * Runs `fn` as one action, cut from the video: a card over the blurred last frame shows "38 s skipped" instead, for
   * at least 1.5 s or until the comment spoken over it ends. `label` replaces the words; `{duration}` in it shows the
   * length cut. The card follows the brand, as a clock ring (the default) or a bar along the bottom (`style: "bar"`).
   * For waits: only actions and sounds go inside, and nothing of them is seen or heard; `comment`, `showFrame`,
   * `flash`, zoom, `speedUp`, a card and another `skip` throw.
   */
  skip(fn: () => Promise<unknown>, options?: SkipOptions): Promise<void>;
  /** The cards: `await card.intro({ title: "…" })`, `card.chapter`, `card.outro`, `card.custom`. */
  card: Cards;
}

export type ScriptBody = (context: ScriptContext) => Promise<void>;

export interface Script {
  options: Required<ScriptOptions>;
  body: ScriptBody;
}

/** Describes a script; the composer composes it. */
export function script(options: ScriptOptions, body: ScriptBody): Script {
  return { options: { viewport: [1920, 1080], autoZoom: true, ...options }, body };
}
