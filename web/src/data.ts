// Talking to the studio's server from the screens: lists asked again while they show (GH-135 decision 001), changes sent
// as JSON (decision 002), and how sizes and times read.
import { useCallback, useEffect, useState } from "preact/hooks";
import type { Problem, RunView } from "../../src/studio/api.ts";

const EVERY_MS = 2000;

/** A list from the server, asked again every 2 seconds while the page is visible. */
export function usePolled<T>(url: string): { data?: T; error?: string; refresh: () => void } {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let stopped = false;
    const ask = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(url);
        const body = await response.json() as T | Problem;
        if (stopped) return;
        if (response.ok) setState({ data: body as T });
        else setState((before) => ({ ...before, error: (body as Problem).error }));
      } catch { if (!stopped) setState((before) => ({ ...before, error: "the studio doesn't answer" })); }
    };
    ask();
    const every = setInterval(ask, EVERY_MS);
    document.addEventListener("visibilitychange", ask);
    return () => { stopped = true; clearInterval(every); document.removeEventListener("visibilitychange", ask); };
  }, [url, tick]);
  return { ...state, refresh };
}

/** Sends a change; throws its problem's message when it is refused. */
export async function send<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const answer = await response.json().catch(() => ({ error: `the studio answered ${response.status}` })) as T | Problem;
  if (!response.ok) throw new Error((answer as Problem).error);
  return answer as T;
}

export function size(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return bytes ? `${bytes} B` : "nothing";
}

export function took(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const hours = Math.floor(s / 3600), minutes = Math.floor(s / 60) % 60, rest = String(s % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/** A time of day today, or the day and time before. */
export function when(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return at.toDateString() === now.toDateString() ? time : `${at.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
}

/** What a run is doing, in the words the lists use. */
export type Shown = RunView["state"] | "waiting";
export const shown = (run: RunView): Shown => run.waiting ? "waiting" : run.state;
export const isGoing = (run: RunView) => run.state === "queued" || run.state === "running" || run.state === "held";
