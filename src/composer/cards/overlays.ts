// Overlays (GH-76 decision 007): a callout and a highlight spotlight an element of the app and are drawn on the app,
// so they move with the camera; a lower third is drawn on the screen and stays put. Each shows from its moment until
// the script's next action, through the hold that lets its step's comment finish.
import { THEME_NAMES, type ThemeName } from "./brand.ts";
import { esc } from "./page.ts";
import type { Bounds, OverlayKind } from "../schema/events.ts";

/** What every overlay takes besides its words. */
export interface OverlayOptions {
  /** How long the script waits with it shown, at least, in milliseconds; 1500 by default. */
  ms?: number;
  /** Its theme; the brand's, or `ink`, by default. */
  theme?: ThemeName;
}
export const OVERLAY_MS = 1500;
// How long an overlay takes to come in and to go, in milliseconds.
export const OVERLAY_IN_MS = 700;
export const OVERLAY_OUT_MS = 350;

/** Where an overlay is drawn: on the app (it moves with the camera) or on the screen. */
export const LAYER: Record<OverlayKind, "app" | "screen"> = { callout: "app", highlight: "app", lowerThird: "screen" };

const isText = (v: unknown) => typeof v === "string" && v.trim() !== "";

/** Checks an overlay's words and options where the script calls it; `word` names it in errors. */
export function overlayRequest(kind: OverlayKind, word: string, props: Record<string, unknown>, value: unknown, brand: { theme?: ThemeName }):
  { props: Record<string, unknown>; ms: number; theme: ThemeName } {
  if (value !== undefined && (typeof value !== "object" || value === null || Array.isArray(value))) throw new Error(`${word} takes an options object`);
  const o = { ...(value as Record<string, unknown> | undefined) };
  const keys = kind === "callout" ? ["detail", "ms", "theme"] : kind === "lowerThird" ? ["title", "subtitle", "ms", "theme"] : ["ms", "theme"];
  const unknown = Object.keys(o).find((k) => !keys.includes(k));
  if (unknown) throw new Error(`${word}: unknown option ${JSON.stringify(unknown)}; it takes ${keys.join(", ")}`);
  const checked: Record<string, unknown> = { ...props };
  for (const key of ["detail", "title", "subtitle"]) {
    if (o[key] === undefined) continue;
    if (!isText(o[key])) throw new Error(`${word}: ${key} must be non-empty text, got ${JSON.stringify(o[key])}`);
    checked[key] = o[key];
  }
  if (kind === "callout" && !isText(checked.text)) throw new Error(`${word} takes the words to show, as in callout("The chart follows the filter")`);
  if (kind === "lowerThird" && !isText(checked.title)) throw new Error(`${word} needs a title, as in lowerThird({ title: "Saved views" })`);
  const ms = o.ms ?? OVERLAY_MS;
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 500 || ms > 60_000) {
    throw new Error(`${word}: ms must be a number of milliseconds from 500 to 60000, got ${JSON.stringify(o.ms)}`);
  }
  const theme = o.theme ?? brand.theme ?? "ink";
  if (!THEME_NAMES.includes(theme as ThemeName)) {
    throw new Error(`${word}: theme must be one of ${THEME_NAMES.map((t) => JSON.stringify(t)).join(", ")}, got ${JSON.stringify(theme)}`);
  }
  return { props: checked, ms, theme: theme as ThemeName };
}

const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="var(--fr-on-accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M4 18l5-6 4 3 7-9"/></svg>`;

// Each overlay comes in, holds, and goes in its last OVERLAY_OUT_MS: the exit's delay is the duration less that.
const STYLE = `<style>
html,body,.fr-overlay{background:transparent!important}
.fr-overlay{position:fixed;inset:0;overflow:hidden;animation:fr-out ${OVERLAY_OUT_MS}ms ease-in calc(var(--fr-duration) - ${OVERLAY_OUT_MS}ms) both}
@keyframes fr-out{to{opacity:0}}
.spot{position:absolute;border-radius:1rem;box-shadow:0 0 0 .2rem var(--fr-accent),0 0 0 .7rem color-mix(in srgb,var(--fr-accent) 28%,transparent),
  0 0 0 200rem color-mix(in srgb,#06080c 58%,transparent);animation:spot .6s cubic-bezier(.2,.7,.2,1) both}
@keyframes spot{from{opacity:0;transform:scale(1.12)}to{opacity:1;transform:none}}
.bubble{position:absolute;display:flex;gap:1.1rem;align-items:flex-start;max-width:36rem;padding:1.3rem 1.7rem 1.4rem 1.3rem;border-radius:1.1rem;
  background:var(--fr-bg);color:var(--fr-fg);box-shadow:0 0 0 1px var(--fr-line),0 1.6rem 4rem rgba(0,0,0,.4);animation:rise .55s cubic-bezier(.2,.7,.2,1) .2s both}
@keyframes rise{from{opacity:0;transform:translateY(var(--rise))}to{opacity:1;transform:none}}
.bubble i{flex:none;width:2.4rem;height:2.4rem;border-radius:.7rem;background:var(--fr-accent);display:flex;align-items:center;justify-content:center}
.bubble i svg{width:1.4rem;height:1.4rem}
.bubble b{display:block;font-family:var(--fr-font-heading);font-size:1.7rem;line-height:1.2;letter-spacing:-.02em}
.bubble span{display:block;margin-top:.35rem;font-size:1.2rem;line-height:1.35;color:var(--fr-muted)}
.bubble::before{content:"";position:absolute;left:var(--tip);width:1.2rem;height:1.2rem;background:var(--fr-bg);transform:rotate(45deg);border-radius:.2rem}
.bubble.below::before{top:-.5rem}.bubble.above::before{bottom:-.5rem}
.third{position:absolute;left:3.6rem;bottom:3.6rem;display:flex;gap:1.3rem;align-items:stretch;padding:1.3rem 2.2rem 1.4rem 1.3rem;border-radius:1.1rem;
  background:var(--fr-bg);color:var(--fr-fg);box-shadow:0 0 0 1px var(--fr-line),0 1.6rem 4rem rgba(0,0,0,.35);animation:slide .6s cubic-bezier(.2,.7,.2,1) both}
@keyframes slide{from{opacity:0;transform:translateX(-3rem)}to{opacity:1;transform:none}}
.third i{width:.35rem;border-radius:1rem;background:var(--fr-accent);transform-origin:bottom;animation:grow .5s cubic-bezier(.6,0,.2,1) .15s both}
@keyframes grow{from{transform:scaleY(0)}to{transform:none}}
.third b{display:block;font-family:var(--fr-font-heading);font-size:2rem;letter-spacing:-.02em}
.third span{display:block;margin-top:.2rem;font-size:1.25rem;color:var(--fr-muted)}
</style>`;

/**
 * An overlay's body. `bounds` is the element, in CSS pixels of a `viewport`-sized page; the bubble goes below it, or
 * above when there is more room there, and stays on the screen.
 */
export function overlayBody(kind: OverlayKind, props: Record<string, unknown>, viewport: [number, number], bounds?: Bounds): string {
  if (kind === "lowerThird") {
    return `${STYLE}<div class="fr-overlay"><div class="third"><i></i><div><b>${esc(props.title)}</b>${props.subtitle ? `<span>${esc(props.subtitle)}</span>` : ""}</div></div></div>`;
  }
  const [width, height] = viewport;
  const b = bounds ?? { x: width / 2 - 1, y: height / 2 - 1, width: 2, height: 2 };
  const pad = 8;
  const spot = `<div class="spot" style="left:${b.x - pad}px;top:${b.y - pad}px;width:${b.width + 2 * pad}px;height:${b.height + 2 * pad}px"></div>`;
  if (kind === "highlight") return `${STYLE}<div class="fr-overlay">${spot}</div>`;
  const below = height - (b.y + b.height) >= b.y;
  const bubbleWidth = Math.min(width - 32, width * 0.36);
  const left = Math.max(16, Math.min(width - bubbleWidth - 16, b.x + b.width / 2 - 48));
  const tip = Math.max(16, Math.min(bubbleWidth - 32, b.x + b.width / 2 - left - 8));
  const place = below ? `top:${b.y + b.height + pad + 18}px` : `bottom:${height - b.y + pad + 18}px`;
  return `${STYLE}<div class="fr-overlay">${spot}<div class="bubble ${below ? "below" : "above"}" style="left:${left}px;${place};max-width:${bubbleWidth}px;` +
    `--tip:${tip}px;--rise:${below ? "1.2rem" : "-1.2rem"}"><i>${ICON}</i><div><b>${esc(props.text)}</b>` +
    `${props.detail ? `<span>${esc(props.detail)}</span>` : ""}</div></div></div>`;
}
