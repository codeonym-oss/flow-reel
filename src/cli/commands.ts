// The CLI's commands, by name, in the order its help lists them.
import type { Command } from "./command.ts";
import { cancel } from "./cancel.ts";
import { compare } from "./compare.ts";
import { compose } from "./compose.ts";
import { init } from "./init.ts";
import { logs } from "./logs.ts";
import { verify } from "./verify.ts";
import { wait, watch } from "./watch.ts";

export const COMMANDS: Readonly<Record<string, Command>> = { init, compose, watch, wait, logs, cancel, verify, compare };
