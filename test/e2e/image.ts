import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** A supplied image is authoritative: never rebuild a registry artifact under test. */
export function prepareImage(): string {
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  const image = `ghcr.io/codeonym-oss/flow-reel:${version}`;
  const candidate = process.env.FLOW_REEL_TEST_IMAGE;
  const docker = (...args: string[]) => execFileSync("docker", args, { stdio: "inherit" });
  if (candidate) {
    if (candidate.includes("@sha256:")) docker("pull", candidate);
    docker("image", "inspect", candidate, "--format", "{{.Id}} {{.Architecture}} {{.Size}}");
    if (candidate !== image) docker("tag", candidate, image);
  } else {
    docker("build", "-q", "-t", image, "-f", "docker/Dockerfile", ".");
  }
  return image;
}
