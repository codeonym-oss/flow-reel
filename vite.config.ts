// The studio's web app (GH-109 decision 001, GH-134 decision 001): built ahead of time into dist/web/, which the package
// ships and `flow-reel studio` serves.
import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  base: "/",
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  build: { outDir: "../dist/web", emptyOutDir: true, assetsInlineLimit: 0, target: "es2023" },
});
