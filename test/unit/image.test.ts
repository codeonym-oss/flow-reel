import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { prepareImage } from "../e2e/image.ts";

afterEach(() => vi.unstubAllEnvs());

it("uses a pulled candidate without building, and never falls back when it is unavailable", () => {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-image-"));
  const log = join(dir, "commands");
  writeFileSync(join(dir, "docker"), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$IMAGE_TEST_LOG"\n[ "$IMAGE_TEST_FAIL" != "$1" ]\n', { mode: 0o755 });
  vi.stubEnv("PATH", `${dir}:${process.env.PATH}`);
  vi.stubEnv("IMAGE_TEST_LOG", log);
  vi.stubEnv("FLOW_REEL_TEST_IMAGE", `ghcr.io/codeonym-oss/flow-reel@sha256:${"a".repeat(64)}`);
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  expect(prepareImage()).toBe(`ghcr.io/codeonym-oss/flow-reel:${version}`);
  expect(readFileSync(log, "utf8")).toContain("pull ghcr.io/codeonym-oss/flow-reel@sha256:");
  expect(readFileSync(log, "utf8")).toContain("tag ghcr.io/codeonym-oss/flow-reel@sha256:");
  vi.stubEnv("IMAGE_TEST_FAIL", "pull");
  expect(() => prepareImage()).toThrow();
  expect(readFileSync(log, "utf8")).not.toContain("build");
});
