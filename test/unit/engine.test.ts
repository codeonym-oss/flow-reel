import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { detectEngine, imageFor, sourceCheckoutWarning, targetFor } from "../../src/host/engine.ts";
import { type SettingsFlags, resolveSettings } from "../../src/settings.ts";
import type { ConfiguredSettings } from "../../src/workspace/config.ts";

describe("imageFor", () => {
  it("tags the image with the package version", () => {
    expect(imageFor("0.1.0", "full")).toBe("ghcr.io/codeonym-oss/flow-reel:0.1.0");
    expect(imageFor("0.1.0", "cloud")).toBe("ghcr.io/codeonym-oss/flow-reel:0.1.0-cloud");
  });
  it("follows the voice that speaks: the smaller image for a cloud voice (GH-101 decision 001)", () => {
    const target = (file?: ConfiguredSettings, flags?: SettingsFlags) => targetFor(resolveSettings(file, flags).voice.adapter);
    const openai: ConfiguredSettings = { voice: { adapter: "openai" } };
    expect(target()).toBe("full");
    expect(target({ voice: { adapter: "qwen3-tts-0.6b" } })).toBe("full");
    expect(target(openai)).toBe("cloud");
    expect(target(undefined, { voice: "gemini" })).toBe("cloud");
    expect(target(openai, { voice: "qwen3-tts-0.6b" })).toBe("full");
    expect(target({ voice: { adapter: "openai-compatible", baseUrl: "http://localhost:8880/v1", model: "kokoro" } })).toBe("cloud");
  });
});

describe("detectEngine", () => {
  const probe = (answers: Record<string, { status: number; stdout?: string }>) =>
    (cmd: string, args: string[]) => ({ stdout: "", ...(answers[`${cmd} ${args[0]}`] ?? { status: 1 }) });

  it("uses the first engine whose daemon answers", () => {
    expect(detectEngine(probe({ "docker --version": { status: 0, stdout: "Docker version 28" }, "docker info": { status: 0 } }), "linux"))
      .toEqual({ command: "docker", kind: "docker", desktop: false });
  });

  it("skips an installed engine that isn't running when another one answers", () => {
    expect(detectEngine(probe({ "docker --version": { status: 0 }, "podman --version": { status: 0 }, "podman info": { status: 0 } }), "linux"))
      .toEqual({ command: "podman", kind: "podman", desktop: false });
  });

  it("treats a podman-docker `docker` command as Podman, for its user namespace", () => {
    expect(detectEngine(probe({ "docker --version": { status: 0, stdout: "podman version 5.6.0" }, "docker info": { status: 0 } }), "linux"))
      .toEqual({ command: "docker", kind: "podman", desktop: false });
  });

  it("knows Docker Desktop, on macOS and Windows and inside Linux", () => {
    const answering = { "docker --version": { status: 0 }, "docker info": { status: 0, stdout: "Docker Desktop" } };
    expect(detectEngine(probe(answering), "linux").desktop).toBe(true);
    expect(detectEngine(probe({ ...answering, "docker info": { status: 0, stdout: "Ubuntu 24.04" } }), "darwin").desktop).toBe(true);
  });

  it("says the engine isn't running rather than failing later", () => {
    expect(() => detectEngine(probe({ "docker --version": { status: 0 } }))).toThrow(/docker is installed but not responding/);
    expect(() => detectEngine(probe({}))).toThrow(/neither was found on PATH/);
  });
});

describe("sourceCheckoutWarning", () => {
  it("warns only in a git checkout with composer sources, with the target to build", () => {
    const image = "ghcr.io/codeonym-oss/flow-reel:0.1.1";
    expect(sourceCheckoutWarning(resolve("."), image, "full")).toMatch(/source checkout.*0\.1\.1.*docker build --target full/s);
    expect(sourceCheckoutWarning(resolve("."), `${image}-cloud`, "cloud")).toContain(`docker build --target cloud -t ${image}-cloud -f docker/Dockerfile .`);
    expect(sourceCheckoutWarning(mkdtempSync(join(tmpdir(), "flow-reel-installed-")), image, "full")).toBeUndefined();
  });
});
