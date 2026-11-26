// The Workspaces screen (GH-135): every workspace on this computer with its runs, adding one, today's turns at heavy work,
// and every run.
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AddedWorkspace, CleanPreview, Cleaned, RunView, TurnView, WorkspaceView } from "../../src/studio/api.ts";
import { isGoing, send, shown, size, took, usePolled, when } from "./data.ts";
import { navigate } from "./route.ts";

const PHASES = 5;

export function Workspaces({ toast }: { toast: (text: string) => void }) {
  const list = usePolled<WorkspaceView[]>("/api/workspaces");
  const runs = usePolled<RunView[]>("/api/runs");
  const all = list.data ?? [];
  const most = Math.max(1, ...all.map(({ bytes }) => bytes));
  return (
    <section class="screen" aria-labelledby="screen-title">
      <div class="hd">
        <h1 id="screen-title">Workspaces</h1>
        {list.data && <span class="sub">{all.length === 1 ? "1 project" : `${all.length} projects`} on this computer</span>}
        <span class="sp" />
        <span class="faint note">Runs started in a terminal or by an agent show up here as they start.</span>
      </div>
      {list.error && !list.data && <div class="problem" role="alert">{list.error}</div>}
      <div class="ws-grid">
        {all.map((workspace) => <Card key={workspace.id} workspace={workspace} most={most} toast={toast} refresh={list.refresh} />)}
        <Add added={(text) => { toast(text); list.refresh(); runs.refresh(); }} />
      </div>
      <Today workspaces={all} />
      <EveryRun runs={runs.data} workspaces={all} />
    </section>
  );
}

function Card({ workspace: w, most, toast, refresh }: { workspace: WorkspaceView; most: number; toast: (text: string) => void; refresh: () => void }) {
  const [asking, setAsking] = useState<CleanPreview | "busy">();
  const longest = Math.max(1, ...w.last.map(({ seconds }) => seconds));
  const latest = w.latest;
  const ask = async () => {
    setAsking("busy");
    try { setAsking(await (await fetch(`/api/clean?workspace=${w.id}`)).json() as CleanPreview); }
    catch { setAsking(undefined); toast("The studio doesn't answer."); }
  };
  const remove = async () => {
    setAsking("busy");
    try {
      const cleaned = await send<Cleaned>("/api/clean", { workspace: w.id });
      toast(cleaned.runs ? `Removed ${size(cleaned.bytes)} from ${w.title}. Its runs stay listed.` : `Nothing to remove from ${w.title}.`);
    } catch (error) { toast((error as Error).message); }
    setAsking(undefined);
    refresh();
  };
  return (
    <div class="card ws">
      <div class="row">
        <h3><a href={`/scripts/${w.slug}`}>{w.title}</a></h3>
        {latest ? <span class={`st ${shown(latest)}`}>{label(latest)}</span> : <span class="faint small">no runs yet</span>}
      </div>
      <div class="path" title={w.root}>{w.missing ? <span class="why">folder gone: {w.root}</span> : w.root} · {w.slug}</div>
      <div class="strip" title="The last runs, oldest first; the height is how long each took" aria-hidden="true">
        {w.last.map(({ state, seconds }) => (
          <i class={state === "failed" ? "f" : state === "cancelled" ? "c" : state === "done" || state === "stopped" ? "" : "r"}
            style={{ height: `${Math.max(12, seconds / longest * 100)}%` }} />
        ))}
      </div>
      <div class="row muted small">
        <span>{w.missing ? "" : `${w.scripts === 1 ? "1 script" : `${w.scripts} scripts`} · `}{w.runs === 1 ? "1 run" : `${w.runs} runs`}</span>
        <span class="mono">{w.bytes ? `${size(w.bytes)} of run files` : "no run files"}</span>
      </div>
      <div class="disk" aria-hidden="true"><i style={{ width: `${w.bytes / most * 100}%` }} /></div>
      <div class="row">
        {asking === undefined || asking === "busy" ? <>
          <span class="faint small">History stays; reels stay.</span>
          <button class="btn sm" disabled={asking === "busy" || !w.bytes} onClick={ask}>Clean</button>
        </> : asking.runs ? <>
          <span class="small">Remove the files of {asking.runs === 1 ? "1 finished run" : `${asking.runs} finished runs`}?</span>
          <span class="pair"><button class="btn sm danger" onClick={remove}>Remove {size(asking.bytes)}</button>
            <button class="btn sm" onClick={() => setAsking(undefined)}>Keep</button></span>
        </> : <>
          <span class="small">Nothing to remove: the runs with files can still go on.</span>
          <button class="btn sm" onClick={() => setAsking(undefined)}>OK</button>
        </>}
      </div>
    </div>
  );
}

function label(run: RunView): string {
  if (run.waiting) return `waiting${run.waiting.behind ? ` for ${run.waiting.behind}` : ""}`;
  if (isGoing(run)) return run.phase ? `${run.state} · ${run.phase}` : run.state;
  if (run.resume) return `${run.state} · resumable`;
  return run.state;
}

function Add({ added }: { added: (text: string) => void }) {
  const [path, setPath] = useState("");
  const [offer, setOffer] = useState<Extract<AddedWorkspace, { needs: "init" }>>();
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (init?: { title: string }) => {
    setBusy(true);
    setProblem(undefined);
    try {
      const answer = await send<AddedWorkspace>("/api/workspaces", { path: path.trim(), ...(init ? { init } : {}) });
      if ("needs" in answer) { setOffer(answer); setTitle(answer.title); }
      else { added(`${answer.added.title} (${answer.added.slug}) is a workspace on this computer.`); setPath(""); setOffer(undefined); }
    } catch (error) { setProblem((error as Error).message); }
    setBusy(false);
  };
  return (
    <form class="add" onSubmit={(event) => { event.preventDefault(); if (path.trim()) submit(); else setProblem("Type the project's folder first."); }}>
      <label class="label" for="ws-path">Add a workspace</label>
      <div class="line">
        <input class="field" id="ws-path" placeholder="~/code/my-app" value={path} autocomplete="off" spellcheck={false}
          onInput={(event) => { setPath(event.currentTarget.value); setOffer(undefined); }} />
        <button class="btn primary" disabled={busy}>Add</button>
      </div>
      {offer ? <div class="offer">
        <span class="small"><span class="mono">{offer.root}</span> has no flow-reel.json yet. Make it a workspace, with its scripts
          in <span class="mono">{offer.scripts}/</span>, as <span class="mono">flow-reel init</span> does:</span>
        <div class="line">
          <input class="field ui" aria-label="The workspace's title" value={title} onInput={(event) => setTitle(event.currentTarget.value)} />
          <button type="button" class="btn" disabled={busy || !title.trim()} onClick={() => submit({ title: title.trim() })}>Make it a workspace</button>
        </div>
      </div> : !problem && <span class="faint small">A folder with a flow-reel.json. Without one, the studio offers to make it, as <span class="mono">flow-reel init</span> does.</span>}
      {problem && <span class="why" role="alert">{problem}</span>}
    </form>
  );
}

/** Today: each workspace's turns at heavy work since midnight, on one line each, and all of them on the first. */
function Today({ workspaces }: { workspaces: WorkspaceView[] }) {
  const midnight = useMemo(() => { const day = new Date(); day.setHours(0, 0, 0, 0); return day.toISOString(); }, []);
  const { data: turns } = usePolled<TurnView[]>(`/api/today?since=${encodeURIComponent(midnight)}`);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const seen = new ResizeObserver(([entry]) => setWidth(Math.max(640, Math.floor(entry!.contentRect.width))));
    if (box.current) seen.observe(box.current);
    return () => seen.disconnect();
  }, []);
  const now = Date.now();
  const rows = [{ id: "", title: "Heavy work" }, ...workspaces.filter(({ id }) => turns?.some((turn) => turn.workspace === id))];
  const first = Math.min(now - 3600_000, ...(turns ?? []).map(({ from }) => Date.parse(from)));
  const start = Math.max(Date.parse(midnight), Math.floor(first / 3600_000) * 3600_000);
  const end = Math.ceil((now + 1) / 3600_000) * 3600_000;
  const left = 150, right = 16, top = 22, height = 30;
  const x = (t: number) => left + (t - start) / (end - start) * (width - left - right);
  const hours: number[] = [];
  for (let t = start; t <= end; t += 3600_000) hours.push(t);
  const every = Math.ceil(48 / (x(start + 3600_000) - x(start)));
  const going = turns?.find((turn) => !turn.to && turn.kind === "turn");
  return (
    <div class="card today">
      <div class="hd">
        <h2>Today</h2><span class="sub">turns at heavy work: recordings, renders and local voices, one at a time</span><span class="sp" />
        {going && <span class="faint mono">now: {going.run} {going.phase === "record" ? "records" : going.phase === "render" ? "renders" : "voices"}</span>}
      </div>
      <div class="scrollx" ref={box}>
        {turns && !turns.length ? <p class="faint small">No heavy work today yet.</p> :
          <svg width={width} height={top + rows.length * height + 4} role="img" aria-label="Today's turns at heavy work">
            {hours.map((t) => <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={top - 4} y2={top + rows.length * height} stroke="var(--rule-2)" />
              {t < end && (t - start) / 3600_000 % every === 0 && <text x={x(t) + 3} y="12" class="tick">{new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</text>}
            </g>)}
            <line x1={x(now)} x2={x(now)} y1={top - 6} y2={top + rows.length * height} stroke="var(--now)" stroke-width="1.5" />
            {rows.map((row, i) => <g key={row.id}>
              <text x="0" y={top + i * height + 19} class={i ? "lane" : "lane first"}>{row.title}</text>
              <line x1={left} x2={width - right} y1={top + (i + 1) * height} y2={top + (i + 1) * height} stroke="var(--rule-2)" />
            </g>)}
            {(turns ?? []).flatMap((turn) => [0, rows.findIndex(({ id }) => id === turn.workspace)].filter((row) => row >= 0)
              .filter((row) => row > 0 || turn.kind === "turn").map((row) => {
                const a = x(Date.parse(turn.from)), b = x(turn.to ? Date.parse(turn.to) : now);
                const live = !turn.to;
                return <rect key={`${turn.run}${turn.phase}${turn.kind}${turn.from}${row}`} x={a} y={top + row * height + 8} width={Math.max(4, b - a)} height="14" rx="3"
                  class={`bar ${turn.kind} ${live ? "live" : ""} ${turn.state === "failed" ? "failed" : ""}`}>
                  <title>{`${turn.run}: ${turn.kind === "wait" ? `waited to ${turn.phase}` : turn.phase}, ${when(turn.from)}${turn.to ? ` to ${when(turn.to)}` : ", going on"}`}</title>
                </rect>;
              }))}
          </svg>}
      </div>
    </div>
  );
}

const FILTERS = { all: "All", going: "Going on", failed: "Failed", resumable: "Resumable" } as const;
type Filter = keyof typeof FILTERS;

function EveryRun({ runs, workspaces }: { runs?: RunView[]; workspaces: WorkspaceView[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const titles = new Map(workspaces.map(({ id, title }) => [id, title]));
  const q = query.trim().toLowerCase();
  const rows = (runs ?? []).filter((run) => (filter === "all" || (filter === "going" ? isGoing(run) : filter === "failed" ? run.state === "failed" : !!run.resume))
    && `${run.id} ${run.script} ${titles.get(run.workspace) ?? ""}`.toLowerCase().includes(q));
  const open = (run: RunView) => `/${run.state === "done" ? "reel" : "run"}/${run.id}`;
  return <>
    <div class="hd">
      <h2>Every run</h2><span class="sp" />
      <div class="chips" role="group" aria-label="Show">
        {(Object.keys(FILTERS) as Filter[]).map((f) => <button class="fchip" aria-pressed={f === filter} onClick={() => setFilter(f)}>{FILTERS[f]}</button>)}
      </div>
      <input class="field" type="search" placeholder="Find a run or script" aria-label="Find a run or script" value={query}
        onInput={(event) => setQuery(event.currentTarget.value)} />
    </div>
    <div class="scrollx">
      <table class="tbl">
        <thead><tr><th>Run</th><th>Script</th><th>State</th><th>Phases</th><th>Started</th><th>Took</th></tr></thead>
        <tbody>
          {rows.map((run) => (
            <tr class="click" key={`${run.workspace}/${run.id}`} onClick={(event) => { if (!(event.target as Element).closest("a")) navigate(open(run)); }}>
              <td class="mono"><a href={open(run)}>{run.id}</a></td>
              <td>{run.script}<div class="faint small">{titles.get(run.workspace)}</div></td>
              <td><span class={`st ${shown(run)}`}>{label(run)}{!isGoing(run) && run.phase && run.state !== "done" ? ` · in ${run.phase}` : ""}</span>
                {run.why && <div class={`clip ${run.state === "failed" ? "why" : "faint mono xs"}`} title={run.why}>{run.why.split("\n")[0]}</div>}
                {run.lost && <div class="faint mono xs">can't go on: {run.lost}</div>}
                {!run.files && !isGoing(run) && <div class="faint xs">files removed</div>}</td>
              <td><span class="phases" aria-label={`${run.finished} of ${PHASES} phases`}>
                {Array.from({ length: PHASES }, (_, i) => <i class={i < run.finished ? "d" : i === run.finished && isGoing(run) ? "n" : i === run.finished && run.state === "failed" ? "x" : ""} />)}
              </span></td>
              <td class="mono">{when(run.startedAt)}</td>
              <td class="mono">{took(((run.endedAt ? Date.parse(run.endedAt) : Date.now()) - Date.parse(run.startedAt)) / 1000)}</td>
            </tr>
          ))}
          {runs && !rows.length && <tr><td colSpan={6} class="faint">{runs.length ? "No run matches." : "No runs yet: compose a script, and it shows up here."}</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
