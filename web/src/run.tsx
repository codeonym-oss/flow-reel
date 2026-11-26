// The Run screen (GH-137): a run as it goes, from its own socket: the phases, what the stage says, its steps, log, journal
// and failures, and Cancel, Resume and Run again. Closing the page closes only the socket: the run goes on.
import { useEffect, useRef, useState } from "preact/hooks";
import type { ClientMessage, LiveRun, RunEntry, RunLog, RunView, ServerMessage, StartedRun } from "../../src/studio/api.ts";
import { isGoing, send, shown, took, usePolled, when } from "./data.ts";
import { navigate } from "./route.ts";
import { Score } from "./score.tsx";
import { label } from "./workspaces.tsx";

const PHASES = [["record", "Recording"], ["voice", "Voicing"], ["plan", "Planning"], ["render", "Rendering"], ["publish", "Publishing"]] as const;
const DOING: Record<string, string> = Object.fromEntries(PHASES.map(([phase, name]) => [phase, name.toLowerCase()]));
const AGAIN_MS = 2000;

/** The live picture's newest JPEG, as an object URL, and who shows it: a picture doesn't re-render the screen. */
interface Pictures { latest(): string | undefined; subscribe(show: (url: string) => void): () => void; snapshot(): string | undefined }

interface Watched { run?: LiveRun; entries: RunEntry[]; problem?: string; gone?: boolean; live?: boolean; pictures: Pictures; cancel: () => void }

/** A run's socket: its entries and state as they come; it opens again when the studio comes back. */
function useRunSocket(id: string): Watched {
  const [state, setState] = useState<Omit<Watched, "cancel" | "pictures">>({ entries: [] });
  const socket = useRef<WebSocket | undefined>(undefined);
  const [pictures] = useState(() => {
    let latest: string | undefined;
    let blob: Blob | undefined;
    const shows = new Set<(url: string) => void>();
    return {
      latest: () => latest,
      /** A URL of its own for the newest picture, kept by the score until the page closes (GH-139 decision 003). */
      snapshot: () => blob && URL.createObjectURL(blob),
      subscribe: (show: (url: string) => void) => { shows.add(show); return () => { shows.delete(show); }; },
      put(picture: Blob | undefined) {
        const before = latest;
        const url = picture && URL.createObjectURL(picture);
        blob = picture;
        latest = url;
        if (url) for (const show of shows) show(url);
        if (before) URL.revokeObjectURL(before);
      },
    };
  });
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?run=${encodeURIComponent(id)}`);
      socket.current = ws;
      // Every opening sends the whole journal again.
      let entries: RunEntry[] = [];
      ws.onmessage = (event) => {
        // A binary message is a picture of the app while it is recorded (GH-138).
        if (event.data instanceof Blob) {
          pictures.put(event.data);
          setState((before) => before.live ? before : { ...before, live: true });
          return;
        }
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (message.type === "entries") { entries = [...entries, ...message.entries]; setState((before) => ({ ...before, entries, gone: false })); }
        else if (message.type === "run") setState((before) => ({ ...before, run: message.run, problem: undefined, gone: false }));
        else if (message.type === "problem") setState((before) => ({ ...before, problem: message.error }));
      };
      ws.onclose = () => {
        if (stopped) return;
        setState((before) => ({ ...before, gone: true }));
        timer = setTimeout(open, AGAIN_MS);
      };
    };
    setState({ entries: [] });
    open();
    return () => {
      stopped = true; clearTimeout(timer); socket.current?.close();
      pictures.put(undefined);
    };
  }, [id]);
  const cancel = () => socket.current?.send(JSON.stringify({ v: 1, type: "cancel" } satisfies ClientMessage));
  return { ...state, pictures, cancel };
}

export function Run({ rest, toast }: { rest: string[]; toast: (text: string) => void }) {
  const id = rest.join("/");
  return id ? <Watch key={id} id={id} toast={toast} /> : <Choose />;
}

/** Without a run in the path: the runs going on, and the latest ones. */
function Choose() {
  const runs = usePolled<RunView[]>("/api/runs");
  const going = runs.data?.filter(isGoing) ?? [];
  const latest = runs.data?.filter((run) => !isGoing(run)).slice(0, 8) ?? [];
  return (
    <section class="screen" aria-labelledby="screen-title">
      <div class="hd"><h1 id="screen-title">Run</h1><span class="sub">Pick a run to watch</span></div>
      {runs.data && !runs.data.length && <div class="empty">No runs yet: run a script from <a href="/scripts">Scripts</a>, or with <code>flow-reel compose</code>.</div>}
      {[["Going on now", going], ["Latest", latest]].map(([title, list]) => (list as RunView[]).length > 0 && (
        <div class="card choose" key={title as string}>
          <span class="label">{title as string}</span>
          <ul>{(list as RunView[]).map((run) => (
            <li key={`${run.workspace}/${run.id}`} class="runline">
              <a href={`/run/${run.id}`}>{run.id} <span class="faint">{run.script}</span></a>
              <span class="pair"><span class={`st ${shown(run)}`}>{label(run)}</span><span class="faint mono">{when(run.startedAt)}</span></span>
            </li>))}</ul>
        </div>))}
    </section>
  );
}

function Watch({ id, toast }: { id: string; toast: (text: string) => void }) {
  const { run, entries, problem, gone, live, pictures, cancel } = useRunSocket(id);
  const [tab, setTab] = useState<"steps" | "log" | "journal" | "failures">("steps");
  useEffect(() => { if (problem) toast(problem); }, [problem]);
  useEffect(() => { if (run?.state === "failed") setTab("failures"); }, [run?.state === "failed"]);
  if (!run) {
    return <section class="screen"><div class="hd"><h1 id="screen-title">{id}</h1></div>
      {gone ? <div class="problem" role="alert">There is no run {id} on this computer, or the studio doesn't answer.</div> : <div class="empty">Opening {id}…</div>}</section>;
  }
  const steps = stepsOf(entries, run);
  const failures = run.state === "failed" ? 1 : 0;
  return (
    <section class="screen" aria-labelledby="screen-title">
      <div class="hd">
        <h1 id="screen-title">{run.id}</h1>
        <span class="sub"><span class="mono">{run.path}</span> · <span class={`st ${run.waiting ? "waiting" : run.state}`}>{saying(run)}</span></span>
        <span class="sp" />
        <Actions run={run} cancel={cancel} toast={toast} />
      </div>
      <Meta run={run} />
      {gone && <div class="banner" role="status">The studio doesn't answer; it opens the run again when it does.</div>}
      <div class="stage">
        <div class="under">
          <Stage run={run} steps={steps.length} pictures={live ? pictures : undefined} target={targetOf(entries)} />
          <Phases run={run} />
        </div>
        <div class="card panel">
          <section>
            <div class="tabs" role="tablist">
              {([["steps", "Steps", steps.length], ["log", "Log", ""], ["journal", "Journal", entries.length], ["failures", "Failures", failures]] as const).map(([key, name, count]) => (
                <button key={key} role="tab" aria-selected={tab === key ? "true" : "false"} onClick={() => setTab(key)}>
                  {name}<span class={`cnt ${key === "failures" && count ? "bad" : ""}`}>{count}</span>
                </button>))}
            </div>
            <div role="tabpanel">
              {tab === "steps" && <Steps steps={steps} run={run} />}
              {tab === "log" && <Log id={run.id} going={!isEnded(run)} />}
              {tab === "journal" && <pre class="log">{entries.map((entry) => JSON.stringify(entry)).join("\n")}</pre>}
              {tab === "failures" && (failures ? <pre class="err">{`${run.phase ? `${DOING[run.phase] ?? run.phase} failed:\n` : ""}${run.why}`}</pre>
                : <p class="faint small">Nothing failed{isEnded(run) ? "" : " so far"}.</p>)}
            </div>
          </section>
          <section><div class="note">
            <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 7v4M8 5v.01" /></svg>
            <span>You are watching. Closing this tab or the studio doesn't stop the run.</span>
          </div></section>
        </div>
      </div>
      <Score run={run} entries={entries} snapshots={live ? pictures : undefined} />
    </section>
  );
}

const isEnded = (run: LiveRun) => run.state === "done" || run.state === "failed" || run.state === "stopped" || run.state === "cancelled";

/** What a run is doing, in a few words. */
function saying(run: LiveRun): string {
  if (run.waiting) return `waiting${run.waiting.behind ? ` for ${run.waiting.behind}` : ""} to start ${DOING[run.waiting.phase] ?? run.waiting.phase}`;
  if (run.cancelling) return "cancelling";
  if (run.state === "running" || run.state === "held") return run.phase ? DOING[run.phase] ?? run.phase : run.state;
  if (run.state === "failed" || run.state === "stopped") return `${run.state}${run.phase ? ` during ${DOING[run.phase]}` : ""}`;
  return run.state;
}

function Actions({ run, cancel, toast }: { run: LiveRun; cancel: () => void; toast: (text: string) => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setAsking(false), [run.state]);
  const act = async (what: () => Promise<void>) => {
    setBusy(true);
    try { await what(); } catch (error) { toast((error as Error).message); }
    setBusy(false);
  };
  const again = () => act(async () => {
    const started = await send<StartedRun>("/api/runs", { workspace: run.workspace, name: run.script });
    toast(`${started.id} started.`);
    navigate(`/run/${started.id}`);
  });
  const resume = () => act(async () => { await send<StartedRun>("/api/runs/resume", { run: run.id }); toast(`${run.id} goes on.`); });
  if (!isEnded(run)) {
    if (run.cancelling) return <span class="faint small">Cancelling…</span>;
    return asking
      ? <span class="confirm"><span class="small">Cancel {run.id}? A cancelled run can't go on.</span>
        <button class="btn danger" onClick={() => { cancel(); setAsking(false); }}>Cancel run</button>
        <button class="btn" onClick={() => setAsking(false)}>Keep it going</button></span>
      : <span class="confirm"><button class="btn danger" onClick={() => setAsking(true)}>Cancel run</button></span>;
  }
  return (
    <span class="confirm">
      {run.state === "done" && <a class="btn primary" href={`/reel/${run.id}`}>Open the reel</a>}
      {run.resume && <button class="btn primary" disabled={busy} onClick={resume}>{busy ? "Starting…" : `Resume from ${DOING[run.resume] ?? run.resume}`}</button>}
      {(run.state === "failed" || run.state === "cancelled" || run.lost) &&
        <button class={`btn ${run.resume ? "" : "primary"}`} disabled={busy} onClick={again}>Run again</button>}
    </span>
  );
}

function Meta({ run }: { run: LiveRun }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (isEnded(run)) return;
    const every = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(every);
  }, [isEnded(run)]);
  const end = run.endedAt ? Date.parse(run.endedAt) : now;
  return (
    <div class="meta">
      <span>{isEnded(run) ? "Took" : "Elapsed"} <b class="mono">{took((end - Date.parse(run.startedAt)) / 1000)}</b></span>
      <span>Started <b class="mono">{when(run.startedAt)}</b></span>
      <span>Voice <b>{run.voice}</b></span>
      <span>flow-reel <b class="mono">{run.flowReel}</b></span>
    </div>
  );
}

interface Target { target: string; box: [number, number, number, number] }

/** The latest target the recording clicked or typed into, while it records (GH-138 decision 004). */
function targetOf(entries: RunEntry[]): Target | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]!;
    if (entry.phase === "record" && entry.type !== "progress") return undefined;
    const what = entry.what as { type?: string } & Partial<Target> | undefined;
    if (entry.type === "progress" && what?.type === "target" && what.target && what.box) return { target: what.target, box: what.box };
  }
  return undefined;
}

const TARGETS_KEY = "flow-reel.targets";
const remembered = () => { try { return localStorage.getItem(TARGETS_KEY) !== "off"; } catch { return true; } };

/** The app while it is recorded, with its target; otherwise what the run is doing (decision 005). */
function LivePicture({ pictures, alt }: { pictures: Pictures; alt: string }) {
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const show = (url: string) => { if (img.current) img.current.src = url; };
    const latest = pictures.latest();
    if (latest) show(latest);
    return pictures.subscribe(show);
  }, [pictures]);
  return <img ref={img} alt={alt} />;
}

function Stage({ run, steps, pictures, target }: { run: LiveRun; steps: number; pictures?: Pictures; target?: Target }) {
  const [targets, setTargets] = useState(remembered);
  const recording = run.state === "running" && run.phase === "record" && !run.waiting;
  if (recording && pictures) {
    const flip = () => { setTargets(!targets); try { localStorage.setItem(TARGETS_KEY, targets ? "off" : "on"); } catch { /* not kept */ } };
    const [x, y, w, h] = target?.box ?? [0, 0, 0, 0];
    return (
      <div class="frame live">
        <LivePicture pictures={pictures} alt={`The app as ${run.id} records it, step ${Math.max(1, steps)}`} />
        {targets && target && <div class="target" style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}><span>{target.target}</span></div>}
        <div class="frame-bar">
          <span class="chip"><i class="pulse" />Live · step {Math.max(1, steps)}</span>
          <button class={`chip ${targets ? "on" : ""}`} aria-pressed={targets ? "true" : "false"} onClick={flip}>Targets</button>
        </div>
      </div>
    );
  }
  let title: string, text: string;
  if (run.waiting) {
    title = run.waiting.behind ? `Waiting for ${run.waiting.behind}` : "Waiting for its turn";
    text = `One run at a time records, voices on this computer or renders. This run starts ${DOING[run.waiting.phase] ?? run.waiting.phase} as soon as it is its turn.`;
  } else if (run.state === "queued") {
    title = "Starting"; text = "The run's process is starting.";
  } else if (run.state === "running" || run.state === "held") {
    title = run.cancelling ? "Cancelling" : `${PHASES.find(([phase]) => phase === run.phase)?.[1] ?? "Working"}`;
    text = run.phase === "record" ? `Step ${Math.max(1, steps)} of the script. The app shows here as soon as its first picture arrives.`
      : `${run.finished.length} of ${PHASES.length} phases done.`;
  } else if (run.state === "failed") {
    title = `It failed during ${DOING[run.phase ?? ""] ?? "the run"}`; text = run.why ?? "";
  } else if (run.state === "stopped") {
    const kept = run.finished.map((phase) => DOING[phase]).join(", ");
    title = "The run's process stopped";
    text = run.resume ? `${kept ? `${kept[0]!.toUpperCase()}${kept.slice(1)}: done and kept. ` : ""}Resume goes on from ${DOING[run.resume]}${run.resume === "record" ? "" : "; it never records again"}.`
      : run.lost ? `It can't go on: ${run.lost}. Run again starts a new run.` : run.why ?? "";
  } else if (run.state === "done") {
    title = "The reel is ready"; text = run.reel ?? "";
  } else {
    title = "Cancelled"; text = "Run again starts a new run of the script.";
  }
  return (
    <div class={`frame quiet ${run.state === "failed" ? "bad" : ""}`}>
      <div class="veil"><div><h3>{title}</h3><p>{text}</p></div></div>
    </div>
  );
}

function Phases({ run }: { run: LiveRun }) {
  const at = PHASES.findIndex(([phase]) => phase === (run.waiting?.phase ?? run.phase));
  return (
    <div class="trans" aria-label="Phases">
      <div class="tline">
        {PHASES.map(([phase], i) => {
          const done = run.state === "done" || run.finished.includes(phase);
          const here = i === at && !done;
          const going = here && (run.state === "running" || run.state === "held") && !run.waiting;
          return <div key={phase} class={`${going ? "now" : ""} ${here && run.state === "failed" ? "bad" : ""}`}><i style={{ width: done ? "100%" : going ? "100%" : "0" }} class={going ? "pulse" : undefined} /></div>;
        })}
      </div>
      <div class="tlab">
        {PHASES.map(([phase, name], i) => (
          <span key={phase} class={i === at && (run.state === "running" || run.state === "held") ? "now" : undefined}>
            {name}{i === at && run.state === "failed" ? " · failed" : i === at && run.state === "stopped" ? " · stopped" : ""}
          </span>))}
      </div>
    </div>
  );
}

interface Step { index: number; comment?: string; seconds?: number; state: "done" | "now" | "bad" }

/** The recording's steps from its progress entries, and how long each took (decision 004). */
function stepsOf(entries: RunEntry[], run: LiveRun): Step[] {
  const steps: { index: number; comment?: string; at: number }[] = [];
  let ended: number | undefined;
  for (const entry of entries) {
    const what = entry.what as { type?: string; index?: number; comment?: string } | undefined;
    if (entry.type === "phase-started" && entry.phase === "record") { steps.length = 0; ended = undefined; }
    if (entry.type === "progress" && entry.phase === "record" && what?.type === "step" && typeof what.index === "number") {
      steps.push({ index: what.index, ...(what.comment ? { comment: what.comment } : {}), at: Date.parse(entry.at) });
    }
    if ((entry.type === "phase-finished" && entry.phase === "record") || ((entry.type === "failed" || entry.type === "stopped" || entry.type === "cancelled") && ended === undefined && steps.length)) {
      ended ??= Date.parse(entry.at);
    }
  }
  const failedHere = run.state === "failed" && run.phase === "record";
  return steps.map((step, i) => {
    const until = steps[i + 1]?.at ?? ended;
    const last = i === steps.length - 1;
    return { index: step.index, ...(step.comment ? { comment: step.comment } : {}), ...(until !== undefined ? { seconds: (until - step.at) / 1000 } : {}),
      state: last && failedHere ? "bad" : last && until === undefined ? "now" : "done" };
  });
}

function Steps({ steps, run }: { steps: Step[]; run: LiveRun }) {
  if (!steps.length) {
    return <p class="faint small">{run.finished.includes("record") ? "The recording kept no steps." : "The steps show as the script is recorded."}</p>;
  }
  return (
    <div class="steps">
      {steps.map((step) => (
        <div key={step.index} class={`stp ${step.state === "now" ? "cur" : step.state === "bad" ? "bad" : ""}`}>
          <span class="n">{step.index + 1}</span>
          <span>{step.comment ?? <span class="faint">no comment</span>}</span>
          <span class="d">{step.state === "now" ? "now" : step.seconds !== undefined ? `${step.seconds.toFixed(1)} s` : ""}</span>
        </div>))}
    </div>
  );
}

/** The run's log, asked again every 2 seconds while the run goes (decision 003). */
function Log({ id, going }: { id: string; going: boolean }) {
  const [log, setLog] = useState<RunLog>();
  const box = useRef<HTMLPreElement>(null);
  useEffect(() => {
    let stopped = false;
    const ask = async () => {
      try {
        const response = await fetch(`/api/log?run=${encodeURIComponent(id)}`);
        if (response.ok && !stopped) setLog(await response.json() as RunLog);
      } catch { /* the banner says the studio is gone */ }
    };
    ask();
    if (!going) return () => { stopped = true; };
    const every = setInterval(ask, 2000);
    return () => { stopped = true; clearInterval(every); };
  }, [id, going]);
  useEffect(() => {
    const pre = box.current;
    if (pre && pre.scrollHeight - pre.scrollTop - pre.clientHeight < 40) pre.scrollTop = pre.scrollHeight;
  }, [log?.text]);
  if (!log) return null;
  if (!log.text) return <p class="faint small">Nothing printed{going ? " so far" : ""}: the script, the browser and the renderer write here.</p>;
  return <pre class="log" ref={box}>{log.cut ? `… ${Math.round(log.cut / 1024)} KB before this are in the run's log.txt\n` : ""}{log.text}</pre>;
}
