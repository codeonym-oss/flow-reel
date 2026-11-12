import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("accepts --no-sfx on either side of the script, and rejects malformed record options before Docker", () => {
  const run = (args: string[]) => spawnSync(process.execPath, ["src/cli.ts", ...args], {
    encoding: "utf8", env: { ...process.env, FLOW_REEL_IN_CONTAINER: "1" },
  });
  for (const args of [["record", "--no-sfx", "missing.ts"], ["record", "missing.ts", "--no-sfx"]]) {
    const result = run(args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing.ts");
    expect(result.stderr).not.toContain("usage:");
  }
  for (const args of [["record", "--no-sfx"], ["record", "demo.ts", "--no-sfx", "--no-sfx"],
    ["record", "demo.ts", "--wat"], ["record", "a.ts", "b.ts"], ["compare", "a.json", "b.json", "--no-sfx"]]) {
    expect(run(args).status).toBe(2);
  }
});
