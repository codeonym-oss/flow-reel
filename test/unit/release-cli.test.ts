import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

it("retains the immutable registry reference and refuses to overwrite conflicting release tags", () => {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-release-"));
  mkdirSync(join(dir, "release"));
  const write = (path: string, value: unknown) => writeFileSync(join(dir, path), JSON.stringify(value));
  const commit = "c".repeat(40);
  const bytes = Buffer.from("tested package");
  const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  write("package.json", { version: "0.1.0" });
  write("package-lock.json", { version: "0.1.0", packages: { "": { version: "0.1.0" } } });
  writeFileSync(join(dir, "release/flow-reel-0.1.0.tgz"), bytes);
  write("release/package.json", { file: "flow-reel-0.1.0.tgz", version: "0.1.0", commit, integrity,
    sha256: createHash("sha256").update(bytes).digest("hex") });
  const manifests = ["amd64", "arm64"].map((arch, i) => {
    const digest = `sha256:${String(i + 1).repeat(64)}`;
    write(`release/${arch}.json`, { arch, digest, version: "0.1.0", commit, integrity, verified: true });
    return { digest, platform: { os: "linux", architecture: arch } };
  });
  write("index.json", { manifests });
  const digest = `sha256:${"f".repeat(64)}`;
  write("descriptor.json", { digest });
  writeFileSync(join(dir, "git"), `#!/bin/sh\necho ${commit}\n`, { mode: 0o755 });
  writeFileSync(join(dir, "docker"), '#!/bin/sh\nprintf "%s\\n" "$*" >> commands\ncase "$*" in\n  *--raw) cat index.json;;\n  *--format*) cat descriptor.json;;\n  *) exit 90;;\nesac\n', { mode: 0o755 });
  const run = () => spawnSync(process.execPath, [resolve("scripts/release-cli.ts"), "publish-image"], {
    cwd: dir, encoding: "utf8", env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, RELEASE_TAG: "v0.1.0" },
  });
  const result = run();
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(JSON.parse(readFileSync(join(dir, "release/image.json"), "utf8")).image).toBe(`ghcr.io/codeonym-oss/flow-reel@${digest}`);
  write("index.json", { manifests: [manifests[0], { ...manifests[1], digest }] });
  expect(run().status).toBe(1);
  expect(readFileSync(join(dir, "commands"), "utf8")).not.toContain("create");
});
