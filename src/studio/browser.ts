// Opens an address in the person's browser, as their system does; nothing happens where there is no browser.
import { spawn } from "node:child_process";

export function openBrowser(url: string): void {
  const [cmd, args] = process.platform === "darwin" ? ["open", [url]]
    : process.platform === "win32" ? ["cmd", ["/c", "start", "", url.replace(/&/g, "^&")]]
    : ["xdg-open", [url]];
  spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
}
