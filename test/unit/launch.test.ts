import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRunArgs, detectEngine, imageFor, sourceCheckoutWarning } from "../../src/host/launch.ts";

const base = { image: "ghcr.io/codeonym-oss/flow-reel:0.1.0", workDir: "/home/me/app", script: "demo.ts", uid: 1000, gid: 1000 };

describe("imageFor", () => {
  it("tags the image with the package version", () => {
    expect(imageFor("0.1.0")).toBe("ghcr.io/codeonym-oss/flow-reel:0.1.0");
  });
});

describe("buildRunArgs", () => {
  it("passes muting into the container after the script", () => {
    expect(buildRunArgs({ ...base, engine: "docker", desktop: false, sfx: false }).slice(-3))
      .toEqual(["record", "/work/demo.ts", "--no-sfx"]);
  });
  it("Linux Docker: host network, the host's uid, the script's folder at /work", () => {
    expect(buildRunArgs({ ...base, engine: "docker", desktop: false })).toEqual([
      "run", "--rm", "--init", "--shm-size=1g",
      "-v", "/home/me/app:/work", "-w", "/work",
      "--user", "1000:1000",
      "--network", "host",
      "ghcr.io/codeonym-oss/flow-reel:0.1.0", "record", "/work/demo.ts",
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
  it("warns only in a git checkout with runner sources", () => {
    const image = "ghcr.io/codeonym-oss/flow-reel:0.1.1";
    expect(sourceCheckoutWarning(resolve("."), image)).toMatch(/source checkout.*0\.1\.1.*docker build/s);
    expect(sourceCheckoutWarning(mkdtempSync(join(tmpdir(), "flow-reel-installed-")), image)).toBeUndefined();
  });
});
