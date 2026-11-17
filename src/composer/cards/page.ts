// The page every card is drawn on (GH-76 decision 003): the theme's colours as `--fr-*` variables, the fonts, the
// flow-reel atoms (`fr-*` classes), `window.flowReel`, and `data-prop` filling. A built-in card is a body inside it; a
// custom card is the script's own HTML page with it injected at the top of its head.
import type { Theme } from "./brand.ts";

/** Where the renderer serves things from (GH-76 decision 003): nothing else loads, so the network is off. */
export const ORIGIN = "http://card.flow-reel";
export const FONTS_PATH = "/fr/fonts/";
export const SCRIPT_PATH = "/script/";

/** The URL a card page uses for a file in the script's folder, given relative to that folder. */
export const scriptUrl = (inside: string) => SCRIPT_PATH + inside.split("/").map(encodeURIComponent).join("/");

/** What a card page knows: `window.flowReel` holds the same. */
export interface PageContext {
  theme: Theme;
  props: Record<string, unknown>;
  /** How long the card shows, transitions included. */
  durationMs: number;
  /** The brand's fonts, as URLs on the card origin; the bundled ones otherwise. */
  fonts: { heading?: string; body?: string };
  /** The brand's logo, as a URL on the card origin. */
  logo?: string;
}

const face = (family: string, url: string, weight = "100 900") =>
  `@font-face{font-family:"${family}";src:url("${url}");font-weight:${weight};font-display:block}`;

// The bundled fonts (OFL, docker/fonts): Inter for text, Inter Tight for titles, JetBrains Mono for labels.
const BUNDLED = [
  face("Inter", `${FONTS_PATH}Inter.woff2`),
  face("Inter Tight", `${FONTS_PATH}InterTight.woff2`),
  face("JetBrains Mono", `${FONTS_PATH}JetBrainsMono.woff2`),
].join("");

/** The atoms: sizes are in rem, and a rem is 1/54 of the screen's height, so a card fits any viewport. */
export const ATOMS = `
*,*::before,*::after{box-sizing:border-box}
html{font-size:min(calc(100vh / 54),calc(100vw / 96));background:var(--fr-bg);color:var(--fr-fg);
  font-family:var(--fr-font-body);-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
body{margin:0;width:100vw;height:100vh;overflow:hidden}
.fr-card{position:relative;width:100vw;height:100vh;overflow:hidden;background:var(--fr-bg);color:var(--fr-fg);
  padding:6rem 7rem;display:flex;flex-direction:column;justify-content:center}
.fr-center{align-items:center;text-align:center}
.fr-kicker{font-family:var(--fr-font-body);font-size:1.1rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--fr-accent)}
.fr-title{margin:0;font-family:var(--fr-font-heading);font-size:6.4rem;line-height:.98;font-weight:700;letter-spacing:-.035em;text-wrap:balance}
.fr-title-m{font-size:4.4rem;letter-spacing:-.03em}
.fr-subtitle{margin:0;font-size:1.9rem;line-height:1.35;color:var(--fr-muted);max-width:46rem;text-wrap:pretty}
.fr-mono{font-family:var(--fr-font-mono);letter-spacing:.02em}
.fr-muted{color:var(--fr-muted)}
.fr-accent{color:var(--fr-accent)}
.fr-surface{background:var(--fr-surface);border-radius:1.4rem;box-shadow:0 0 0 1px var(--fr-line),0 2rem 5rem rgba(0,0,0,.28)}
.fr-badge{display:inline-flex;align-items:center;gap:.5rem;padding:.45rem .9rem;border-radius:99rem;font-size:1rem;font-weight:600;
  background:color-mix(in srgb,var(--fr-accent) 16%,transparent);color:var(--fr-accent)}
.fr-pill{display:inline-flex;align-items:center;gap:.8rem;padding:1.1rem 2rem;border-radius:99rem;background:var(--fr-accent);
  color:var(--fr-on-accent);font-size:1.6rem;font-weight:600}
.fr-logo{height:2.6rem;width:auto;display:block}
.fr-rule{height:1px;background:var(--fr-line);border:0;margin:0}
.fr-stack{display:flex;flex-direction:column;gap:1.6rem}
.fr-row{display:flex;align-items:center;gap:1.2rem}
@keyframes fr-rise{from{opacity:0;transform:translateY(2.4rem)}to{opacity:1;transform:none}}
@keyframes fr-fade{from{opacity:0}to{opacity:1}}
@keyframes fr-grow{from{transform:scaleX(0)}to{transform:none}}
@keyframes fr-spin{to{transform:rotate(360deg)}}
.fr-enter{animation:fr-rise .9s cubic-bezier(.2,.7,.2,1) both}
.fr-enter-fade{animation:fr-fade .9s ease-out both}
.fr-d1{animation-delay:.12s}.fr-d2{animation-delay:.24s}.fr-d3{animation-delay:.36s}.fr-d4{animation-delay:.48s}.fr-d5{animation-delay:.6s}
`;

const escapeScript = (json: string) => json.replace(/</g, "\\u003c");

/** The head every card page starts with. */
export function pageHead({ theme, props, durationMs, fonts, logo }: PageContext): string {
  const vars = `:root{--fr-bg:${theme.bg};--fr-surface:${theme.surface};--fr-line:${theme.line};--fr-fg:${theme.fg};` +
    `--fr-muted:${theme.muted};--fr-accent:${theme.accent};--fr-on-accent:${theme.onAccent};` +
    `--fr-font-heading:${fonts.heading ? '"fr-heading",' : ""}"Inter Tight","Inter",sans-serif;` +
    `--fr-font-body:${fonts.body ? '"fr-body",' : ""}"Inter",sans-serif;--fr-font-mono:"JetBrains Mono",monospace;` +
    `--fr-duration:${durationMs}ms}`;
  const brandFaces = (fonts.heading ? face("fr-heading", fonts.heading) : "") + (fonts.body ? face("fr-body", fonts.body) : "");
  const context = escapeScript(JSON.stringify({ props, theme, durationMs, logo: logo ?? null }));
  return `<meta charset="utf-8"><style>${BUNDLED}${brandFaces}${vars}${ATOMS}</style>` +
    `<script>window.flowReel=Object.freeze(${context});` +
    `document.addEventListener("DOMContentLoaded",()=>{for(const el of document.querySelectorAll("[data-prop]")){` +
    `const v=window.flowReel.props[el.dataset.prop];if(v===undefined||v===null)continue;` +
    `if(el instanceof HTMLImageElement)el.src=String(v);` +
    `else if(Array.isArray(v)&&(el.tagName==="UL"||el.tagName==="OL")){el.replaceChildren(...v.map((x)=>{const li=document.createElement("li");li.textContent=String(x);return li}))}` +
    `else el.textContent=Array.isArray(v)?v.join(", "):String(v)}});</script>`;
}

/** A built-in card's whole page. */
export const builtInPage = (context: PageContext, body: string) =>
  `<!doctype html><html lang="en"><head>${pageHead(context)}</head><body>${body}</body></html>`;

/** A custom card's page: the script's HTML with the card head injected first in its head. */
export function customPage(context: PageContext, html: string): string {
  const head = pageHead(context);
  const open = /<head(\s[^>]*)?>/i.exec(html);
  if (open) return html.slice(0, open.index + open[0].length) + head + html.slice(open.index + open[0].length);
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  const at = doctype ? doctype[0].length : 0;
  return `${html.slice(0, at)}<head>${head}</head>${html.slice(at)}`;
}

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Text made safe to put in HTML. */
export const esc = (value: unknown) => String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
