import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRunArgs, detectEngine, imageFor, sourceCheckoutWarning, targetFor } from "../../src/host/launch.ts";
import { type SettingsFlags, resolveSettings } from "../../src/settings.ts";
import type { ConfiguredSettings } from "../../src/workspace/config.ts";

const request = { script: "admin/refund.reel.ts", reel: "refund.reel", settings: resolveSettings(undefined), brand: {}, sound: true };
const base = { image: "ghcr.io/codeonym-oss/flow-reel:0.1.0", scriptsDir: "/home/me/app/reels", outDir: "/home/me/app/reels/out/admin",
  uid: 1000, gid: 1000, request };

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

describe("buildRunArgs", () => {
  it("Linux Docker: host network, the host's uid, the scripts folder read-only, and the request", () => {
    expect(buildRunArgs({ ...base, engine: "docker", desktop: false })).toEqual([
      "run", "--rm", "--init", "--shm-size=1g",
      "-v", "/home/me/app/reels:/scripts:ro", "-v", "/home/me/app/reels/out/admin:/out", "-w", "/scripts",
      "--user", "1000:1000",
      "--network", "host",
      "ghcr.io/codeonym-oss/flow-reel:0.1.0", "compose", JSON.stringify(request),
    ]);
  });

  it("Docker Desktop: no host network; Chromium maps localhost to the host instead", () => {
    const args = buildRunArgs({ ...base, engine: "docker", desktop: true });
    expect(args).not.toContain("host");
    expect(args).toEqual(expect.arrayContaining(["-e", "FLOW_REEL_HOST_MAP=1"]));
  });

  it("Podman: keeps the host's uid through the user namespace instead of --user", () => {
    const args = buildRunArgs({ ...base, engine: "podman", desktop: false });
    expect(args).toContain("--userns=keep-id");
    expect(args).not.toContain("--user");
    expect(args).toEqual(expect.arrayContaining(["--network", "host"]));
  });

  it("passes credentials by name only (GH-33 decision 004)", () => {
    const args = buildRunArgs({ ...base, engine: "docker", desktop: false, credentials: ["FAKE_TOKEN"] });
    expect(args.slice(args.indexOf("-e"), args.indexOf("-e") + 2)).toEqual(["-e", "FAKE_TOKEN"]);
    expect(args.indexOf("-e")).toBeLessThan(args.indexOf(base.image));
  });
});

describe("detectEngine", () => {
  const probe = (answers: Record<string, { status: number; stdout?: string }>) =>
    (cmd: string, args: string[]) => ({ stdout: "", ...(answers[`${cmd} ${args[0]}`] ?? { status: 1 }) });

  it("uses the first engine whose daemon answers", () => {
    expect(detectEngine(probe({ "docker --version": { status: 0, stdout: "Docker version 28" }, "docker info": { status: 0 } })))
      .toEqual({ command: "docker", engine: "docker" });
  });

  it("skips an installed engine that isn't running when another one answers", () => {
    expect(detectEngine(probe({ "docker --version": { status: 0 }, "podman --version": { status: 0 }, "podman info": { status: 0 } })))
      .toEqual({ command: "podman", engine: "podman" });
  });

  it("treats a podman-docker `docker` command as Podman, for its user namespace", () => {
    expect(detectEngine(probe({ "docker --version": { status: 0, stdout: "podman version 5.6.0" }, "docker info": { status: 0 } })))
      .toEqual({ command: "docker", engine: "podman" });
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
