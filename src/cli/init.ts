import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { type KnownWorkspace, dataDir, localSlug, rememberWorkspace, slugOwner } from "../host/data.ts";
import { CONFIG_FILE, SLUG, readConfig } from "../workspace/config.ts";
import { initialize, proposedScripts, scriptsToRename, slugify, survey } from "../workspace/init.ts";
import { workspaceAt } from "../workspace/workspace.ts";
import { type Command, EXIT, UsageError, parse } from "./command.ts";

export const init: Command = {
  summary: "make a project a workspace",
  usage: "flow-reel init [folder] [--title <title>] [--description <text>] [--slug <name>] [--scripts <folder>] " +
    "[--output <folder>]\n       flow-reel init [folder] --alias <name>",
  async run(args) {
    const { positionals: [folder = "."], flags } = parse(args, { title: "text", description: "text", slug: "text", scripts: "text",
      output: "text", alias: "text" }, { min: 0, max: 1 });
    const root = resolve(folder);
    if (!existsSync(root)) throw new UsageError(`${folder} doesn't exist`);
    const data = dataDir();
    if (flags.alias !== undefined) return giveAlias(data, root, flags.alias);

    const found = survey(root);
    const answers = await ask(flags, proposedScripts(found), (slug) => slugOwner(data, slug));
    const slug = answers.slug ?? slugify(answers.title);
    const owner = slug ? slugOwner(data, slug) : undefined;
    if (owner) throw new Error(taken(slug, owner));
    const workspace = initialize(root, found, answers);
    rememberWorkspace(data, workspace);

    const { config } = workspace;
    const at = (path: string) => relative(process.cwd(), path) || ".";
    console.log(`${config.workspace.title} (${config.workspace.slug}) is a workspace now: ${at(root)}/${CONFIG_FILE}`.replace("./", ""));
    console.log(`Scripts go in ${config.scripts}/ as <name>.reel.ts; reels are written to ${config.output}/`);
    if (found.legacy) console.log(`Took over the settings of ${at(found.legacy.file)}`);
    const renames = scriptsToRename(workspace);
    if (renames.length) console.log(`Rename these scripts:\n${renames.map(({ from, to }) => `  git mv ${from} ${to}`).join("\n")}`);
    return EXIT.ok;
  },
};

const taken = (slug: string, owner: KnownWorkspace) => `"${slug}" is already the name of ${owner.title} (${owner.roots[0]}) on this ` +
  "computer: choose another title, or another name with --slug";

function giveAlias(data: string, root: string, alias: string): number {
  if (!SLUG.test(alias)) throw new UsageError(`--alias must be lowercase words joined by hyphens, not ${JSON.stringify(alias)}`);
  const found = readConfig(root);
  if (found?.kind !== "config") throw new Error(`${root} isn't a workspace: run \`flow-reel init\` without --alias first`);
  const known = rememberWorkspace(data, workspaceAt(root, found.config), alias);
  console.log(`${known.title} is ${localSlug(known)} on this computer`);
  return EXIT.ok;
}

interface Answers { title: string; description?: string; slug?: string; scripts?: string; output?: string }

/** Asks what the flags leave out, in a terminal; elsewhere nothing is asked, and a missing title is an error. */
async function ask(flags: Partial<Answers>, scripts: string, owner: (slug: string) => KnownWorkspace | undefined): Promise<Answers> {
  if (flags.title !== undefined) return { ...flags, title: flags.title };
  if (!process.stdin.isTTY) throw new UsageError("--title is needed: the workspace's title, unique on this computer");
  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  try {
    let title = "";
    for (;;) {
      title = (await terminal.question("Title: ")).trim();
      const slug = flags.slug ?? slugify(title);
      const other = slug ? owner(slug) : undefined;
      if (title && !other) break;
      console.error(other ? taken(slug, other) : "A workspace needs a title.");
    }
    const description = flags.description ?? (await terminal.question("Description (optional): ")).trim();
    const folder = flags.scripts ?? ((await terminal.question(`Scripts folder (${scripts}): `)).trim() || undefined);
    return { ...flags, title, ...(description ? { description } : {}), ...(folder ? { scripts: folder } : {}) };
  } finally {
    terminal.close();
  }
}
