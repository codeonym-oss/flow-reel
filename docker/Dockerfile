# The recording sandbox (GH-2 decision 004): Playwright's image, plus a virtual display and ffmpeg.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

RUN apt-get update \
 && apt-get install -y --no-install-recommends xvfb x11-utils ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/flow-reel
COPY package.json ./
RUN npm install --omit=dev --no-fund --no-audit
COPY dist ./dist

ENV FLOW_REEL_IN_CONTAINER=1 HOME=/tmp
USER pwuser
ENTRYPOINT ["node", "/opt/flow-reel/dist/cli.js"]
