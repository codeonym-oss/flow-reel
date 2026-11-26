// The Scripts screen (GH-136): a workspace's scripts with what their last reel holds, the selected one's source with the
// lines changed since that reel, and running it, once or on every save.
import { useEffect, useState } from "preact/hooks";
import type { OpenedScript, ScriptSource, ScriptsView, ScriptView, StartedRun, WorkspaceView } from "../../src/studio/api.ts";
import { isGoing, send, shown, usePolled, when } from "./data.ts";
import { navigate } from "./route.ts";
import { label } from "./workspaces.tsx";

const count = (n: number, one: string, many = `${one}s`) => <span><b>{n}</b> {n === 1 ? one : many}</span>;
const minutes = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.round(ms / 1000) % 60).padStart(2, "0")}`;

export function Scripts({ rest, toast }: { rest: string[]; toast: (text: string) => void }) {
  const [slug, ...name] = rest;
  const list = usePolled<WorkspaceView[]>("/api/workspaces");
  const workspace = list.data?.filter((one) => one.slug === slug).sort((a, b) => Number(a.missing) - Number(b.missing))[0];
  return (
    <section class="screen" aria-labelledby="screen-title">
      <div class="hd">
        <h1 id="screen-title">Scripts</h1>
        {workspace && <span class="sub">{workspace.title}</span>}
        <span class="sp" />
        <Open toast={toast} />
      </div>
      {list.error && !list.data && <div class="problem" role="alert">{list.error}</div>}
      {list.data && !workspace && <Choose workspaces={list.data} asked={slug} />}
      {workspace && (workspace.missing
        ? <div class="problem" role="alert">{workspace.title}'s folder is gone: {workspace.root}</div>
        : <Workspace key={workspace.id} id={workspace.id} slug={workspace.slug} selected={name.join("/")} toast={toast} />)}
    </section>
  );
}

function Choose({ workspaces, asked }: { workspaces: WorkspaceView[]; asked?: string }) {
  const shown = workspaces.filter(({ missing }) => !missing);
  return (
    <div class="card choose">
      {asked && <p class="why">There is no workspace {asked} on this computer.</p>}
      {shown.length ? <>
        <p class="muted">Pick a workspace:</p>
        <ul>{shown.map((w) => <li key={w.id}><a href={`/scripts/${w.slug}`}>{w.title}</a> <span class="faint mono small">{w.root}</span></li>)}</ul>
      </> : <p class="muted">No workspace yet: add one on <a href="/workspaces">Workspaces</a>, or open a script by its path.</p>}
    </div>
  );
}

/** Opens a script by its full path, as an agent's message names it. */
function Open({ toast }: { toast: (text: string) => void }) {
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const open = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const opened = await send<OpenedScript>("/api/scripts/open", { path: path.trim() });
      setPath("");
      navigate(`/scripts/${opened.slug}/${opened.name}`);
    } catch (error) { toast((error as Error).message); }
    setBusy(false);
  };
  return (
    <form class="open" onSubmit={open}>
      <label class="sr" for="open-path">Open a script by its path</label>
      <input id="open-path" class="field mono" placeholder="/path/to/reels/tour.reel.ts" value={path}
        onInput={(event) => setPath((event.target as HTMLInputElement).value)} />
      <button class="btn sm" disabled={busy || !path.trim()}>Open</button>
    </form>
  );
}

function Workspace({ id, slug, selected, toast }: { id: string; slug: string; selected: string; toast: (text: string) => void }) {
  const view = usePolled<ScriptsView>(`/api/scripts?workspace=${id}`);
  const scripts = view.data?.scripts ?? [];
  const script = scripts.find(({ name }) => name === selected) ?? scripts[0];
  if (view.error && !view.data) return <div class="problem" role="alert">{view.error}</div>;
  if (!view.data) return null;
  if (!scripts.length) {
    return <div class="empty">No scripts in <span class="mono">{view.data.workspace.scripts}/</span> yet: a script is a file named <span class="mono">&lt;name&gt;.reel.ts</span>.</div>;
  }
  return (
    <div class="split">
      <nav class="list" aria-label="Scripts">
        {scripts.map((one) => <Row key={one.name} script={one} current={one === script} slug={slug} />)}
      </nav>
      {script && <Selected key={script.name} id={id} script={script} toast={toast} refresh={view.refresh} />}
    </div>
  );
}

function Row({ script, current, slug }: { script: ScriptView; current: boolean; slug: string }) {
  const latest = script.runs[0];
  return (
    <a class="card srow" href={`/scripts/${slug}/${script.name}`} aria-current={current ? "page" : undefined}>
      <h3>{script.name}</h3>
      {latest ? <span class={`st ${shown(latest)}`}>{label(latest)}</span> : <span class="faint small">never run</span>}
      {script.reel ? <div class="counts">
        {count(script.reel.steps, "step")}{count(script.reel.comments, "comment")}
        {count(script.reel.sounds, "sound")}{count(script.reel.effects, "effect")}
        {script.reel.cards > 0 && count(script.reel.cards, "card")}
        <span><b>{minutes(script.reel.ms)}</b> long</span>
      </div> : <div class="counts faint">No reel yet.</div>}
      {script.onSave && <span class="faint small">runs again on save</span>}
    </a>
  );
}

function Selected({ id, script, toast, refresh }: { id: string; script: ScriptView; toast: (text: string) => void; refresh: () => void }) {
  const [starting, setStarting] = useState(false);
  const going = script.runs.find(isGoing);
  const lastReel = script.runs.find((run) => run.state === "done");
  const run = async () => {
    setStarting(true);
    try {
      const started = await send<StartedRun>("/api/runs", { workspace: id, name: script.name });
      toast(`${started.id} started.`);
      refresh();
      navigate(`/run/${started.id}`);
    } catch (error) { toast((error as Error).message); }
    setStarting(false);
  };
  const flip = async () => {
    try {
      const { on } = await send<{ on: boolean }>("/api/on-save", { workspace: id, name: script.name, on: !script.onSave });
      if (on) toast(`Run again on save is on for ${script.path}.`);
      refresh();
    } catch (error) { toast((error as Error).message); }
  };
  return (
    <div class="sel">
      <div class="card actions">
        <div class="row">
          {going ? <a class="btn primary" href={`/run/${going.id}`}>Watch {going.id}</a>
            : <button class="btn primary" disabled={starting} onClick={run}>{starting ? "Starting…" : "Run"}</button>}
          {lastReel && <a class="btn" href={`/reel/${lastReel.id}`}>Last reel</a>}
          <span class="sp" />
        </div>
        {starting && <p class="faint small">The first run on this computer pulls the composer's image: it can take minutes.</p>}
        <div class="toggle">
          <button class="sw" role="switch" aria-checked={script.onSave ? "true" : "false"} aria-labelledby="onsave-label" onClick={flip} />
          <span id="onsave-label"><b>Run again on save</b><br />
            <span class="muted small">{script.onSave
              ? `On. Saving ${script.path} starts a run; if one is going on, the new one waits for it.`
              : "Off. When on, every save of this file repeats the script's real actions in your app."}</span>
            {script.onSaveFailed && <><br /><span class="why small">The last one couldn't start: {script.onSaveFailed}</span></>}
          </span>
        </div>
        {script.runs.length > 0 && <div class="runs">
          <span class="label">Last runs</span>
          {script.runs.map((one) => (
            <a key={one.id} class="runline" href={one.state === "done" ? `/reel/${one.id}` : `/run/${one.id}`}>
              <span class={`st ${shown(one)}`}>{one.id}</span><span class="faint mono">{when(one.startedAt)}</span>
            </a>
          ))}
        </div>}
      </div>
      <Source id={id} name={script.name} />
    </div>
  );
}

function Source({ id, name }: { id: string; name: string }) {
  const [source, setSource] = useState<ScriptSource | { error: string }>();
  const polled = usePolled<ScriptSource>(`/api/script?workspace=${id}&name=${encodeURIComponent(name)}`);
  useEffect(() => { if (polled.data) setSource(polled.data); else if (polled.error) setSource({ error: polled.error }); }, [polled.data, polled.error]);
  if (!source) return null;
  if ("error" in source) return <div class="problem" role="alert">{source.error}</div>;
  const changed = new Set(source.changed === "unknown" ? [] : source.changed);
  return (
    <div class="card src">
      <div class="src-hd">
        <span class="mono small">{source.path}</span>
        <span class="sp" />
        <span class="faint small">{source.noReel ? "no reel to compare with"
          : source.changed === "unknown" ? "changed since its last reel (that run's files were cleaned)"
          : changed.size ? `${changed.size === 1 ? "1 line" : `${changed.size} lines`} changed since its last reel` : "as in its last reel"}</span>
      </div>
      <pre class="code" aria-label={`${source.path}, read only`}>
        {source.lines.map((line, i) => <div key={i} class={changed.has(i + 1) ? "chg" : undefined}><span class="ln">{i + 1}</span><span>{line || " "}</span></div>)}
      </pre>
    </div>
  );
}
