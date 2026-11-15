// manifest.json, the list of what a reel holds and how it was composed (GH-31 decision 003).
import { type Errors, isObject, nonNegative, text } from "./check.ts";

export interface ManifestFile { path: string; bytes: number; sha256: string }

export interface Manifest {
  version: 1;
  script: { file: string; sha256: string };
  composer: { version: string; platform: string };
  integration: string;
  voice?: { adapter: string; voice: string; seed: number; language: string };
  /** Every file of the reel except manifest.json and work/, sorted by path. */
  files: ManifestFile[];
}

export type ManifestAbout = Omit<Manifest, "version" | "files">;

const SHA256 = /^[a-f0-9]{64}$/;

const digest = (errors: Errors, where: string, obj: Record<string, unknown>) => {
  if (typeof obj.sha256 !== "string" || !SHA256.test(obj.sha256)) errors.push(`${where}sha256 must be a SHA-256 hex digest`);
};

export function validateManifest(value: unknown): Errors {
  const errors: Errors = [];
  if (!isObject(value)) return ["manifest must be an object"];
  if (value.version !== 1) errors.push("version must be 1");

  if (!isObject(value.script)) errors.push("script must be an object");
  else {
    text(errors, "script.", value.script, "file");
    digest(errors, "script.", value.script);
  }
  if (!isObject(value.composer)) errors.push("composer must be an object");
  else {
    text(errors, "composer.", value.composer, "version");
    text(errors, "composer.", value.composer, "platform");
  }
  text(errors, "", value, "integration");
  if (value.voice !== undefined) {
    if (!isObject(value.voice)) errors.push("voice must be an object");
    else {
      text(errors, "voice.", value.voice, "adapter");
      text(errors, "voice.", value.voice, "voice");
      text(errors, "voice.", value.voice, "language");
      nonNegative(errors, "voice.", value.voice, "seed");
    }
  }

  if (!Array.isArray(value.files) || !value.files.length) return [...errors, "files must be a nonempty array"];
  let previous = "";
  value.files.forEach((file, i) => {
    const where = `files[${i}]: `;
    if (!isObject(file)) return void errors.push(`${where}must be an object`);
    nonNegative(errors, where, file, "bytes");
    digest(errors, where, file);
    if (typeof file.path !== "string") return void errors.push(`${where}path must be a string`);
    const parts = file.path.split("/");
    if (!file.path || file.path.startsWith("/") || parts.some((part) => !part || part === "." || part === "..")) {
      errors.push(`${where}path must be relative to the reel, without . or ..`);
    } else if (parts[0] === "work" || file.path === "manifest.json") {
      errors.push(`${where}${file.path} must not be listed`);
    }
    if (file.path <= previous) errors.push(`${where}paths must be sorted and unique`);
    previous = file.path;
  });
  return errors;
}
