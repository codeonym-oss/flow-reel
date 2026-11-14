import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("accepts --no-sfx on either side of the script, and rejects malformed compose options before Docker", () => {
  const run = (args: string[]) => spawnSync(process.execPath, ["src/cli.ts", ...args], {
    encoding: "utf8", env: { ...process.env, FLOW_REEL_IN_CONTAINER: "1" },
  });
  for (const args of [["compose", "--no-sfx", "missing.ts"], ["compose", "missing.ts", "--no-sfx"]]) {
    const result = run(args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing.ts");
    expect(result.stderr).not.toContain("usage:");
  }
  for (const args of [["compose", "--no-sfx"], ["compose", "demo.ts", "--no-sfx", "--no-sfx"],
    ["compose", "demo.ts", "--wat"], ["compose", "a.ts", "b.ts"], ["compare", "a.json", "b.json", "--no-sfx"]]) {
    expect(run(args).status).toBe(2);
  }
});

it("says that record is now compose", () => {
  const result = spawnSync(process.execPath, ["src/cli.ts", "record", "demo.ts"], { encoding: "utf8" });
  expect(result.status).toBe(2);
  expect(result.stderr).toBe("flow-reel: `record` is now `compose` (flow-reel 0.2)\n");
});
