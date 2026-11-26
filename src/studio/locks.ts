// Who may use the studio (GH-109 decision 010, GH-134 decision 002). The server listens on 127.0.0.1 only; these locks
// refuse a request for another host, a request from another site, and a request without the studio's key. Pure.
import { timingSafeEqual } from "node:crypto";

export interface Lock { port: number; key: string }

export interface Asked {
  method: string;
  /** The path and query, as the request line has them. */
  url: string;
  host?: string;
  origin?: string;
  cookie?: string;
}

export type Verdict =
  | { allow: true }
  /** The key was in the URL: the cookie is set and the browser goes to the same page without it. */
  | { allow: false; status: 303; location: string; setCookie: string }
  | { allow: false; status: 403 | 421; reason: string };

export const cookieName = (port: number): string => `flow-reel-studio-${port}`;

const hosts = (port: number) => [`127.0.0.1:${port}`, `localhost:${port}`];

const same = (given: string, key: string) => {
  const a = Buffer.from(given), b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
};

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return undefined;
}

export function check(asked: Asked, { port, key }: Lock): Verdict {
  if (!asked.host || !hosts(port).includes(asked.host.toLowerCase())) {
    return { allow: false, status: 421, reason: "this studio answers only at its own address" };
  }
  if (asked.origin !== undefined && !hosts(port).some((host) => asked.origin === `http://${host}`)) {
    return { allow: false, status: 403, reason: "requests from other sites are refused" };
  }
  const url = new URL(asked.url, `http://${asked.host}`);
  const given = url.searchParams.get("key");
  if (given !== null && asked.method === "GET") {
    if (!same(given, key)) return { allow: false, status: 403, reason: "this key isn't the studio's: open the studio from `flow-reel studio`" };
    url.searchParams.delete("key");
    return { allow: false, status: 303, location: url.pathname + url.search,
      setCookie: `${cookieName(port)}=${key}; Path=/; HttpOnly; SameSite=Strict` };
  }
  const cookie = cookieValue(asked.cookie, cookieName(port));
  if (cookie === undefined || !same(cookie, key)) {
    return { allow: false, status: 403, reason: "open the studio from `flow-reel studio`: it prints the address with its key" };
  }
  return { allow: true };
}
