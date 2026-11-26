# 004: The studio's fonts ship inside the package

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** where do IBM Plex Sans and JetBrains Mono (story decision 006) come from, with no internet (epic 032)?

**Decision:** **the `@fontsource` packages, as dev dependencies; Vite copies the Latin woff2 files the CSS uses into
`dist/web/`.** The page loads nothing from another site.

- **Why:** the studio works offline, and the third lock (story decision 010) can refuse every other origin, fonts
  included.
- **Accepted cost:** about 200 KB more in the package.
- **Not chosen:** Google Fonts (needs the internet, and a request to Google from a local tool); system fonts only (the
  approved theme's type changes on every computer).
