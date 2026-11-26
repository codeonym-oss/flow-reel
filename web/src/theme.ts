// Dark or light (GH-109 decision 006): dark unless the person switched, remembered in this browser.
import { useState } from "preact/hooks";

export type Theme = "dark" | "light";
const KEY = "flow-reel-studio-theme";

function stored(): Theme {
  try { return localStorage.getItem(KEY) === "light" ? "light" : "dark"; } catch { return "dark"; }
}

/** Sets the page's theme before the first paint. */
export const applyStoredTheme = () => { document.documentElement.dataset.theme = stored(); };

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState(stored);
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* the choice lasts this page only */ }
    setTheme(next);
  };
  return [theme, toggle];
}
