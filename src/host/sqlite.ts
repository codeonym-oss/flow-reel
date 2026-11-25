// Node's own SQLite. It was experimental until Node 24, which said so on the error output of every command.
import type { DatabaseSync } from "node:sqlite";

let sqlite: typeof import("node:sqlite") | undefined;

function load(): typeof import("node:sqlite") {
  if (sqlite) return sqlite;
  const { emitWarning } = process;
  process.emitWarning = (() => {}) as typeof process.emitWarning;
  try { sqlite = process.getBuiltinModule("node:sqlite"); }
  finally { process.emitWarning = emitWarning; }
  return sqlite;
}

/** Opens a database, waiting up to `waitMs` for whoever has it locked. */
export function openDatabase(file: string, waitMs = 0): DatabaseSync {
  const db = new (load().DatabaseSync)(file);
  db.exec(`PRAGMA busy_timeout = ${waitMs}`);
  return db;
}

const SQLITE_BUSY = 5;

/** Whether an error says another connection has the database locked. */
export const isBusy = (error: unknown): boolean => ((error as { errcode?: number }).errcode ?? 0) % 256 === SQLITE_BUSY;
