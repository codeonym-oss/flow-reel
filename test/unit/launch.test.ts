import { describe, expect, it } from "vitest";
import { buildRunArgs, imageFor } from "../../src/host/launch.ts";

const base = { image: "ghcr.io/codeonym-oss/flow-reel:0.1.0", workDir: "/home/me/app", script: "demo.ts", uid: 1000, gid: 1000 };

describe("imageFor", () => {
  it("tags the image with the package version", () => {
    expect(imageFor("0.1.0")).toBe("ghcr.io/codeonym-oss/flow-reel:0.1.0");
  });
});

describe("buildRunArgs", () => {
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
