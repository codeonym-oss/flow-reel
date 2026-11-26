// The WebSocket protocol (RFC 6455), as much as the studio needs, on `node:http` (GH-134 decision 003): the opening
// handshake, text and binary messages, ping, pong and close. Frames are encoded and decoded by pure functions.
import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
/** The largest message a browser may send: the studio's commands are small. */
export const LONGEST_MESSAGE = 64 * 1024;

export const OP = { continuation: 0x0, text: 0x1, binary: 0x2, close: 0x8, ping: 0x9, pong: 0xa } as const;

export const acceptKey = (key: string): string => createHash("sha1").update(key + GUID).digest("base64");

/** One unmasked frame, as a server sends it. */
export function encodeFrame(opcode: number, payload: Buffer | string = Buffer.alloc(0)): Buffer {
  const data = typeof payload === "string" ? Buffer.from(payload) : payload;
  const length = data.length;
  const head = length < 126 ? Buffer.alloc(2) : length < 65_536 ? Buffer.alloc(4) : Buffer.alloc(10);
  head[0] = 0x80 | opcode;
  if (length < 126) head[1] = length;
  else if (length < 65_536) { head[1] = 126; head.writeUInt16BE(length, 2); }
  else { head[1] = 127; head.writeBigUInt64BE(BigInt(length), 2); }
  return Buffer.concat([head, data]);
}

export interface Frame { fin: boolean; opcode: number; payload: Buffer }

/** The protocol was broken: the connection closes with `code`. */
export class ProtocolError extends Error {
  readonly code: number;
  constructor(code: number, message: string) { super(message); this.code = code; }
}

/**
 * Reads the complete frames at the start of `buffer`, as a client sends them (masked). Returns them and the bytes left
 * for the next read; throws a ProtocolError for an unmasked frame, reserved bits, or a frame over `longest` bytes.
 */
export function decodeFrames(buffer: Buffer, longest = LONGEST_MESSAGE): { frames: Frame[]; rest: Buffer } {
  const frames: Frame[] = [];
  let at = 0;
  for (;;) {
    if (buffer.length - at < 2) break;
    const first = buffer[at]!, second = buffer[at + 1]!;
    if (first & 0x70) throw new ProtocolError(1002, "reserved bits are set");
    if (!(second & 0x80)) throw new ProtocolError(1002, "a client's frame must be masked");
    let length = second & 0x7f;
    let offset = at + 2;
    if (length === 126) {
      if (buffer.length < offset + 2) break;
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (buffer.length < offset + 8) break;
      const long = buffer.readBigUInt64BE(offset);
      if (long > BigInt(longest)) throw new ProtocolError(1009, "the message is too long");
      length = Number(long);
      offset += 8;
    }
    if (length > longest) throw new ProtocolError(1009, "the message is too long");
    if (buffer.length < offset + 4 + length) break;
    const mask = buffer.subarray(offset, offset + 4);
    const payload = Buffer.from(buffer.subarray(offset + 4, offset + 4 + length));
    for (let i = 0; i < payload.length; i++) payload[i]! ^= mask[i & 3]!;
    frames.push({ fin: !!(first & 0x80), opcode: first & 0x0f, payload });
    at = offset + 4 + length;
  }
  return { frames, rest: buffer.subarray(at) };
}

export interface Connection {
  sendText(text: string): void;
  sendBinary(data: Buffer): void;
  /** Bytes written but not yet sent: a sender can drop what would queue up behind them. */
  readonly buffered: number;
  close(code?: number, reason?: string): void;
  onText(listener: (text: string) => void): void;
  onClose(listener: () => void): void;
}

/** Whether a request asks to become a WebSocket. */
export const isUpgrade = (request: IncomingMessage): boolean =>
  request.headers.upgrade?.toLowerCase() === "websocket" && !!request.headers["sec-websocket-key"];

/** Completes the handshake on an upgrade request's socket and returns the connection. */
export function accept(request: IncomingMessage, socket: Duplex): Connection {
  const key = request.headers["sec-websocket-key"]!;
  socket.write(["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey(key)}`, "", ""].join("\r\n"));
  const texts: ((text: string) => void)[] = [];
  const closes: (() => void)[] = [];
  let closed = false;
  let unread: Buffer = Buffer.alloc(0);
  let pieces: Buffer[] = [];
  let pieceOp = 0;
  const end = () => {
    if (closed) return;
    closed = true;
    for (const listener of closes) listener();
  };
  const close = (code = 1000, reason = "") => {
    if (!closed && socket.writable) {
      const payload = Buffer.alloc(2 + Buffer.byteLength(reason));
      payload.writeUInt16BE(code);
      payload.write(reason, 2);
      socket.end(encodeFrame(OP.close, payload));
    }
    end();
  };
  const deliver = (opcode: number, payload: Buffer) => {
    if (opcode === OP.text) for (const listener of texts) listener(payload.toString("utf8"));
  };
  socket.on("data", (chunk: Buffer) => {
    unread = unread.length ? Buffer.concat([unread, chunk]) : chunk;
    let frames: Frame[];
    try { ({ frames, rest: unread } = decodeFrames(unread)); }
    catch (error) { return close((error as ProtocolError).code ?? 1002, (error as Error).message); }
    for (const { fin, opcode, payload } of frames) {
      if (opcode === OP.close) return close();
      if (opcode === OP.ping) { socket.write(encodeFrame(OP.pong, payload)); continue; }
      if (opcode === OP.pong) continue;
      if (opcode !== OP.continuation) { pieceOp = opcode; pieces = []; }
      pieces.push(payload);
      if (pieces.reduce((sum, piece) => sum + piece.length, 0) > LONGEST_MESSAGE) return close(1009, "the message is too long");
      if (fin) { deliver(pieceOp, Buffer.concat(pieces)); pieces = []; }
    }
  });
  socket.on("close", end).on("error", end);
  return {
    sendText: (text) => { if (!closed) socket.write(encodeFrame(OP.text, text)); },
    sendBinary: (data) => { if (!closed) socket.write(encodeFrame(OP.binary, data)); },
    get buffered() { return (socket as Duplex & { writableLength: number }).writableLength; },
    close,
    onText: (listener) => { texts.push(listener); },
    onClose: (listener) => { closes.push(listener); },
  };
}
