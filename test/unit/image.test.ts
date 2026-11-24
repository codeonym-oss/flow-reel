import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { prepareImage } from "../e2e/image.ts";

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const digest = (letter: string) => `ghcr.io/codeonym-oss/flow-reel@sha256:${letter.repeat(64)}`;
let log: string;
const commands = () => readFileSync(log, "utf8");

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-image-"));
  log = join(dir, "commands");
  writeFileSync(log, "");
  writeFileSync(join(dir, "docker"), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$IMAGE_TEST_LOG"\n[ "$IMAGE_TEST_FAIL" != "$1" ]\n', { mode: 0o755 });
  vi.stubEnv("PATH", `${dir}:${process.env.PATH}`);
  vi.stubEnv("IMAGE_TEST_LOG", log);
  vi.stubEnv("FLOW_REEL_TEST_IMAGE", "");
  vi.stubEnv("FLOW_REEL_TEST_IMAGE_CLOUD", "");
});
afterEach(() => vi.unstubAllEnvs());

it.each([["full", "FLOW_REEL_TEST_IMAGE", ""], ["cloud", "FLOW_REEL_TEST_IMAGE_CLOUD", "-cloud"]] as const)(
  "uses a pulled %s candidate without building, and never falls back when it is unavailable", (target, variable, suffix) => {
    vi.stubEnv(variable, digest("a"));
    expect(prepareImage(target)).toBe(`ghcr.io/codeonym-oss/flow-reel:${version}${suffix}`);
    expect(commands()).toContain(`pull ${digest("a")}`);
    expect(commands()).toContain(`tag ${digest("a")} ghcr.io/codeonym-oss/flow-reel:${version}${suffix}\n`);
    vi.stubEnv("IMAGE_TEST_FAIL", "pull");
    expect(() => prepareImage(target)).toThrow();
    expect(commands()).not.toContain("build");
  });

it("refuses to build one image beside a supplied one", () => {
  vi.stubEnv("FLOW_REEL_TEST_IMAGE", digest("a"));
  expect(() => prepareImage("cloud")).toThrow("FLOW_REEL_TEST_IMAGE_CLOUD must name the cloud image");
  vi.stubEnv("FLOW_REEL_TEST_IMAGE", "");
  vi.stubEnv("FLOW_REEL_TEST_IMAGE_CLOUD", digest("b"));
  expect(() => prepareImage("full")).toThrow("FLOW_REEL_TEST_IMAGE must name the full image");
  expect(commands()).toBe("");
});

it("builds the target when no image is supplied", () => {
  prepareImage("cloud");
  expect(commands()).toBe(`build -q --target cloud -t ghcr.io/codeonym-oss/flow-reel:${version}-cloud -f docker/Dockerfile .\n`);
});
