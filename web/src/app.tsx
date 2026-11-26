// The studio's shell (GH-134): the side bar of screens, the top bar, and the screen of the current path.
import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import type { Hello, Screen } from "../../src/studio/api.ts";
import { Logo } from "./logo.tsx";
import { follow, useRoute } from "./route.ts";
import { useTheme } from "./theme.ts";
import { Reel } from "./reel.tsx";
import { Run } from "./run.tsx";
import { Scripts } from "./scripts.tsx";
import { Workspaces } from "./workspaces.tsx";

const TITLES: Record<Screen, string> = { workspaces: "Workspaces", scripts: "Scripts", run: "Run", reel: "Reel" };

const ICONS: Record<Screen | "settings", ComponentChildren> = {
  workspaces: <><rect x="2.5" y="3" width="15" height="5" rx="1.5" /><rect x="2.5" y="11" width="15" height="6" rx="1.5" /></>,
  scripts: <><path d="M5 2.5h7l3.5 3.5v11.5H5z" /><path d="M8 10h5M8 13h5M8 7h2" /></>,
  run: <><circle cx="10" cy="10" r="7.5" /><circle cx="10" cy="10" r="2.5" fill="currentColor" /></>,
  reel: <><rect x="2.5" y="4" width="15" height="12" rx="2" /><path d="M8.5 7.5v5l4-2.5z" fill="currentColor" /></>,
  settings: <><circle cx="10" cy="10" r="2.8" /><path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8" /></>,
};

/** What each screen will hold, until its ticket builds it. */
/** Whether the studio's server still answers: it stops with Ctrl+C in its terminal. */
function useServer(): Hello | "gone" | undefined {
  const [hello, setHello] = useState<Hello | "gone">();
  useEffect(() => {
    let stopped = false;
    const ask = async () => {
      let answer: Hello | "gone";
      try {
        const response = await fetch("/api/hello");
        answer = response.ok ? await response.json() as Hello : "gone";
      } catch { answer = "gone"; }
      if (!stopped) setHello(answer);
    };
    ask();
    const every = setInterval(ask, 5000);
    return () => { stopped = true; clearInterval(every); };
  }, []);
  return hello;
}

/** Short messages at the bottom, each gone after a few seconds. */
function useToasts(): [string[], (text: string) => void] {
  const [toasts, setToasts] = useState<string[]>([]);
  const toast = useCallback((text: string) => {
    setToasts((all) => [...all, text]);
    setTimeout(() => setToasts((all) => all.filter((one) => one !== text)), 5000);
  }, []);
  return [toasts, toast];
}

export function App() {
  const { screen, rest } = useRoute();
  const [theme, toggleTheme] = useTheme();
  const server = useServer();
  const [toasts, toast] = useToasts();
  useEffect(() => { document.title = `${TITLES[screen]} · flow-reel studio`; }, [screen]);
  return (
    <div class="shell" onClick={follow}>
      <nav class="rail" aria-label="Screens">
        <div class="logo" title={typeof server === "object" ? `flow-reel ${server.version}` : "flow-reel"}><Logo light={theme === "light"} /></div>
        {(Object.keys(TITLES) as Screen[]).map((s) => (
          <a href={`/${s}`} aria-current={s === screen ? "page" : undefined}><svg viewBox="0 0 20 20" aria-hidden="true">{ICONS[s]}</svg>{TITLES[s]}</a>
        ))}
        <span class="spacer" />
        <a aria-disabled="true" title="Settings come later"><svg viewBox="0 0 20 20" aria-hidden="true">{ICONS.settings}</svg>Settings</a>
      </nav>
      <header class="top">
        <div class="crumbs"><b>{TITLES[screen]}</b></div>
        <span class="sp" />
        <button class="iconbtn" aria-label="Switch light and dark" onClick={toggleTheme}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><path d="M8 2.5a5.5 5.5 0 0 0 0 11z" fill="currentColor" /></svg>
        </button>
      </header>
      <main>
        {server === "gone" && <div class="banner" role="alert">The studio stopped. Run <code>flow-reel studio</code> again to reopen it.</div>}
        {screen === "workspaces" ? <Workspaces toast={toast} /> : screen === "scripts" ? <Scripts rest={rest} toast={toast} /> :
          screen === "run" ? <Run rest={rest} toast={toast} /> : <Reel rest={rest} toast={toast} />}
      </main>
      <div class="toasts" role="status">{toasts.map((text) => <div class="toast" key={text}>{text}</div>)}</div>
    </div>
  );
}
