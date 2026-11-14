// Loads the mounted script: Node strips its types, and `import … from "flow-reel"` resolves to this package,
// so the script's folder needs no node_modules.
import { registerHooks } from "node:module";
import { extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Script } from "../../index.ts";

const self = new URL(`../../index${extname(fileURLToPath(import.meta.url))}`, import.meta.url).href;

registerHooks({
  resolve(specifier, context, next) {
    return specifier === "flow-reel" ? { url: self, shortCircuit: true } : next(specifier, context);
  },
});

const UPGRADE = "https://github.com/codeonym-oss/flow-reel#from-01-to-02";

export async function loadScript(path: string): Promise<Script> {
  let mod;
  try {
    mod = await import(pathToFileURL(path).href);
  } catch (error) {
    // A 0.1 script imports `demo`, which 0.2 no longer exports (GH-27 decision 008).
    if (/export named 'demo'/.test((error as Error).message)) {
      throw new Error(`${path} is a flow-reel 0.1 script (demo, step, sfx); 0.2 replaced those words: see ${UPGRADE}`);
    }
    throw error;
  }
  const d = mod.default as Partial<Script> | undefined;
  if (!d || typeof d.body !== "function" || typeof d.options?.url !== "string") {
    throw new Error(`${path} must have a default export of script(options, body), from "flow-reel"`);
  }
  const viewport = d.options.viewport;
  if (!Array.isArray(viewport) || viewport.length !== 2 || !viewport.every((n) => Number.isInteger(n) && n > 0)) {
    throw new Error(`${path}: viewport must be [width, height] in whole CSS pixels, got ${JSON.stringify(viewport)}`);
  }
  return d as Script;
}
