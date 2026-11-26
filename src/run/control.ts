// What a client can send to a run's process: one JSON line per command, answered by one JSON line (epic GH-107 decision 031,
// GH-108 decision 011). Pure; the host carries the lines.

export const CONTROL_VERSION = 1;

/** The commands this version takes. `picture` keeps the connection, which then carries the live picture (GH-138). */
export const COMMANDS = ["cancel", "picture"] as const;
export type Command = typeof COMMANDS[number];

export type Answer = { ok: true } | { ok: false; error: string };

/** One picture of the live screen, a base64 JPEG, as a line after `picture`'s answer. */
export const pictureLine = (jpeg: string): string => `${JSON.stringify({ picture: jpeg })}\n`;
export const readPicture = (line: string): string => String((JSON.parse(line) as { picture?: unknown }).picture);

/** `token` proves the client can read the run's folder. */
export const commandLine = (command: Command, token: string): string => `${JSON.stringify({ v: CONTROL_VERSION, token, command })}\n`;
export const answerLine = (answer: Answer): string => `${JSON.stringify(answer)}\n`;

/** The command a line holds; throws saying why it is refused. */
export function readCommand(line: string, token: string): Command {
  let value: unknown;
  try { value = JSON.parse(line); } catch { throw new Error("the command isn't JSON"); }
  const { v, token: given, command } = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  if (given !== token) throw new Error("the command's token isn't the run's");
  if (v !== CONTROL_VERSION) throw new Error(`the command has version ${JSON.stringify(v)}; this run takes version ${CONTROL_VERSION}`);
  if (!(COMMANDS as readonly unknown[]).includes(command)) throw new Error(`unknown command ${JSON.stringify(command)}; this run takes ${COMMANDS.join(", ")}`);
  return command as Command;
}

export function readAnswer(line: string): Answer {
  const value = JSON.parse(line) as { ok?: unknown; error?: unknown };
  return value.ok === true ? { ok: true } : { ok: false, error: String(value.error) };
}
