// What the host asks the composer's container to do, as one JSON argument: the host has read the workspace, so the
// container reads no configuration (GH-108 decision 002).
import type { Brand } from "../composer/cards/brand.ts";
import type { Settings } from "../settings.ts";

export interface ComposeRequest {
  /** The script's path in the scripts folder, with forward slashes. */
  script: string;
  /** The reel's path in the output folder, with forward slashes. */
  reel: string;
  settings: Settings;
  brand: Brand;
  sound: boolean;
}

/** Where the host mounts the scripts folder, read-only, and the output folder. */
export const SCRIPTS_MOUNT = "/scripts";
export const OUTPUT_MOUNT = "/out";
