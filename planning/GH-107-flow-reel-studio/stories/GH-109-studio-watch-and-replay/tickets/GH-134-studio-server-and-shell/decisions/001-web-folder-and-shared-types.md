# 001: The web app lives in `web/`, is built to `dist/web/`, and shares `src/studio/api.ts`

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** where do the studio's server, its web app and their shared types live, and how are they built?

**Decision:**

- **The server** in `src/studio/`, compiled with the rest of the package by `tsc`.
- **The web app** in `web/`, with its own `tsconfig.json` (DOM types, JSX for Preact), built by Vite to `dist/web/`.
  `npm run build` runs both. JSX is compiled by Vite's own transform with Preact's import source: no Vite plugin.
- **The shared types** (story decision 008) in `src/studio/api.ts`: types only, imported by the server and, as
  `import type`, by the web app.
- CI's path rules count `web/` and `vite.config.ts` as runtime.

- **Why:** the node and DOM type worlds stay apart; the published package gains one folder, `dist/web/`.
- **Not chosen:** the web app inside `src/` (the package build would compile browser code with node types);
  `@preact/preset-vite` (hot reload this project doesn't need, and more dev dependencies).
