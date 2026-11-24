import { expect, it } from "vitest";
import { type Image, releaseVersion, verifyCandidates, verifyIndex, npmPublication } from "../../scripts/release.ts";

it("rejects release tags that disagree with the package or lockfile before publication", () => {
  expect(releaseVersion("v0.1.0", "0.1.0", "0.1.0")).toBe("0.1.0");
  for (const tag of ["v0.2.0", "main", "v0.1.0;echo oops", "v01.1.0"]) {
    expect(() => releaseVersion(tag, "0.1.0", "0.1.0")).toThrow();
  }
  expect(() => releaseVersion("v0.1.0", "0.1.0", "0.2.0")).toThrow(/lockfile/);
});

const release = { version: "0.1.0", commit: "c".repeat(40), integrity: "sha512-tested-package" };
const digests = { cloud: ["1", "2"], full: ["3", "4"] };
const images: Image[] = ["cloud", "full"];
const of = (image: Image) => ["amd64", "arm64"].map((arch, i) => ({ ...release, arch, image, digest: `sha256:${digests[image][i].repeat(64)}`, verified: true }));

it("requires both tested native images from the same commit and package", () => {
  for (const image of images) {
    const candidates = of(image), other = of(image === "cloud" ? "full" : "cloud");
    expect(verifyCandidates([...other, ...candidates], release, image)).toEqual(candidates.map(c => c.digest));
    for (const bad of [[], candidates.slice(0, 1), [candidates[0], candidates[0]],
      [candidates[0], { ...candidates[1], verified: false }],
      [candidates[0], { ...candidates[1], commit: "d".repeat(40) }],
      [candidates[0], { ...candidates[1], integrity: "sha512-other" }]]) {
      expect(() => verifyCandidates([...other, ...bad], release, image)).toThrow();
    }
  }
});

it("refuses an existing image tag containing unverified or wrong-platform digests", () => {
  const candidates = [...of("cloud"), ...of("full")];
  const manifests = (image: Image) => of(image).map(c => ({ digest: c.digest, platform: { os: "linux", architecture: c.arch } }));
  for (const image of images) {
    const index = { manifests: manifests(image) };
    expect(() => verifyIndex(index, candidates, release, image)).not.toThrow();
    expect(() => verifyIndex({ manifests: manifests(image === "cloud" ? "full" : "cloud") }, candidates, release, image)).toThrow();
    expect(() => verifyIndex({ manifests: index.manifests.slice(0, 1) }, candidates, release, image)).toThrow();
    expect(() => verifyIndex({ manifests: [index.manifests[0], { ...index.manifests[1], digest: `sha256:${"f".repeat(64)}` }] }, candidates, release, image)).toThrow();
  }
});

it("keeps npm disabled until setup, and only skips existing versions with identical integrity", () => {
  expect(npmPublication(false, undefined, release.integrity)).toBe("disabled");
  expect(npmPublication(true, undefined, release.integrity)).toBe("publish");
  expect(npmPublication(true, release.integrity, release.integrity)).toBe("existing");
  expect(() => npmPublication(true, "sha512-different", release.integrity)).toThrow(/integrity/);
});
