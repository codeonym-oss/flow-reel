import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";


const DIGITS: Record<string, string> = { "amd64-cloud": "1", "arm64-cloud": "2", "amd64-full": "3", "arm64-full": "4" };

/** A release folder with four verified candidates, and a fake registry: one file per tag or digest that exists. */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-release-"));
  mkdirSync(join(dir, "release"));
  mkdirSync(join(dir, "registry"));
  const write = (path: string, value: unknown) => writeFileSync(join(dir, path), JSON.stringify(value));
  const commit = "c".repeat(40);
  const bytes = Buffer.from("tested package");
  const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  write("package.json", { version: "0.1.0" });
  write("package-lock.json", { version: "0.1.0", packages: { "": { version: "0.1.0" } } });
  writeFileSync(join(dir, "release/flow-reel-0.1.0.tgz"), bytes);
  write("release/package.json", { file: "flow-reel-0.1.0.tgz", version: "0.1.0", commit, integrity,
    sha256: createHash("sha256").update(bytes).digest("hex") });
  const candidate = (arch: string, image: string) => ({ arch, image, version: "0.1.0", commit, integrity, verified: true,
    digest: `sha256:${DIGITS[`${arch}-${image}`].repeat(64)}` });
  for (const image of ["cloud", "full"]) for (const arch of ["amd64", "arm64"]) write(`release/${arch}-${image}.json`, candidate(arch, image));
  const index = (image: string) => ({ manifests: ["amd64", "arm64"].map((arch) =>
    ({ digest: candidate(arch, image).digest, platform: { os: "linux", architecture: arch } })) });
  const digest = { full: `sha256:${"f".repeat(64)}`, cloud: `sha256:${"e".repeat(64)}` };
  // What `imagetools create` would put in the registry, and what each tag's descriptor says.
  for (const [image, suffix] of [["full", ""], ["cloud", "-cloud"]] as const) {
    write(`created-0.1.0${suffix}`, index(image));
    write(`descriptor-0.1.0${suffix}`, { digest: digest[image] });
    write(`registry/${digest[image]}`, index(image));
  }
  writeFileSync(join(dir, "git"), `#!/bin/sh\necho ${commit}\n`, { mode: 0o755 });
  writeFileSync(join(dir, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> commands
case "$3" in
  inspect) ref=\${4##*flow-reel[:@]}
    case "$*" in
      *--raw) cat "registry/$ref" 2>/dev/null || { echo "manifest unknown" >&2; exit 1; };;
      *) cat "descriptor-$ref";;
    esac;;
  create) ref=\${5##*flow-reel:}; cp "created-$ref" "registry/$ref";;
  *) exit 90;;
esac
`, { mode: 0o755 });
  const cli = (...args: string[]) => spawnSync(process.execPath, [resolve("scripts/release-cli.ts"), ...args], {
    cwd: dir, encoding: "utf8", env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, RELEASE_TAG: "v0.1.0" },
  });
  const created = () => existsSync(join(dir, "commands")) ? readFileSync(join(dir, "commands"), "utf8").match(/imagetools create -t \S+/g) ?? [] : [];
  return { dir, write, candidate, index, digest, cli, created };
}

it("creates both tags from the verified digests, and retains each immutable registry reference", () => {
  const { dir, digest, cli, created } = fixture();
  const result = cli("publish-image");
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(created()).toEqual(["cloud", "full"].map((image) => `imagetools create -t ghcr.io/codeonym-oss/flow-reel:0.1.0${image === "cloud" ? "-cloud" : ""}`));
  for (const [image, suffix] of [["full", ""], ["cloud", "-cloud"]] as const) {
    expect(JSON.parse(readFileSync(join(dir, `release/image${suffix}.json`), "utf8")).image).toBe(`ghcr.io/codeonym-oss/flow-reel@${digest[image]}`);
  }
  // A second run, such as a recovery, finds both tags and creates nothing.
  expect(cli("publish-image").status).toBe(0);
  expect(created()).toHaveLength(2);
});

it("creates only the missing tag when a run stopped between the two", () => {
  const { write, index, cli, created } = fixture();
  write("registry/0.1.0-cloud", index("cloud"));
  expect(cli("publish-image").status).toBe(0);
  expect(created()).toEqual(["imagetools create -t ghcr.io/codeonym-oss/flow-reel:0.1.0"]);
});

it.each(["cloud", "full"])("creates neither tag when a %s candidate is missing, unverified or for another image", (image) => {
  for (const bad of [undefined, { verified: false }, { commit: "d".repeat(40) }, { image: image === "cloud" ? "full" : "cloud" }]) {
    const { dir, write, candidate, cli, created } = fixture();
    if (bad) write(`release/arm64-${image}.json`, { ...candidate("arm64", image), ...bad });
    else rmSync(join(dir, `release/arm64-${image}.json`));
    expect(cli("publish-image").status).toBe(1);
    expect(created()).toEqual([]);
  }
});

it.each([["cloud", "-cloud"], ["full", ""]])("refuses to overwrite a conflicting %s tag, and creates neither", (image, suffix) => {
  const { write, index, digest, cli, created } = fixture();
  const { manifests } = index(image);
  write(`registry/0.1.0${suffix}`, { manifests: [manifests[0], { ...manifests[1], digest: digest.full }] });
  expect(cli("publish-image").status).toBe(1);
  expect(created()).toEqual([]);
});

it("reuses a candidate only for its own architecture and image", () => {
  const { write, candidate, cli } = fixture();
  expect(cli("reuse", "arm64", "cloud").stdout.trim()).toBe(candidate("arm64", "cloud").digest);
  write("release/arm64-cloud.json", candidate("arm64", "full"));
  expect(cli("reuse", "arm64", "cloud").status).toBe(1);
  expect(cli("reuse", "arm64", "other").status).toBe(1);
});
