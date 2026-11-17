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
  | { type: "texts"; required?: boolean; min?: number; max: number }
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

const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="var(--fr-on-accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

/** A screenshot in a browser window, a phone, or on its own. */
function framed(src: string, frame: unknown, fit: unknown, url?: unknown): string {
  const image = `<img class="shot" src="${src}" alt="" style="object-fit:${fit === "contain" ? "contain" : "cover"}">`;
  if (frame === "phone") return `<div class="phone"><div class="screen">${image}<span class="notch"></span></div></div>`;
  if (frame === "none") return `<div class="bare">${image}</div>`;
  return `<div class="browser"><div class="bar"><i></i><i></i><i></i>${url ? `<span class="url fr-mono">${esc(url)}</span>` : ""}</div>${image}</div>`;
}
const FRAMES = `
.browser{display:flex;flex-direction:column;border-radius:1.2rem;overflow:hidden;background:var(--fr-surface);
  box-shadow:0 0 0 1px var(--fr-line),0 3rem 7rem rgba(0,0,0,.38)}
.browser .bar{flex:none;height:3rem;display:flex;align-items:center;gap:.6rem;padding:0 1.2rem;background:var(--fr-surface);border-bottom:1px solid var(--fr-line)}
.browser .bar i{width:.85rem;height:.85rem;border-radius:50%;background:var(--fr-line)}
.browser .url{margin:0 auto;padding:.35rem 1.4rem;border-radius:99rem;background:var(--fr-bg);color:var(--fr-muted);font-size:.95rem}
.browser .shot{flex:1;min-height:0;width:100%;display:block;background:var(--fr-bg)}
.phone{height:100%;aspect-ratio:9/19.5;padding:1rem;border-radius:4.2rem;background:#0a0b0e;
  box-shadow:0 0 0 2px var(--fr-line),0 3rem 7rem rgba(0,0,0,.45)}
.phone .screen{position:relative;width:100%;height:100%;border-radius:3.3rem;overflow:hidden;background:var(--fr-bg)}
.phone .shot{width:100%;height:100%;display:block}
.phone .notch{position:absolute;top:1rem;left:50%;width:30%;height:2.2rem;margin-left:-15%;border-radius:99rem;background:#0a0b0e}
.bare{border-radius:1.2rem;overflow:hidden;box-shadow:0 0 0 1px var(--fr-line),0 3rem 7rem rgba(0,0,0,.38)}
.bare .shot{width:100%;height:100%;display:block}
@keyframes fr-lift{from{opacity:0;transform:translateY(3rem) scale(.97)}to{opacity:1;transform:none}}
.fr-lift{animation:fr-lift 1.1s cubic-bezier(.2,.7,.2,1) both}
`;

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
  feature: {
    props: { kicker: { type: "text" }, title: { type: "text", required: true }, points: { type: "texts", required: true, max: 5 },
      image: { type: "image" }, imageSide: { type: "choice", choices: ["right", "left"] } },
    body: (p, c) => `<style>${FRAMES}
.split{display:grid;grid-template-columns:${p.image ? "minmax(0,.9fr) minmax(0,1.1fr)" : "1fr"};gap:5rem;align-items:center;height:100%}
.split.left .copy{order:2}
.points{list-style:none;margin:1.4rem 0 0;padding:0;display:flex;flex-direction:column;gap:1.4rem;font-size:1.9rem;line-height:1.3}
.points li{display:flex;gap:1.1rem;align-items:flex-start}
.points li b{flex:none;width:2.2rem;height:2.2rem;margin-top:.05rem;border-radius:.7rem;background:var(--fr-accent);display:flex;align-items:center;justify-content:center}
.points li b svg{width:1.4rem;height:1.4rem}
.media{height:36rem;display:flex;justify-content:center}.media>*{width:100%}.media>.phone{width:auto}
</style><div class="fr-card" style="padding:5rem 6rem"><div class="split${p.imageSide === "left" ? " left" : ""}"><div class="copy fr-stack">
${p.kicker ? `<span class="fr-kicker fr-enter">${esc(p.kicker)}</span>` : ""}<h1 class="fr-title fr-title-m fr-enter fr-d1">${esc(p.title)}</h1>
<ul class="points">${(p.points as string[]).map((point, i) => `<li class="fr-enter fr-d${Math.min(5, i + 2)}"><b>${CHECK}</b><span>${esc(point)}</span></li>`).join("")}</ul></div>
${p.image ? `<div class="media fr-lift fr-d2">${framed(String(p.image), "browser", "cover")}</div>` : ""}</div></div>`,
  },
  image: {
    props: { image: { type: "image", required: true }, kicker: { type: "text" }, title: { type: "text" }, caption: { type: "text" },
      frame: { type: "choice", choices: ["browser", "phone", "none"] }, fit: { type: "choice", choices: ["cover", "contain"] }, url: { type: "text" } },
    body: (p) => {
      const words = p.kicker || p.title || p.caption ? `<div class="fr-stack" style="gap:1.2rem">${p.kicker ? `<span class="fr-kicker fr-enter">${esc(p.kicker)}</span>` : ""}
${p.title ? `<h1 class="fr-title fr-title-m fr-enter fr-d1">${esc(p.title)}</h1>` : ""}${p.caption ? `<p class="fr-subtitle fr-enter fr-d2">${esc(p.caption)}</p>` : ""}</div>` : "";
      const shot = framed(String(p.image), p.frame, p.fit, p.url);
      if (p.frame === "phone") {
        return `<style>${FRAMES}.side{display:grid;grid-template-columns:${words ? "minmax(0,1fr) auto" : "auto"};justify-content:center;gap:6rem;align-items:center;height:100%}
.side .media{height:44rem}</style><div class="fr-card" style="padding:4rem 8rem"><div class="side">${words}<div class="media fr-lift fr-d1">${shot}</div></div></div>`;
      }
      return `<style>${FRAMES}.stage{flex:1;min-height:0;display:flex;justify-content:center}.stage>*{width:100%;height:100%}.browser .shot,.bare .shot{height:100%}</style>
<div class="fr-card" style="padding:${words ? "4.4rem" : "4rem"} 7rem 4rem;justify-content:flex-start;gap:2.8rem">${words}<div class="stage fr-lift fr-d1">${shot}</div></div>`;
    },
  },
  compare: {
    props: { before: { type: "image", required: true }, after: { type: "image", required: true }, kicker: { type: "text" },
      title: { type: "text" }, labels: { type: "texts", min: 2, max: 2 } },
    body: (p) => {
      const [left, right] = (p.labels as string[] | undefined) ?? ["Before", "After"];
      return `<style>
.stage{position:relative;flex:1;min-height:0;border-radius:1.4rem;overflow:hidden;box-shadow:0 0 0 1px var(--fr-line),0 3rem 7rem rgba(0,0,0,.35)}
.stage img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.after{clip-path:inset(0 0 0 50%);animation:reveal 1.6s cubic-bezier(.65,0,.3,1) .5s both}
@keyframes reveal{from{clip-path:inset(0 0 0 100%)}to{clip-path:inset(0 0 0 50%)}}
.handle{position:absolute;top:0;bottom:0;left:50%;width:0;animation:slide 1.6s cubic-bezier(.65,0,.3,1) .5s both}
@keyframes slide{from{left:100%}to{left:50%}}
.handle::before{content:"";position:absolute;top:0;bottom:0;left:-.15rem;width:.3rem;background:var(--fr-accent)}
.handle b{position:absolute;top:50%;left:-2.2rem;margin-top:-2.2rem;width:4.4rem;height:4.4rem;border-radius:50%;background:var(--fr-accent);
  box-shadow:0 .6rem 1.6rem rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center}
.handle svg{width:2.2rem;height:2.2rem}
.tag{position:absolute;bottom:1.6rem;padding:.5rem 1rem;border-radius:.6rem;font-size:1.1rem;background:rgba(10,11,14,.78);color:#fff}
.tag.l{left:1.6rem}.tag.r{right:1.6rem;background:var(--fr-accent);color:var(--fr-on-accent)}
</style><div class="fr-card" style="padding:4.4rem 7rem 4rem;justify-content:flex-start;gap:2.6rem">
${p.kicker || p.title ? `<div class="fr-stack" style="gap:1rem">${p.kicker ? `<span class="fr-kicker fr-enter">${esc(p.kicker)}</span>` : ""}${p.title ? `<h1 class="fr-title fr-title-m fr-enter fr-d1">${esc(p.title)}</h1>` : ""}</div>` : ""}
<div class="stage fr-lift"><img src="${p.before}" alt=""><img class="after" src="${p.after}" alt="">
<span class="tag l fr-mono">${esc(left)}</span><span class="tag r fr-mono fr-enter-fade fr-d5">${esc(right)}</span>
<div class="handle"><b><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="var(--fr-on-accent)" stroke-width="2.4" d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg></b></div></div></div>`;
    },
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
    if (rule.type === "texts" && (!Array.isArray(v) || v.length < (rule.min ?? 1) || v.length > rule.max ||
      v.some((x) => typeof x !== "string" || !x.trim()))) {
      const count = (rule.min ?? 1) === rule.max ? `${rule.max}` : `${rule.min ?? 1} to ${rule.max}`;
      throw new Error(`${word}: ${name} must be a list of ${count} non-empty texts, got ${JSON.stringify(v)}`);
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
