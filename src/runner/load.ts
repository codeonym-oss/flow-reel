// Loads the mounted demo script: Node strips its types, and `import … from "flow-reel"` resolves to this package,
// so the script's folder needs no node_modules.
import { registerHooks } from "node:module";
import { extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Demo } from "../index.ts";

const self = new URL(`../index${extname(fileURLToPath(import.meta.url))}`, import.meta.url).href;

registerHooks({
  resolve(specifier, context, next) {
    return specifier === "flow-reel" ? { url: self, shortCircuit: true } : next(specifier, context);
  },
});

export async function loadDemo(path: string): Promise<Demo> {
  const mod = await import(pathToFileURL(path).href);
  const d = mod.default as Partial<Demo> | undefined;
  if (!d || typeof d.body !== "function" || typeof d.options?.url !== "string") {
    throw new Error(`${path} must have a default export of demo(options, body), from "flow-reel"`);
  }
  return d as Demo;
}
