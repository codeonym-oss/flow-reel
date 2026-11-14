import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest runs import() through its own module runner, so the loader is exercised in a real Node process.
function loadInNode(script: string): string {
  const loader = resolve("src/adapters/playwright/load.ts");
  const code = `const { loadScript } = await import(${JSON.stringify(loader)});
const d = await loadScript(${JSON.stringify(script)});
console.log(JSON.stringify({ options: d.options, body: typeof d.body }));`;
  try {
    return execFileSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8", stdio: "pipe" }).trim();
  } catch (e) {
    throw new Error((e as { stderr: string }).stderr);
  }
}

describe("loadScript", () => {
  it("loads a TypeScript script that imports flow-reel from a folder with no node_modules", () => {
    const dir = mkdtempSync(join(tmpdir(), "flow-reel-load-"));
    copyFileSync("test/fixtures/demo.ts", join(dir, "demo.ts"));
    expect(JSON.parse(loadInNode(join(dir, "demo.ts")))).toEqual({
      options: { url: "http://localhost:4173", viewport: [1920, 1080] },
      body: "function",
    });
  });

  it("rejects a viewport that is not two positive whole numbers", () => {
    const dir = mkdtempSync(join(tmpdir(), "flow-reel-load-"));
    for (const viewport of ["[0, 360]", "[640.5, 360]", "[640]"]) {
      writeFileSync(join(dir, "demo.ts"), `import { script } from "flow-reel";
export default script({ url: "http://localhost:1", viewport: ${viewport} as [number, number] }, async () => {});\n`);
      expect(() => loadInNode(join(dir, "demo.ts"))).toThrow(/viewport must be \[width, height\] in whole CSS pixels/);
    }
  });

  it("accepts a viewport whose 4/3 screen width is odd (padded when encoded)", () => {
    const dir = mkdtempSync(join(tmpdir(), "flow-reel-load-"));
    writeFileSync(join(dir, "demo.ts"), `import { script } from "flow-reel";
export default script({ url: "http://localhost:1", viewport: [640, 360] }, async () => {});\n`);
    expect(JSON.parse(loadInNode(join(dir, "demo.ts"))).options.viewport).toEqual([640, 360]);
  });

  it("says what is wrong when the script has no script() default export", () => {
    const dir = mkdtempSync(join(tmpdir(), "flow-reel-load-"));
    writeFileSync(join(dir, "demo.ts"), "export const x: number = 1;\n");
    expect(() => loadInNode(join(dir, "demo.ts"))).toThrow(/default export of script\(options, body\), from "flow-reel"/);
  });

  it("points a 0.1 script to the 0.2 upgrade notes", () => {
    const dir = mkdtempSync(join(tmpdir(), "flow-reel-load-"));
    writeFileSync(join(dir, "demo.ts"), `import { demo } from "flow-reel";
export default demo({ url: "http://localhost:1" }, async ({ page, step }) => {});\n`);
    expect(() => loadInNode(join(dir, "demo.ts")))
      .toThrow(/is a flow-reel 0\.1 script \(demo, step, sfx\); 0\.2 replaced those words: see .*#from-01-to-02/);
  });
});
