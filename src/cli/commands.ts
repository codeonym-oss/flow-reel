// The CLI's commands, by name, in the order its help lists them.
import type { Command } from "./command.ts";
import { compare } from "./compare.ts";
import { compose } from "./compose.ts";
import { init } from "./init.ts";
import { verify } from "./verify.ts";

export const COMMANDS: Readonly<Record<string, Command>> = { init, compose, verify, compare };
