import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

it("compares on the host without external executables, with distinct failure statuses", () => {
  const dir = resolve("test/e2e/out/compare"); mkdirSync(dir, { recursive: true });
  const a = join(dir, "a.json"); const b = join(dir, "b.json");
  const value = { version: 1, script: "demo.ts", video: { file: "demo.mp4", width: 960, height: 540, fps: 30, durationMs: 2000 },
    steps: [{ index: 0, narration: "Hello", startMs: 500, actionEndMs: 700, endMs: 1000 }] };
  writeFileSync(a, JSON.stringify(value)); writeFileSync(b, JSON.stringify(value));
  const cli = (...args: string[]) => spawnSync(process.execPath, ["dist/cli.js", ...args], {
    encoding: "utf8", env: { ...process.env, PATH: "/no-executables", FLOW_REEL_IN_CONTAINER: "1" },
  });
  expect(cli("compare", a, b)).toMatchObject({ status: 0, stdout: expect.stringContaining("match") });
  value.steps[0].narration = "Different"; writeFileSync(b, JSON.stringify(value));
  expect(cli("compare", a, b)).toMatchObject({ status: 1, stdout: expect.stringContaining("steps[0].narration") });
  value.steps[0].endMs = 3000; writeFileSync(b, JSON.stringify(value));
  expect(cli("compare", a, b)).toMatchObject({ status: 2, stderr: expect.stringContaining("b.json") });
  writeFileSync(b, "{");
  expect(cli("compare", a, b)).toMatchObject({ status: 2, stderr: expect.stringContaining("b.json") });
  expect(cli("compare", a).status).toBe(2);
  expect(cli("compare", a, b, "extra").status).toBe(2);
  expect(cli("compare", a, join(dir, "missing.json")).status).toBe(2);
});
