import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { type ImageTarget, imageFor } from "../../src/host/launch.ts";

const CANDIDATES = { full: "FLOW_REEL_TEST_IMAGE", cloud: "FLOW_REEL_TEST_IMAGE_CLOUD" } as const;

/**
 * The composer image a test needs (GH-101 decision 004). Supplied images are authoritative: never rebuild a registry
 * artifact under test, nor build one beside it.
 */
export function prepareImage(target: ImageTarget): string {
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  const image = imageFor(version, target);
  const candidate = process.env[CANDIDATES[target]];
  const docker = (...args: string[]) => execFileSync("docker", args, { stdio: "inherit" });
  if (candidate) {
    if (candidate.includes("@sha256:")) docker("pull", candidate);
    docker("image", "inspect", candidate, "--format", "{{.Id}} {{.Architecture}} {{.Size}}");
    if (candidate !== image) docker("tag", candidate, image);
  } else if (Object.values(CANDIDATES).some((name) => process.env[name])) {
    throw new Error(`${CANDIDATES[target]} must name the ${target} image, since another image under test is supplied`);
  } else {
    docker("build", "-q", "--target", target, "-t", image, "-f", "docker/Dockerfile", ".");
  }
  return image;
}

let prepared: string | undefined;

/**
 * Draws cards with the composer's own renderer (GH-76 decision 003): in this process when the tests run inside the
 * image, else in the image, with the folders mounted at the same paths. CI runners have no Chromium of their own.
 */
export async function renderCardsInImage(jobs: readonly import("../../src/composer/media/cards.ts").CardJob[],
  options: Omit<import("../../src/composer/media/cards.ts").CardRenderOptions, "painter">): Promise<Record<string, string>> {
  if (process.env.FLOW_REEL_IN_CONTAINER === "1") {
    const { renderCards } = await import("../../src/composer/media/cards.ts");
    const { chromiumPainter } = await import("../../src/adapters/chromium/painter.ts");
    return renderCards(jobs, { ...options, painter: chromiumPainter });
  }
  prepared ??= prepareImage("cloud");
  const { dirname } = await import("node:path");
  const mounts = [...new Set([options.work, options.scriptDir, dirname(options.capture)])].flatMap((dir) => ["-v", `${dir}:${dir}`]);
  const code = `const [jobs, options] = JSON.parse(process.argv[1]);
const { renderCards } = await import("/opt/flow-reel/dist/composer/media/cards.js");
const { chromiumPainter } = await import("/opt/flow-reel/dist/adapters/chromium/painter.js");
console.log(JSON.stringify(await renderCards(jobs, { ...options, painter: chromiumPainter })));`;
  const { promisify } = await import("node:util");
  const { execFile } = await import("node:child_process");
  const { stdout } = await promisify(execFile)("docker", ["run", "--rm", "--init", "--shm-size=1g", "--user", `${process.getuid!()}:${process.getgid!()}`,
    ...mounts, "--entrypoint", "node", prepared, "--input-type=module", "-e", code, JSON.stringify([jobs, options])], { maxBuffer: 1 << 24 });
  return JSON.parse(stdout.trim().split("\n").at(-1)!);
}
