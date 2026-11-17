// The catalog (GH-76 decisions 001 and 002): each built-in card's props, how they are checked, and its page. A
// script names a card by its word (`card.intro`), and the event log by its kind (`"intro"`).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { scriptFile } from "./brand.ts";
import { type PageContext, esc, scriptUrl } from "./page.ts";
import { formatDuration } from "../effects.ts";

/** How a prop is checked: text, a list of texts, one of a few words, or an image in the script's folder. */
type PropSpec =
  | { type: "text"; required?: boolean }
  | { type: "texts"; required?: boolean; max: number }
  | { type: "choice"; choices: readonly string[] }
  | { type: "image"; required?: boolean };

export const IMAGE_TYPES = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

/** What a built-in card's body is drawn from: its checked props and the page's context. */
interface Drawing extends PageContext {
  /** A chapter's place among the script's chapters, counted when the script has run. */
  chapter?: { number: number; total: number };
}
interface Kind { props: Record<string, PropSpec>; body(props: Record<string, unknown>, context: Drawing): string }

const two = (n: number) => String(n).padStart(2, "0");
const logoOf = (c: Drawing, extra = "") => c.logo ? `<img class="fr-logo ${extra}" src="${c.logo}" alt="">` : "";

// Slow concentric rings behind the intro.
const ORBIT = `<svg class="orbit" viewBox="0 0 800 800" aria-hidden="true">
<g fill="none" stroke="var(--fr-line)" stroke-width="1.5"><circle cx="400" cy="400" r="150"/><circle cx="400" cy="400" r="250"/>
<circle cx="400" cy="400" r="350"/></g><g class="spin"><circle cx="400" cy="50" r="9" fill="var(--fr-accent)"/></g>
<g class="spin slow"><circle cx="650" cy="400" r="6" fill="var(--fr-muted)"/></g></svg>`;

const FORWARD = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="var(--fr-accent)" d="M3 6.5v11l8-5.5zM12 6.5v11l8-5.5z"/></svg>`;

export const KINDS = {
  intro: {
    props: { kicker: { type: "text" }, title: { type: "text", required: true }, subtitle: { type: "text" },
      layout: { type: "choice", choices: ["left", "center"] } },
    body: (p, c) => `<style>
.orbit{position:absolute;width:62rem;height:62rem;right:-14rem;top:50%;margin-top:-31rem;opacity:.9}
.fr-center .orbit{right:50%;margin-right:-31rem}
.spin{transform-origin:400px 400px;animation:fr-spin 24s linear infinite}.spin.slow{animation-duration:40s;animation-direction:reverse}
.top{position:absolute;left:7rem;top:5rem}.fr-center .top{left:50%;transform:translateX(-50%)}
.copy{position:relative;max-width:64rem}
</style><div class="fr-card${p.layout === "center" ? " fr-center" : ""}">${ORBIT}<div class="top fr-enter-fade">${logoOf(c)}</div>
<div class="copy fr-stack">${p.kicker ? `<span class="fr-kicker fr-enter">${esc(p.kicker)}</span>` : ""}
<h1 class="fr-title fr-enter fr-d1">${esc(p.title)}</h1>${p.subtitle ? `<p class="fr-subtitle fr-enter fr-d2"${p.layout === "center" ? ' style="margin:0 auto"' : ""}>${esc(p.subtitle)}</p>` : ""}</div></div>`,
  },
  chapter: {
    props: { title: { type: "text", required: true }, subtitle: { type: "text" } },
    body: (p, { chapter = { number: 1, total: 1 } }) => `<style>
.num{position:absolute;right:6rem;bottom:2rem;font-family:var(--fr-font-heading);font-weight:700;font-size:26rem;line-height:1;
  letter-spacing:-.06em;color:transparent;-webkit-text-stroke:2px var(--fr-line)}
.steps{position:absolute;left:7rem;right:7rem;bottom:5rem;display:flex;gap:.8rem}
.steps span{flex:1;height:.35rem;border-radius:1rem;background:var(--fr-line);overflow:hidden}
.steps span.done{background:var(--fr-accent)}.steps span.now i{display:block;height:100%;background:var(--fr-accent);
  transform-origin:left;animation:fr-grow 1.2s cubic-bezier(.6,0,.2,1) .3s both}
</style><div class="fr-card"><span class="num fr-enter-fade">${two(chapter.number)}</span><div class="fr-stack" style="position:relative;max-width:60rem">
<span class="fr-kicker fr-mono fr-enter">Chapter ${two(chapter.number)} <span class="fr-muted">/ ${two(chapter.total)}</span></span>
<h1 class="fr-title fr-enter fr-d1">${esc(p.title)}</h1>${p.subtitle ? `<p class="fr-subtitle fr-enter fr-d2">${esc(p.subtitle)}</p>` : ""}</div>
<div class="steps">${Array.from({ length: chapter.total }, (_, i) => i + 1 < chapter.number ? '<span class="done"></span>'
  : i + 1 === chapter.number ? '<span class="now"><i></i></span>' : "<span></span>").join("")}</div></div>`,
  },
  outro: {
    props: { title: { type: "text", required: true }, url: { type: "text" }, links: { type: "texts", max: 4 } },
    body: (p, c) => `<style>
.cta{position:relative}.cta::after{content:"";position:absolute;inset:-.6rem;border-radius:99rem;border:2px solid var(--fr-accent);
  opacity:0;animation:pulse 2.4s ease-out 1s infinite}
@keyframes pulse{0%{opacity:.7;transform:scale(.96)}100%{opacity:0;transform:scale(1.18)}}
.links{display:flex;gap:2.4rem;font-size:1.3rem}
</style><div class="fr-card fr-center"><div class="fr-stack" style="align-items:center;gap:2.6rem">${logoOf(c, "fr-enter-fade")}
<h1 class="fr-title fr-enter fr-d1">${esc(p.title)}</h1>${p.url ? `<span class="fr-pill cta fr-enter fr-d2">${esc(p.url)}<span aria-hidden="true">→</span></span>` : ""}
${Array.isArray(p.links) ? `<div class="links fr-mono fr-muted fr-enter fr-d3">${p.links.map((l) => `<span>${esc(l)}</span>`).join("")}</div>` : ""}</div></div>`,
  },
  // The card a skip shows (GH-76 decision 008), over the blurred last frame; `durationMs` is the length cut.
  skip: {
    props: { label: { type: "text", required: true }, style: { type: "choice", choices: ["clock", "bar"] } },
    body: (p, c) => {
      const cut = formatDuration(Number(c.props.durationMs));
      const label = String(p.label);
      const [big, small] = label.includes("{duration}") ? [cut, label.replaceAll("{duration}", "").trim()] : [label, ""];
      const backdrop = `<img class="back" src="/fr/backdrop.png" alt=""><div class="scrim"></div>`;
      const style = `<style>
.back{position:absolute;inset:-3rem;width:calc(100% + 6rem);height:calc(100% + 6rem);object-fit:cover;filter:blur(1.4rem)}
.scrim{position:absolute;inset:0;background:color-mix(in srgb,var(--fr-bg) 45%,transparent)}
.panel{position:absolute;display:flex;align-items:center;background:var(--fr-bg);color:var(--fr-fg);
  animation:pop .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
.clock{left:50%;top:50%;width:30rem;height:24rem;margin:-12rem 0 0 -15rem;border-radius:1.8rem;flex-direction:column;justify-content:center;gap:1.4rem}
.ring{position:relative;width:13rem;height:13rem}.ring svg{position:absolute;inset:0;width:100%;height:100%}
.sweep{stroke-dasharray:691;animation:sweep var(--fr-duration) cubic-bezier(.5,0,.2,1) both}
@keyframes sweep{from{stroke-dashoffset:691}to{stroke-dashoffset:0}}
.ring b{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.2rem;
  font-family:var(--fr-font-heading);font-size:3.2rem;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.ring b svg{position:static;width:2.4rem;height:2.4rem}
.bar{left:3.6rem;right:3.6rem;bottom:3.2rem;border-radius:1.2rem;padding:1.6rem 2rem 1.4rem;flex-direction:column;align-items:stretch;gap:1.1rem}
.bar .fr-row svg{width:2.2rem;height:2.2rem}.bar strong{font-family:var(--fr-font-heading);font-size:2.4rem;letter-spacing:-.03em}
.line{height:.3rem;border-radius:1rem;background:var(--fr-line);overflow:hidden}
.line i{display:block;height:100%;background:var(--fr-accent);transform-origin:left;animation:fr-grow var(--fr-duration) cubic-bezier(.5,0,.2,1) both}
</style>`;
      if (p.style === "bar") {
        return `${style}${backdrop}<div class="panel bar fr-surface"><div class="fr-row">${FORWARD}<strong>${esc(label.replaceAll("{duration}", cut))}</strong></div><div class="line"><i></i></div></div>`;
      }
      return `${style}${backdrop}<div class="panel clock fr-surface"><div class="ring"><svg viewBox="0 0 230 230" aria-hidden="true">
<circle cx="115" cy="115" r="110" fill="none" stroke="var(--fr-line)" stroke-width="6"/><circle class="sweep" cx="115" cy="115" r="110" fill="none"
stroke="var(--fr-accent)" stroke-width="6" stroke-linecap="round" transform="rotate(-90 115 115)"/></svg><b>${FORWARD}${esc(big)}</b></div>
${small ? `<span class="fr-muted" style="font-size:1.4rem">${esc(small)}</span>` : ""}</div>`;
    },
  },
} satisfies Record<string, Kind>;

/** The built-in cards: the `card` words' (`CARD_WORDS` but `custom`) and the skip card. */
export type BuiltInKind = keyof typeof KINDS;

/** A file a card uses, by its path in the script's folder and its hash, so the event log names exactly what showed. */
export interface CardFile { path: string; sha256: string }

const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

/**
 * Checks a built-in card's props where the script calls `card.<kind>`: unknown props, missing or empty text, lists
 * and choices throw naming the word. Image props must be files in the script's folder; their hashes are returned.
 */
export function checkProps(kind: Exclude<BuiltInKind, "skip">, value: unknown, scriptDir: string, extra: readonly string[]):
  { props: Record<string, unknown>; files: CardFile[] } {
  const word = `card.${kind}()`;
  const spec: Record<string, PropSpec> = KINDS[kind].props;
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${word} takes an object, as in ${word.slice(0, -1)}{ title: "…" })`);
  const known = [...Object.keys(spec), ...extra];
  const unknown = Object.keys(value).find((key) => !known.includes(key));
  if (unknown) throw new Error(`${word}: unknown prop ${JSON.stringify(unknown)}; it takes ${known.join(", ")}`);
  const props: Record<string, unknown> = {};
  const files: CardFile[] = [];
  for (const [name, rule] of Object.entries(spec)) {
    const v = (value as Record<string, unknown>)[name];
    if (v === undefined) {
      if ("required" in rule && rule.required) throw new Error(`${word} needs ${name}`);
      continue;
    }
    if (rule.type === "text" && (typeof v !== "string" || !v.trim())) throw new Error(`${word}: ${name} must be non-empty text, got ${JSON.stringify(v)}`);
    if (rule.type === "texts" && (!Array.isArray(v) || !v.length || v.length > rule.max || v.some((x) => typeof x !== "string" || !x.trim()))) {
      throw new Error(`${word}: ${name} must be a list of 1 to ${rule.max} non-empty texts, got ${JSON.stringify(v)}`);
    }
    if (rule.type === "choice" && !rule.choices.includes(v as string)) {
      throw new Error(`${word}: ${name} must be ${rule.choices.map((c) => JSON.stringify(c)).join(" or ")}, got ${JSON.stringify(v)}`);
    }
    if (rule.type === "image") {
      const { file, inside } = scriptFile(scriptDir, v, `${word}: ${name}`, IMAGE_TYPES);
      files.push({ path: inside, sha256: hash(file) });
      props[name] = inside;
      continue;
    }
    props[name] = v;
  }
  return { props, files };
}

/** Checks a custom card's props: a plain object of JSON values, which `window.flowReel.props` gets as they are. */
export function checkCustomProps(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("card.custom(): props must be an object");
  const json = (v: unknown): boolean => v === null || ["string", "number", "boolean"].includes(typeof v) && (typeof v !== "number" || Number.isFinite(v)) ||
    Array.isArray(v) && v.every(json) || typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype && Object.values(v as object).every(json);
  for (const [key, v] of Object.entries(value)) {
    if (!json(v)) throw new Error(`card.custom(): props.${key} must be text, a number, true or false, null, or a list or object of those`);
  }
  return value as Record<string, unknown>;
}

export const fileHash = hash;

/** A built-in card's body; image props become URLs on the card origin. */
export function builtInBody(kind: BuiltInKind, props: Record<string, unknown>, context: Drawing): string {
  const spec: Record<string, PropSpec> = KINDS[kind].props;
  const shown = Object.fromEntries(Object.entries(props).map(([k, v]) => [k, spec[k]?.type === "image" ? scriptUrl(String(v)) : v]));
  return (KINDS[kind] as Kind).body(shown, context);
}
