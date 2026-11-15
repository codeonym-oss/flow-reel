#!/usr/bin/env node
// Serves this folder's index.html on http://localhost:4173 (or PORT), with nothing else to install.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const html = readFileSync(new URL("./index.html", import.meta.url));
const port = Number(process.env.PORT ?? 4173);
createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}).listen(port, () => console.log(`Orbit is on http://localhost:${port}/`));
