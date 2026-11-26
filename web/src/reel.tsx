// The Reel screen (GH-140): a run's own reel, played with its score, transcript, files and numbers (decisions 001 to 004).
import { useEffect, useRef, useState } from "preact/hooks";
import type { ReelView, RunView } from "../../src/studio/api.ts";
import { size, usePolled, when } from "./data.ts";
import { ScoreView, clock, withPictures } from "./score.tsx";

const SPEEDS = [0.5, 1, 1.5, 2];
const SKIP_MS = 5000;

export function Reel({ rest, toast }: { rest: string[]; toast: (text: string) => void }) {
  const id = rest.join("/");
  return id ? <Replay key={id} id={id} toast={toast} /> : <Reels />;
}

/** Without a run in the path: the runs that made a reel and still have it. */
function Reels() {
  const runs = usePolled<RunView[]>("/api/runs");
  const made = runs.data?.filter((run) => run.state === "done" && run.files) ?? [];
  return (
    <section class="screen" aria-labelledby="screen-title">
      <div class="hd"><h1 id="screen-title">Reel</h1><span class="sub">Pick a reel to play</span></div>
      {runs.data && !made.length && <div class="empty">No reels yet: a run that finishes makes one. Start one from <a href="/scripts">Scripts</a>.</div>}
      {made.length > 0 && (
        <div class="card choose">
          <span class="label">Reels</span>
          <ul>{made.map((run) => (
            <li key={`${run.workspace}/${run.id}`} class="runline">
              <a href={`/reel/${run.id}`}>{run.script}.reel <span class="faint">{run.id}</span></a>
              <span class="faint mono">{when(run.endedAt ?? run.startedAt)}</span>
            </li>))}</ul>
        </div>)}
    </section>
  );
}

const url = (id: string, path: string) => `/api/reel-file?run=${encodeURIComponent(id)}&path=${encodeURIComponent(path)}`;

function Replay({ id, toast }: { id: string; toast: (text: string) => void }) {
  const [reel, setReel] = useState<ReelView | undefined>();
  const [problem, setProblem] = useState<string | undefined>();
  const video = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [captions, setCaptions] = useState(true);
  const [loop, setLoop] = useState<number | undefined>();
  const lines = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/reel?run=${encodeURIComponent(id)}`).then(async (response) => {
      if (response.ok) setReel(await response.json() as ReelView);
      else setProblem(((await response.json().catch(() => ({}))) as { error?: string }).error ?? `the studio answered ${response.status}`);
    }, () => setProblem("the studio doesn't answer"));
  }, [id]);

  // The playhead follows the video, a few times a frame at most.
  useEffect(() => {
    let frame = 0;
    let shown = -1;
    const tick = () => {
      const element = video.current;
      if (element) {
        const ms = element.currentTime * 1000;
        if (Math.abs(ms - shown) >= 40) { shown = ms; setT(ms); }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const steps = reel ? withPictures(id, reel.steps) : [];
  const duration = reel?.durationMs ?? 0;
  const at = steps.findLast((step) => step.startMs <= t + 1);
  const looped = steps.find((step) => step.index === loop);

  // Loop a step: back to its start at its end.
  useEffect(() => {
    if (looped && video.current && t >= looped.endMs) video.current.currentTime = looped.startMs / 1000;
  }, [t, looped]);
  useEffect(() => { if (video.current) video.current.playbackRate = speed; }, [speed]);
  useEffect(() => {
    const track = video.current?.textTracks[0];
    if (track) track.mode = captions ? "showing" : "hidden";
  }, [captions, reel]);
  // The current line stays in view in the transcript, without scrolling the page.
  useEffect(() => {
    const box = lines.current;
    const line = box?.querySelector<HTMLElement>("button.on");
    if (box && line && (line.offsetTop < box.scrollTop || line.offsetTop + line.offsetHeight > box.scrollTop + box.clientHeight)) {
      box.scrollTop = line.offsetTop - box.clientHeight / 3;
    }
  }, [at?.index]);

  const seek = (ms: number) => {
    const element = video.current;
    if (!element) return;
    element.currentTime = Math.min(duration, Math.max(0, ms)) / 1000;
    setT(element.currentTime * 1000);
  };
  const play = (from?: number) => {
    if (from !== undefined) seek(from);
    void video.current?.play();
  };
  const toggle = () => { const element = video.current; if (element) element.paused ? void element.play() : element.pause(); };
  const toggleLoop = () => setLoop(loop === undefined ? at?.index ?? steps[0]?.index : undefined);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : document.body;
      if (event.altKey || event.ctrlKey || event.metaKey || target.closest("input, textarea, select, .score, [role=slider]")) return;
      if (event.key === " " && target.closest("button, a")) return;
      if (event.key === " " || event.key === "k" || event.key === "K") toggle();
      else if (event.key === "ArrowLeft") seek(t - SKIP_MS);
      else if (event.key === "ArrowRight") seek(t + SKIP_MS);
      else if (event.key === "l" || event.key === "L") toggleLoop();
      else if (event.key === "c" || event.key === "C") setCaptions(!captions);
      else return;
      event.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  if (!reel) {
    return (
      <section class="screen" aria-labelledby="screen-title">
        <div class="hd"><h1 id="screen-title">{id}</h1></div>
        {problem ? <div class="problem" role="alert">{problem}. <a href={`/run/${id}`}>Open the run</a>.</div> : <div class="empty">Opening the reel of {id}…</div>}
      </section>
    );
  }

  const script = id.replace(/\/\d+$/, "");
  const vtt = reel.files.some((file) => file.path === "captions.vtt");
  const copy = (text: string, what: string) => navigator.clipboard?.writeText(text).then(() => toast(`Copied ${what}.`), () => toast(text));
  return (
    <section class="screen" aria-labelledby="screen-title">
      <div class="hd">
        <h1 id="screen-title">{script}.reel</h1>
        <span class="sub">made by <a href={`/run/${id}`}>{id}</a>{reel.voice ? <> · <span class="mono">{reel.voice}</span></> : null}</span>
        <span class="sp" />
        <button class="btn" onClick={() => copy(reel.folder, "the reel's folder")}>Copy folder</button>
        <button class="btn" onClick={() => copy(clock(t), "the time")}>Copy time</button>
      </div>
      <div class="stage">
        <div class="under">
          <div class="frame player">
            <video ref={video} src={url(id, "video.mp4")} preload="auto" playsInline onClick={toggle}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
              aria-label={`${script}.reel`}>
              {vtt && <track kind="captions" src={url(id, "captions.vtt")} srclang="en" label="Captions" default />}
            </video>
            <div class="frame-bar">
              <span class="chip">{clock(t)}</span>
              {looped && <span class="chip">looping step {looped.index + 1}</span>}
              {speed !== 1 && <span class="chip">{speed}×</span>}
            </div>
          </div>
          <Transport t={t} duration={duration} steps={steps} playing={playing} speed={speed} captions={captions} vtt={vtt}
            looping={loop !== undefined} toggle={toggle} seek={seek} setSpeed={setSpeed} setCaptions={setCaptions} toggleLoop={toggleLoop} />
        </div>
        <div class="card panel">
          <section>
            <span class="label">Transcript</span>
            <div class="transcript" ref={lines}>
              {steps.map((step) => (
                <button key={step.index} class={at?.index === step.index ? "on" : undefined} onClick={() => play(step.startMs)}
                  aria-current={at?.index === step.index ? "true" : undefined}>
                  <span>{clock(step.startMs)}</span>
                  <span>{step.comment ?? <span class="faint">Step {step.index + 1}, no comment</span>}</span>
                </button>))}
            </div>
          </section>
          <section>
            <div class="facts">
              <div><b>{clock(duration)}</b><span>length</span></div>
              <div><b>{size(reel.bytes)}</b><span>size</span></div>
              <div><b>{steps.length}</b><span>steps</span></div>
            </div>
            <Level src={url(id, "video.mp4")} duration={duration} t={t} seek={seek} />
          </section>
          <section>
            <span class="label">Files</span>
            <div class="files">{reel.files.map((file) => (
              <div key={file.path}><a href={url(id, file.path)} target="_blank" rel="noreferrer">{file.path}</a><span>{size(file.bytes)}</span></div>))}
            </div>
          </section>
        </div>
      </div>
      <ScoreView steps={steps} marks={reel.marks} duration={duration} playhead={t} current={at?.index} voiced
        empty="No steps" note="· on the reel's clock · click to go there" onSeek={(ms) => seek(ms)} />
    </section>
  );
}

function Transport({ t, duration, steps, playing, speed, captions, vtt, looping, toggle, seek, setSpeed, setCaptions, toggleLoop }: {
  t: number; duration: number; steps: { index: number; startMs: number }[]; playing: boolean; speed: number; captions: boolean; vtt: boolean;
  looping: boolean; toggle: () => void; seek: (ms: number) => void; setSpeed: (speed: number) => void; setCaptions: (on: boolean) => void; toggleLoop: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | undefined>();
  const share = (ms: number) => `${(Math.min(duration, Math.max(0, ms)) / Math.max(1, duration)) * 100}%`;
  const msAt = (event: PointerEvent) => {
    const box = track.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * duration;
  };
  const onKey = (event: KeyboardEvent) => {
    const to = event.key === "ArrowLeft" ? t - SKIP_MS : event.key === "ArrowRight" ? t + SKIP_MS : event.key === "Home" ? 0 : event.key === "End" ? duration : undefined;
    if (to === undefined) return;
    event.preventDefault();
    seek(to);
  };
  return (
    <div class="transport">
      <button class="play" onClick={toggle} aria-label={playing ? "Pause (Space)" : "Play (Space)"}>
        {playing ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" /></svg>
          : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z" /></svg>}
      </button>
      <div class="track" ref={track} role="slider" tabIndex={0} aria-label="Time" aria-valuemin={0} aria-valuemax={Math.round(duration / 1000)}
        aria-valuenow={Math.round(t / 1000)} aria-valuetext={`${clock(t)} of ${clock(duration)}`} onKeyDown={onKey}
        onPointerDown={(event) => { track.current!.setPointerCapture(event.pointerId); seek(msAt(event)); }}
        onPointerMove={(event) => { setHover(msAt(event)); if (track.current!.hasPointerCapture(event.pointerId)) seek(msAt(event)); }}
        onPointerLeave={() => setHover(undefined)}>
        <div class="rail2" />
        {steps.map((step) => <i key={step.index} class="tk" style={{ left: share(step.startMs) }} />)}
        <div class="fill" style={{ width: share(t) }} />
        <div class="knob" style={{ left: share(t) }} />
        {hover !== undefined && <span class="hov" style={{ left: share(hover) }}>{clock(hover)}</span>}
      </div>
      <span class="mono faint">{clock(t)} / {clock(duration)}</span>
      <div class="seg" role="group" aria-label="Speed">
        {SPEEDS.map((s) => <button key={s} aria-pressed={speed === s ? "true" : "false"} onClick={() => setSpeed(s)}>{s}×</button>)}
      </div>
      <button class="btn sm" aria-pressed={looping ? "true" : "false"} onClick={toggleLoop} title="Loop the step under the playhead (L)">Loop step</button>
      {vtt && <button class="btn sm" aria-pressed={captions ? "true" : "false"} onClick={() => setCaptions(!captions)} title="Captions (C)">Captions</button>}
    </div>
  );
}

interface Levels { bars: number[]; peak: number; average: number }

const dbfs = (value: number) => value > 0 ? 20 * Math.log10(value) : -Infinity;

/** The sound's level, half a second a bar, decoded in the browser: dBFS, not LUFS (decision 004). */
function Level({ src, duration, t, seek }: { src: string; duration: number; t: number; seek: (ms: number) => void }) {
  const [levels, setLevels] = useState<Levels | "none" | undefined>();
  useEffect(() => {
    let gone = false;
    const context = new AudioContext();
    fetch(src).then((response) => response.arrayBuffer()).then((bytes) => context.decodeAudioData(bytes)).then((audio) => {
      const step = Math.round(audio.sampleRate / 2);
      const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
      const bars: number[] = [];
      let [peak, sum] = [0, 0];
      for (let start = 0; start < audio.length; start += step) {
        let squares = 0;
        const end = Math.min(audio.length, start + step);
        for (const data of channels) for (let i = start; i < end; i++) { const v = data[i]; squares += v * v; peak = Math.max(peak, Math.abs(v)); }
        sum += squares;
        bars.push(dbfs(Math.sqrt(squares / ((end - start) * channels.length))));
      }
      if (!gone) setLevels({ bars, peak: dbfs(peak), average: dbfs(Math.sqrt(sum / (audio.length * channels.length))) });
    }).catch(() => { if (!gone) setLevels("none"); }).finally(() => void context.close());
    return () => { gone = true; };
  }, [src]);
  if (levels === undefined) return <p class="faint small">Measuring the sound…</p>;
  if (levels === "none" || !levels.bars.length) return <p class="faint small">No sound to measure.</p>;
  const height = (db: number) => `${Math.max(2, Math.min(100, ((db + 60) / 60) * 100))}%`;
  const now = Math.floor(t / 500);
  return (
    <div class="level">
      <div class="level-head"><span class="label">Level</span>
        <span class="mono faint">average {levels.average.toFixed(1)} dBFS · peak {levels.peak.toFixed(1)} dBFS</span></div>
      <div class="loud" role="img" aria-label={`Sound level every half second; average ${levels.average.toFixed(1)} dBFS, peak ${levels.peak.toFixed(1)} dBFS`}
        onClick={(event) => { const box = (event.currentTarget as HTMLElement).getBoundingClientRect(); seek(((event.clientX - box.left) / box.width) * duration); }}>
        {levels.bars.map((db, i) => <i key={i} class={i === now ? "on" : undefined} style={{ height: height(db) }} />)}
      </div>
    </div>
  );
}
