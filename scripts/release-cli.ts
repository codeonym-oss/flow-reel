import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { IMAGES, releaseVersion, verifyCandidates, verifyIndex, npmPublication, type Candidate, type Image } from "./release.ts";

const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const run = (...args: string[]) => execFileSync("docker", args, { encoding: "utf8" }).trim();
const [command, ...args] = process.argv.slice(2);
const pkg = json("package.json");
const lock = json("package-lock.json");
const image = "ghcr.io/codeonym-oss/flow-reel";
const version = releaseVersion(process.env.RELEASE_TAG ?? "", pkg.version, lock.version);
assert.equal(lock.packages[""].version, version, "root lockfile version mismatch");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

if (command === "version") {
  console.log(version);
} else {
  const artifact = json("release/package.json");
  assert.equal(artifact.version, version, "artifact version mismatch");
  assert.equal(artifact.commit, commit, "artifact source commit mismatch");
  assert.match(artifact.file, /^flow-reel-\d+\.\d+\.\d+\.tgz$/);
  const bytes = readFileSync(join("release", artifact.file));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), artifact.sha256, "artifact SHA mismatch");
  assert.equal(`sha512-${createHash("sha512").update(bytes).digest("base64")}`, artifact.integrity, "artifact integrity mismatch");
  const release = { version, commit, integrity: artifact.integrity };
  if (command === "artifact") {
    console.log(artifact.file);
  } else if (command === "reuse") {
    const [arch, target] = args;
    assert(["amd64", "arm64"].includes(arch));
    assert(target in IMAGES);
    const candidate: Candidate = json(`release/${arch}-${target}.json`);
    for (const field of ["version", "commit", "integrity"] as const) assert.equal(candidate[field], release[field], `recovery ${field} mismatch`);
    assert.equal(candidate.arch, arch);
    assert.equal(candidate.image, target);
    assert.match(candidate.digest, /^sha256:[a-f0-9]{64}$/);
    console.log(candidate.digest);
  } else if (command === "candidate") {
    const [arch, target, digest, verified] = args;
    assert(["amd64", "arm64"].includes(arch));
    assert(target in IMAGES);
    assert.match(digest, /^sha256:[a-f0-9]{64}$/);
    const native = run("image", "inspect", `${image}@${digest}`, "--format", "{{.Architecture}}");
    assert.equal(native, arch, "pulled image architecture mismatch");
    writeFileSync(`release/${arch}-${target}.json`, JSON.stringify({ ...release, arch, image: target, digest, verified: verified === "true" }, null, 2) + "\n");
  } else if (command === "publish-image") {
    const candidates: Candidate[] = ["amd64", "arm64"].flatMap(arch => Object.keys(IMAGES).map(target => json(`release/${arch}-${target}.json`)));
    const tags = (Object.keys(IMAGES) as Image[]).map(target => ({ target, suffix: IMAGES[target],
      tag: `${image}:${version}${IMAGES[target]}`, digests: verifyCandidates(candidates, release, target) }));
    // Every candidate and every existing tag is checked before any tag is created.
    const missing = tags.filter(({ target, tag }) => {
      const existing = spawnSync("docker", ["buildx", "imagetools", "inspect", tag, "--raw"], { encoding: "utf8" });
      if (existing.status === 0) {
        verifyIndex(JSON.parse(existing.stdout), candidates, release, target);
        return false;
      }
      // Authentication/transport errors must never be mistaken for an absent tag.
      assert.match(existing.stderr, /manifest unknown|not found|MANIFEST_UNKNOWN/, "cannot establish whether release image exists");
      return true;
    });
    for (const { tag, digests } of missing) run("buildx", "imagetools", "create", "-t", tag, ...digests.map(d => `${image}@${d}`));
    for (const { target, suffix, tag } of tags) {
      const raw = run("buildx", "imagetools", "inspect", tag, "--raw");
      verifyIndex(JSON.parse(raw), candidates, release, target);
      writeFileSync(`release/image-index${suffix}.json`, raw + "\n");
      const descriptor = JSON.parse(run("buildx", "imagetools", "inspect", tag, "--format", "{{json .Manifest}}"));
      assert.match(descriptor.digest, /^sha256:[a-f0-9]{64}$/);
      // Validate the immutable reference too, so a concurrent tag change cannot corrupt evidence.
      verifyIndex(JSON.parse(run("buildx", "imagetools", "inspect", `${image}@${descriptor.digest}`, "--raw")), candidates, release, target);
      writeFileSync(`release/image${suffix}.json`, JSON.stringify({ ...release, image: `${image}@${descriptor.digest}` }, null, 2) + "\n");
      console.log(`${image}@${descriptor.digest}`);
    }
  } else if (command === "npm-status") {
    const response = await fetch(`https://registry.npmjs.org/flow-reel/${version}`);
    assert(response.ok || response.status === 404, `npm registry HTTP ${response.status}`);
    const existing = response.status === 404 ? undefined : (await response.json() as { dist: { integrity: string } }).dist.integrity;
    console.log(npmPublication(process.env.PUBLISH_TO_NPM === "true", existing, artifact.integrity));
  } else {
    throw new Error(`unknown release command: ${command}`);
  }
}
