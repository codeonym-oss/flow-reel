// Guards shared by the release workflow and its executable checks. No registry writes here.
export function releaseVersion(tag: string, version: string, lockVersion: string): string {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag) || tag !== `v${version}`) {
    throw new Error(`release tag ${tag} does not match package version ${version}`);
  }
  if (lockVersion !== version) throw new Error("lockfile version does not match package version");
  return version;
}

export interface Release { version: string; commit: string; integrity: string }
/** The images of a release, with the suffix of each one's tag (GH-101). */
export const IMAGES = { cloud: "-cloud", full: "" } as const;
export type Image = keyof typeof IMAGES;
export interface Candidate extends Release { arch: string; image: Image; digest: string; verified: boolean }

/** One image's digests, one per architecture, from the candidates of every image. */
export function verifyCandidates(all: Candidate[], release: Release, image: Image): string[] {
  const candidates = all.filter(c => c.image === image);
  if (candidates.length !== 2) throw new Error(`both native ${image} candidates are required`);
  return ["amd64", "arm64"].map(arch => {
    const matches = candidates.filter(c => c.arch === arch);
    const c = matches[0];
    if (matches.length !== 1 || !c.verified || c.version !== release.version || c.commit !== release.commit
      || c.integrity !== release.integrity || !/^sha256:[a-f0-9]{64}$/.test(c.digest)) {
      throw new Error(`unverified or conflicting ${arch} ${image} candidate`);
    }
    return c.digest;
  });
}

interface ImageIndex { manifests?: { digest: string; platform?: { os: string; architecture: string } }[] }
export function verifyIndex(index: ImageIndex, candidates: Candidate[], release: Release, image: Image): void {
  const digests = verifyCandidates(candidates, release, image);
  if (index.manifests?.length !== 2 || ["amd64", "arm64"].some((arch, i) =>
    !index.manifests!.some(m => m.platform?.os === "linux" && m.platform.architecture === arch && m.digest === digests[i]))) {
    throw new Error("image manifest does not match verified native candidates");
  }
}

export function npmPublication(enabled: boolean, existing: string | undefined, integrity: string): string {
  if (!enabled) return "disabled";
  if (existing === undefined) return "publish";
  if (existing !== integrity) throw new Error("existing npm version has conflicting integrity");
  return "existing";
}
