// The score (GH-139): one line per kind of word, on the recording's clock. It writes itself from the journal while the
// script records, then fills in from the record result (decisions 001 to 004).
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ComponentChildren, JSX } from "preact";
import type { LiveRun, RunEntry, Score as ScoreData, ScoreMark } from "../../src/studio/api.ts";

const PAD = 14;
const FOLD_W = 72;
const MIN_ZOOM = 10;
const MAX_ZOOM = 240;
const PICTURES_KEY = "flow-reel.score-pictures";

export interface StepSnapshots { snapshot(): string | undefined }

interface ScoreStep { index: number; comment?: string; startMs: number; endMs: number; picture?: string }
interface Fold { from: number; to: number; startMs: number; endMs: number }

export const clock = (ms: number): string => {
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};

/** The steps the journal has said so far, with the time each started (decision 001). */
export function liveSteps(entries: readonly RunEntry[]): { index: number; comment?: string; t: number; at: number }[] {
  const steps: { index: number; comment?: string; t: number; at: number }[] = [];
  for (const entry of entries) {
    const what = entry.what as { type?: string; index?: number; comment?: string; t?: number } | undefined;
    if (entry.type === "phase-started" && entry.phase === "record") steps.length = 0;
    if (entry.type === "progress" && entry.phase === "record" && what?.type === "step" && typeof what.index === "number" && typeof what.t === "number") {
      steps.push({ index: what.index, ...(what.comment ? { comment: what.comment } : {}), t: what.t, at: Date.parse(entry.at) });
    }
  }
  return steps;
}

/** Runs of two or more steps without a comment, joined into one measure (decision 004). */
export function foldsOf(steps: readonly ScoreStep[]): Fold[] {
  const folds: Fold[] = [];
  let i = 0;
  while (i < steps.length) {
    let j = i;
    while (j < steps.length && steps[j].comment === undefined) j++;
    if (j - i >= 2) folds.push({ from: steps[i].index, to: steps[j - 1].index, startMs: steps[i].startMs, endMs: steps[j - 1].endMs });
    i = Math.max(j, i + 1);
  }
  return folds;
}

/** Where a time is on the score, in pixels, at `zoom` pixels a second with `folds` folded. */
export function placer(zoom: number, folds: readonly Fold[]): (ms: number) => number {
  return (ms) => {
    let px = PAD + (ms * zoom) / 1000;
    for (const fold of folds) {
      const span = fold.endMs - fold.startMs;
      if (ms >= fold.endMs) px -= (span * zoom) / 1000 - FOLD_W;
      else if (ms > fold.startMs) px -= ((ms - fold.startMs) * zoom) / 1000 - ((ms - fold.startMs) / span) * FOLD_W;
    }
    return px;
  };
}

const isEndedRun = (run: LiveRun) => run.state === "done" || run.state === "failed" || run.state === "stopped" || run.state === "cancelled";
const remembered = () => { try { return localStorage.getItem(PICTURES_KEY) !== "off"; } catch { return true; } };

export function Score({ run, entries, snapshots }: { run: LiveRun; entries: RunEntry[]; snapshots?: StepSnapshots }) {
  const recorded = run.finished.includes("record");
  const recording = !recorded && run.phase === "record" && (run.state === "running" || run.state === "held");
  const [data, setData] = useState<ScoreData | undefined>();
  const [now, setNow] = useState(Date.now());
  const shots = useRef(new Map<number, string>());

  // The record result, once there is one.
  useEffect(() => {
    if (!recorded) { setData(undefined); return; }
    let gone = false;
    fetch(`/api/score?run=${encodeURIComponent(run.id)}`).then((r) => r.ok ? r.json() as Promise<ScoreData> : undefined)
      .then((score) => { if (!gone) setData(score); }, () => {});
    return () => { gone = true; };
  }, [run.id, recorded]);

  const live = useMemo(() => liveSteps(entries), [entries]);
  // While watched, the live picture as each step starts stands in for its picture (decision 003).
  useEffect(() => {
    const last = live.at(-1);
    if (recording && last && snapshots && !shots.current.has(last.index)) {
      const url = snapshots.snapshot();
      if (url) shots.current.set(last.index, url);
    }
  }, [live.length, recording]);
  useEffect(() => () => { for (const url of shots.current.values()) URL.revokeObjectURL(url); }, []);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [recording]);

  const last = live.at(-1);
  const playhead = recording && last ? last.t + Math.max(0, now - last.at) : undefined;
  const steps: ScoreStep[] = data
    ? withPictures(run.id, data.steps)
    : live.map((step, i) => ({ index: step.index, ...(step.comment ? { comment: step.comment } : {}), startMs: step.t,
      endMs: live[i + 1]?.t ?? playhead ?? step.t + 1000, ...(shots.current.has(step.index) ? { picture: shots.current.get(step.index) } : {}) }));
  const duration = Math.max(data?.durationMs ?? 0, playhead ?? 0, steps.at(-1)?.endMs ?? 0, 1000);
  return (
    <ScoreView steps={steps} marks={data?.marks ?? []} duration={duration} playhead={playhead}
      current={recording ? steps.at(-1)?.index : undefined} voiced={run.finished.includes("voice")}
      failedAt={run.state === "failed" && run.phase === "record" ? steps.at(-1)?.index : undefined}
      hint={recorded ? undefined : recording || !isEndedRun(run) ? "Fills in once the recording is done" : "None: the run has no recording"}
      empty={recording ? "The steps show as the script reaches them" : "No steps"}
      note={recording ? "· writes itself as the script records" : "· on the recording's clock"} />
  );
}

/** A run's step pictures, where it has them. */
export function withPictures(id: string, steps: ScoreData["steps"]): ScoreStep[] {
  return steps.map(({ picture, ...step }) => ({ ...step, ...(picture ? { picture: `/api/step-picture?run=${encodeURIComponent(id)}&step=${step.index}` } : {}) }));
}

export interface ScoreViewProps {
  steps: ScoreStep[];
  marks: ScoreMark[];
  duration: number;
  playhead?: number;
  /** The step to mark as now. */
  current?: number;
  voiced: boolean;
  failedAt?: number;
  /** What the sounds, effects and cards lines say while they are empty. */
  hint?: string;
  empty: string;
  note: string;
  /** Clicking the score goes there (the Reel screen, GH-140 decision 002). */
  onSeek?: (ms: number) => void;
}

/** The score's drawing: its lines, zoom and fold, tips and keys (decision 004). */
export function ScoreView({ steps, marks, duration, playhead, current, voiced, failedAt, hint, empty, note, onSeek }: ScoreViewProps) {
  const [pictures, setPictures] = useState(remembered);
  const [folded, setFolded] = useState(false);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [width, setWidth] = useState(0);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | undefined>();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const folds = folded ? foldsOf(steps) : [];
  const foldedMs = folds.reduce((sum, fold) => sum + fold.endMs - fold.startMs, 0);
  const fit = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (width - 2 * PAD - folds.length * FOLD_W) / Math.max(1, (duration - foldedMs) / 1000)));
  const pxPerSecond = zoom === "fit" ? fit : zoom;
  const x = placer(pxPerSecond, folds);
  const full = Math.max(width, x(duration) + PAD);
  const inFold = (index: number) => folds.find((fold) => index >= fold.from && index <= fold.to);
  /** The time at a place on the score: `x` only grows, so halving finds it. */
  const timeAt = (px: number) => {
    let [lo, hi] = [0, duration];
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (x(mid) < px) lo = mid; else hi = mid; }
    return Math.round(lo);
  };

  // Keep the playhead in view while it moves.
  useEffect(() => {
    const element = scroller.current;
    if (!element || playhead === undefined) return;
    const at = x(playhead);
    if (at > element.scrollLeft + element.clientWidth - 60 || at < element.scrollLeft) element.scrollLeft = Math.max(0, at - element.clientWidth * 0.35);
  }, [playhead !== undefined && Math.floor(x(playhead) / 40)]);

  const setPicturesOn = (on: boolean) => { setPictures(on); try { localStorage.setItem(PICTURES_KEY, on ? "on" : "off"); } catch { /* kept for this page only */ } };
  const zoomBy = (factor: number) => setTip(undefined) ?? setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pxPerSecond * factor)));
  const foldable = foldsOf(steps).length > 0;

  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const mark = target.closest<HTMLElement>("[data-mark]");
      const next = event.key === "ArrowRight" ? mark?.nextElementSibling : mark?.previousElementSibling;
      if (next instanceof HTMLElement && next.dataset.mark !== undefined) { event.preventDefault(); next.focus(); }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "[") zoomBy(1 / 1.5);
    else if (event.key === "]") zoomBy(1.5);
    else if (event.key === "0") setZoom("fit");
    else if (event.key === "f" || event.key === "F") { if (foldable) setFolded(!folded); }
    else return;
    event.preventDefault();
  };
  const show = (text: string) => (event: Event) => {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setTip({ text, x: box.left + box.width / 2, y: box.top });
  };
  const hide = () => setTip(undefined);
  const mark = (text: string, ms?: number) => ({ "data-mark": "", "aria-label": text, onMouseEnter: show(text), onFocus: show(text), onMouseLeave: hide, onBlur: hide,
    ...(onSeek && ms !== undefined ? { onClick: (event: Event) => { event.stopPropagation(); onSeek(ms); } } : {}) });

  const ruler: JSX.Element[] = [];
  const every = pxPerSecond >= 40 ? 1 : pxPerSecond >= 16 ? 5 : 10;
  for (let s = 0; s * 1000 <= duration; s += every) {
    const big = s % (every === 1 ? 5 : every * 2) === 0;
    const inside = folds.some((fold) => s * 1000 > fold.startMs && s * 1000 < fold.endMs);
    if (inside) continue;
    const label = big && x(s * 1000) + 34 <= full;
    ruler.push(<span key={s} class={`tick ${big ? "big" : ""}`} style={{ left: `${x(s * 1000)}px` }}>{label ? clock(s * 1000).replace(/\.0$/, "") : ""}</span>);
  }
  let shownUntil = -Infinity;
  const sounds = marks.filter((m) => m.lane === "sounds").sort((a, b) => a.t - b.t);
  const lane = (name: string, children: ComponentChildren, empty?: string) => (
    <div class={`lane l-${name.toLowerCase()}`} role="group" aria-label={name}>{children}{empty && <span class="lane-empty" style={{ left: `${PAD}px` }}>{empty}</span>}</div>);

  return (
    <section class="card score" aria-label="Score" onKeyDown={onKey}>
      <div class="score-bar">
        <span class="title">Score</span>
        <span class="tempo">{steps.length} {steps.length === 1 ? "step" : "steps"} · {clock(duration)}</span>
        <span class="faint small">{note}</span>
        <span class="sp" />
        <div class="seg" role="group" aria-label="Step pictures">
          <button aria-pressed={pictures ? "true" : "false"} onClick={() => setPicturesOn(true)}>Pictures</button>
          <button aria-pressed={pictures ? "false" : "true"} onClick={() => setPicturesOn(false)}>Lines only</button>
        </div>
        <button class="btn sm" disabled={!foldable} aria-pressed={folded ? "true" : "false"} onClick={() => setFolded(!folded)}
          title="Join steps without a comment (F)">{folded ? "Unfold" : "Fold"}</button>
        <div class="seg" role="group" aria-label="Zoom">
          <button aria-label="Zoom out" title="Zoom out ([)" onClick={() => zoomBy(1 / 1.5)}>−</button>
          <button aria-pressed={zoom === "fit" ? "true" : "false"} title="Fit (0)" onClick={() => setZoom("fit")}>Fit</button>
          <button aria-label="Zoom in" title="Zoom in (])" onClick={() => zoomBy(1.5)}>+</button>
        </div>
      </div>
      <div class="score-body">
        <div class="lanes-h" aria-hidden="true">
          <div class="h-ruler" />
          {pictures && <div class="h-pictures">Pictures</div>}
          <div class="h-steps">Steps</div><div class="h-comments">Comments</div><div class="h-sounds">Sounds</div>
          <div class="h-effects">Effects</div><div class="h-cards">Cards</div>
        </div>
        <div class={`score-scroll ${onSeek ? "seeks" : ""}`} ref={scroller} onScroll={hide}
          onClick={onSeek && ((event: MouseEvent) => { const box = scroller.current!.getBoundingClientRect(); onSeek(timeAt(event.clientX - box.left + scroller.current!.scrollLeft)); })}>
          <div class="score-track" style={{ width: `${full}px` }}>
            <div class="ruler" aria-hidden="true">{ruler}</div>
            {pictures && lane("Pictures", steps.map((step) => {
              const fold = inFold(step.index);
              if (fold && fold.from !== step.index) return null;
              const left = x(step.startMs) + 2;
              // Pictures don't overlap: a step too near the last one shown shows none, until zoomed in.
              if (left < shownUntil) return null;
              shownUntil = left + 68;
              const name = fold ? `Steps ${fold.from + 1}–${fold.to + 1}, folded, picture at ${clock(step.startMs)}` : `Step ${step.index + 1}, picture at ${clock(step.startMs)}`;
              return (
                <button key={step.index} class={`pic ${failedAt === step.index ? "bad" : ""}`} style={{ left: `${left}px` }} {...mark(name, step.startMs)}>
                  {step.picture ? <img src={step.picture} alt="" loading="lazy" decoding="async" /> : <span class="nopic">{step.index + 1}</span>}
                </button>);
            }), steps.length ? undefined : "No steps yet")}
            {lane("Steps", [
              ...steps.filter((step) => !inFold(step.index)).map((step) => {
                const left = x(step.startMs), w = Math.max(3, x(step.endMs) - left);
                const now = step.index === current;
                const bad = failedAt === step.index;
                const name = `Step ${step.index + 1}${step.comment ? `: ${step.comment}` : ", no comment"}. ${clock(step.startMs)} to ${clock(step.endMs)}, ${((step.endMs - step.startMs) / 1000).toFixed(1)} s${bad ? ". It failed" : ""}`;
                return { left, node: (
                  <button key={step.index} class={`stepm ${now ? "now" : ""} ${bad ? "bad" : ""}`} style={{ left: `${left}px`, width: `${w}px` }} {...mark(name, step.startMs)}>
                    {w >= 12 + 7.5 * String(step.index + 1).length && <b>{step.index + 1}</b>}{w > 60 && step.comment && <span>{step.comment}</span>}
                  </button>) };
              }),
              ...folds.map((fold) => ({ left: x(fold.startMs), node: (
                <button key={`fold-${fold.from}`} class="stepm fold" style={{ left: `${x(fold.startMs)}px`, width: `${FOLD_W}px` }}
                  {...mark(`Steps ${fold.from + 1} to ${fold.to + 1}, folded: no comments. ${clock(fold.startMs)} to ${clock(fold.endMs)}. Press F to unfold`, fold.startMs)}>
                  <b>{fold.from + 1}–{fold.to + 1}</b>
                </button>) })),
            ].sort((a, b) => a.left - b.left).map((item) => item.node),
            steps.length ? undefined : empty)}
            {lane("Comments", steps.filter((step) => step.comment && !inFold(step.index)).map((step) => {
              const left = x(step.startMs), w = Math.max(6, x(step.endMs) - left - 3);
              return (
                <button key={step.index} class={`comm ${voiced ? "voiced" : ""}`} style={{ left: `${left}px`, width: `${w}px` }}
                  {...mark(`Comment of step ${step.index + 1}, ${voiced ? "voiced" : "not voiced yet"}: “${step.comment}”`, step.startMs)}>
                  <span>{step.comment}</span>
                </button>);
            }))}
            {lane("Sounds", sounds.map((m, i) => (
              <button key={i} class="snd" style={{ left: `${x(m.t) - 6}px` }} {...mark(`Sound ${m.label} at ${clock(m.t)}`, m.t)}>
                <svg viewBox="0 0 12 16" aria-hidden="true"><ellipse cx="4.5" cy="12" rx="4" ry="3" transform="rotate(-20 4.5 12)" /><path d="M8.2 11.5V1.5" /></svg>
                {(i === sounds.length - 1 || x(sounds[i + 1].t) - x(m.t) > 18 + 6.5 * m.label.length) && <span>{m.label}</span>}
              </button>)), hint)}
            {lane("Effects", marks.filter((m) => m.lane === "effects").map((m, i) => {
              const left = x(m.t), w = m.ms ? Math.max(10, x(m.t + m.ms) - left) : 10;
              return (
                <button key={i} class="fx" style={{ left: `${left}px`, width: `${w}px` }}
                  {...mark(`Effect ${m.label} at ${clock(m.t)}${m.ms ? `, ${(m.ms / 1000).toFixed(1)} s` : ""}`, m.t)}>
                  <i /><span>{m.label}</span>
                </button>);
            }), hint)}
            {lane("Cards", marks.filter((m) => m.lane === "cards").map((m, i) => (
              <button key={i} class="crd" style={{ left: `${x(m.t)}px` }} {...mark(`Card ${m.label} at ${clock(m.t)}`, m.t)}>
                <b>{m.label[0]?.toUpperCase()}</b><span>{m.label}</span>
              </button>)), hint)}
            {playhead !== undefined && <div class="playhead" style={{ left: `${x(playhead)}px` }} aria-hidden="true"><span>{clock(playhead)}</span></div>}
          </div>
        </div>
      </div>
      {tip && <div class="tip" role="tooltip" style={{ left: `${Math.min(innerWidth - 160, Math.max(160, tip.x))}px`, top: `${tip.y}px` }}>{tip.text}</div>}
      <p class="score-keys faint small">Tab and the arrows read each mark; <kbd>[</kbd> <kbd>]</kbd> zoom, <kbd>0</kbd> fits, <kbd>F</kbd> folds.</p>
    </section>
  );
}
