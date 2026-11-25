// The `card` words a script calls (GH-76 decisions 001, 002 and 005): each checks its props and options where the
// script calls it and becomes a card event; the brand fills in what the card doesn't say.
import { type Brand, THEME_NAMES, TRANSITION_NAMES, type ScriptFiles, type ThemeName, type Transition, scriptFile } from "./brand.ts";
import { checkCustomProps, checkProps, fileHash } from "./catalog.ts";
import type { CardEvent, CardWord } from "../schema/events.ts";

/** What every card takes besides its props. */
export interface CardOptions {
  /** Exactly how long the card shows, in milliseconds, transitions included; by default 3 s, or until its comment ends. */
  ms?: number;
  /** How the card comes in; the brand's, or `fade`, by default. */
  enter?: Transition;
  /** How the card goes out; the brand's, or `fade`, by default. */
  exit?: Transition;
  /** The card's theme; the brand's, or `ink`, by default. */
  theme?: ThemeName;
}
export const OPTION_KEYS = ["ms", "enter", "exit", "theme"] as const;

const list = (names: readonly string[]) => names.map((n) => JSON.stringify(n)).join(", ");

/** Checks a card's options and fills in the brand's; `word` names the card in errors. */
export function cardOptions(word: string, value: Record<string, unknown>, brand: Brand): Pick<CardEvent, "ms" | "enter" | "exit" | "theme"> {
  const { ms, enter = brand.enter ?? "fade", exit = brand.exit ?? "fade", theme = brand.theme ?? "ink" } = value;
  if (ms !== undefined && (typeof ms !== "number" || !Number.isFinite(ms) || ms < 500 || ms > 60_000)) {
    throw new Error(`${word}: ms must be a number of milliseconds from 500 to 60000, got ${JSON.stringify(ms)}`);
  }
  for (const [key, v] of [["enter", enter], ["exit", exit]] as const) {
    if (!TRANSITION_NAMES.includes(v as Transition)) throw new Error(`${word}: ${key} must be one of ${list(TRANSITION_NAMES)}, got ${JSON.stringify(v)}`);
  }
  if (!THEME_NAMES.includes(theme as ThemeName)) throw new Error(`${word}: theme must be one of ${list(THEME_NAMES)}, got ${JSON.stringify(theme)}`);
  return { ...(ms === undefined ? {} : { ms: ms as number }), enter: enter as Transition, exit: exit as Transition, theme: theme as ThemeName };
}

const pick = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.fromEntries(Object.entries(value).filter(([k]) => keys.includes(k)));

/** A checked call of `card.<word>(…)`: the card event without its time. */
export function cardRequest(word: CardWord, args: readonly unknown[], files: ScriptFiles, brand: Brand): Omit<CardEvent, "t"> {
  if (word === "custom") {
    const [path, props, options] = args;
    const who = "card.custom()";
    const { file, inside } = scriptFile(files, path, who, [".html", ".htm"]);
    if (options !== undefined && (typeof options !== "object" || options === null || Array.isArray(options))) {
      throw new Error(`${who} takes its options as an object, after the props: card.custom("${inside}", { … }, { ms: 4000 })`);
    }
    const o = (options ?? {}) as Record<string, unknown>;
    const unknown = Object.keys(o).find((k) => !(OPTION_KEYS as readonly string[]).includes(k));
    if (unknown) throw new Error(`${who}: unknown option ${JSON.stringify(unknown)}; it takes ${OPTION_KEYS.join(", ")}`);
    return { type: "card", card: word, props: checkCustomProps(props), files: [{ path: inside, sha256: fileHash(file) }], ...cardOptions(who, o, brand) };
  }
  let value = args[0];
  if (word === "image") {
    // The image first, as the word reads: card.image("shots/app.png", { title: "…" }).
    if (typeof args[0] !== "string") throw new Error('card.image() takes the image\'s path first: card.image("shots/app.png", { title: "…" })');
    if (args.length > 2) throw new Error("card.image() takes the image's path and one object, with its props and options together");
    if (args[1] !== undefined && (typeof args[1] !== "object" || args[1] === null || Array.isArray(args[1]))) {
      throw new Error('card.image() takes its props and options as an object, after the path: card.image("shots/app.png", { frame: "phone" })');
    }
    value = { ...(args[1] as object | undefined), image: args[0] };
  } else if (args.length > 1) throw new Error(`card.${word}() takes one object, with its props and options together`);
  const checked = checkProps(word, value, files, OPTION_KEYS);
  return { type: "card", card: word, ...checked, ...cardOptions(`card.${word}()`, pick(value as Record<string, unknown>, OPTION_KEYS), brand) };
}

/** The `card` object a script receives: one awaited word per card, each handing its arguments to `show`. */
export function cardWords(show: (word: CardWord, args: unknown[]) => Promise<void>) {
  return {
    intro: (...args: unknown[]) => show("intro", args),
    chapter: (...args: unknown[]) => show("chapter", args),
    feature: (...args: unknown[]) => show("feature", args),
    image: (...args: unknown[]) => show("image", args),
    compare: (...args: unknown[]) => show("compare", args),
    outro: (...args: unknown[]) => show("outro", args),
    custom: (...args: unknown[]) => show("custom", args),
  };
}
