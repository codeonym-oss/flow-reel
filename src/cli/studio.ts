// `flow-reel studio` (GH-109 decision 003): starts the studio on this computer, opens it in the browser and stays in the
// foreground. Ctrl+C stops the studio; runs go on (epic GH-107 decision 023).
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packageVersion } from "../host/engine.ts";
import { openBrowser } from "../studio/browser.ts";
import { startStudio } from "../studio/server.ts";
import { type Command, EXIT, UsageError, parse } from "./command.ts";

export const DEFAULT_PORT = 4777;

/** The built web app: `dist/web/` in the package, and in a source checkout once it is built. */
const webFolder = () => join(resolve(dirname(fileURLToPath(import.meta.url)), "../.."), "dist", "web");

export const studio: Command = {
  summary: "open the studio in the browser: watch runs and replay reels",
  usage: "flow-reel studio [--port <n>] [--no-open] [--json]",
  async run(args) {
    const { flags } = parse(args, { port: "text", "no-open": "switch", json: "switch" }, { min: 0, max: 0 });
    const port = flags.port === undefined ? DEFAULT_PORT : Number(flags.port);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new UsageError(`--port must be a number from 1 to 65535, not ${JSON.stringify(flags.port)}`);
    const web = webFolder();
    if (!existsSync(join(web, "index.html"))) throw new Error(`the studio's web app isn't built (${web}): run \`npm run build\``);
    let opened;
    try { opened = await startStudio({ port, key: randomBytes(24).toString("base64url"), web, version: packageVersion() }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") throw new Error(`port ${port} is in use: is the studio already open? \`--port\` picks another`);
      throw error;
    }
    if (flags.json) console.log(JSON.stringify({ url: opened.url }));
    else console.log(`The studio is at ${opened.url}\nCtrl+C stops it; runs go on.`);
    if (!flags["no-open"]) openBrowser(opened.url);
    await new Promise<void>((done) => {
      const stop = () => { process.off("SIGINT", stop).off("SIGTERM", stop); done(); };
      process.on("SIGINT", stop).on("SIGTERM", stop);
    });
    await opened.close();
    return EXIT.ok;
  },
};
