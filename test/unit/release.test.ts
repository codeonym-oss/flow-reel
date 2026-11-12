import { expect, it } from "vitest";
import { releaseVersion, verifyCandidates, verifyIndex, npmPublication } from "../../scripts/release.ts";

it("rejects release tags that disagree with the package or lockfile before publication", () => {
  expect(releaseVersion("v0.1.0", "0.1.0", "0.1.0")).toBe("0.1.0");
  for (const tag of ["v0.2.0", "main", "v0.1.0;echo oops", "v01.1.0"]) {
    expect(() => releaseVersion(tag, "0.1.0", "0.1.0")).toThrow();
  }
  expect(() => releaseVersion("v0.1.0", "0.1.0", "0.2.0")).toThrow(/lockfile/);
});

const release = { version: "0.1.0", commit: "c".repeat(40), integrity: "sha512-tested-package" };
const candidates = ["amd64", "arm64"].map((arch, i) => ({ ...release, arch, digest: `sha256:${String(i + 1).repeat(64)}`, verified: true }));

it("requires both tested native images from the same commit and package", () => {
  expect(verifyCandidates(candidates, release)).toEqual(candidates.map(c => c.digest));
  for (const bad of [candidates.slice(0, 1), [candidates[0], candidates[0]],
    [candidates[0], { ...candidates[1], verified: false }],
    [candidates[0], { ...candidates[1], commit: "d".repeat(40) }],
    [candidates[0], { ...candidates[1], integrity: "sha512-other" }]]) {
    expect(() => verifyCandidates(bad, release)).toThrow();
  }
});

it("refuses an existing image tag containing unverified or wrong-platform digests", () => {
  const index = { manifests: candidates.map(c => ({ digest: c.digest, platform: { os: "linux", architecture: c.arch } })) };
  expect(() => verifyIndex(index, candidates, release)).not.toThrow();
  expect(() => verifyIndex({ manifests: index.manifests.slice(0, 1) }, candidates, release)).toThrow();
  expect(() => verifyIndex({ manifests: [index.manifests[0], { ...index.manifests[1], digest: `sha256:${"f".repeat(64)}` }] }, candidates, release)).toThrow();
});

it("keeps npm disabled until setup, and only skips existing versions with identical integrity", () => {
  expect(npmPublication(false, undefined, release.integrity)).toBe("disabled");
  expect(npmPublication(true, undefined, release.integrity)).toBe("publish");
  expect(npmPublication(true, release.integrity, release.integrity)).toBe("existing");
  expect(() => npmPublication(true, "sha512-different", release.integrity)).toThrow(/integrity/);
});
