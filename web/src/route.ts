// The studio's address: each screen has its own path (/workspaces, /run/<run>, ...), so the back button and a reload work.
import { useEffect, useState } from "preact/hooks";
import { SCREENS, type Screen } from "../../src/studio/api.ts";

export interface Route { screen: Screen; rest: string[] }

export function parseRoute(pathname: string): Route {
  const [first, ...rest] = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const screen = (SCREENS as readonly string[]).includes(first ?? "") ? first as Screen : "workspaces";
  return { screen, rest: screen === first ? rest : [] };
}

export function navigate(path: string) {
  if (path === location.pathname) return;
  history.pushState(null, "", path);
  dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.pathname));
  useEffect(() => {
    const changed = () => setRoute(parseRoute(location.pathname));
    addEventListener("popstate", changed);
    return () => removeEventListener("popstate", changed);
  }, []);
  return route;
}

/** A link inside the studio: it changes the screen without reloading the page. */
export function follow(event: MouseEvent) {
  const link = (event.target as Element).closest("a");
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const href = link.getAttribute("href");
  if (!href?.startsWith("/") || link.target) return;
  event.preventDefault();
  navigate(href);
}
