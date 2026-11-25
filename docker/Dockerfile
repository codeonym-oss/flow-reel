# The recording sandbox (GH-2 decision 004): Playwright's image, plus a virtual display and ffmpeg. Two images come from
# it (GH-101 decision 002): `cloud` has everything but the local voice, and `full`, the last stage, adds that.
# Pinned by digest (amd64 + arm64 index, 2026-11-13) so a republished tag can't change the browser or OS layers.
FROM mcr.microsoft.com/playwright:v1.64.1-noble@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f AS base

# Ubuntu's archive serves only current package versions, so these follow noble-updates (FFmpeg stays 6.1.x). A
# released image is immutable by digest; rebuilding the same version can pick up newer security patches.
RUN apt-get update \
 && apt-get install -y --no-install-recommends xvfb x11-utils ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/flow-reel

FROM base AS cloud
COPY package*.json ./
# npm omits package-lock.json from published tarballs; source builds use the committed lock.
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --no-fund --no-audit; \
    else npm install --omit=dev --no-fund --no-audit; fi
COPY dist ./dist
COPY docker/sfx ./docker/sfx
COPY docker/fonts ./docker/fonts

ENV FLOW_REEL_IN_CONTAINER=1 HOME=/tmp
USER pwuser
ENTRYPOINT ["node", "/opt/flow-reel/dist/container/main.js"]

# The voice's layers come before the app's, so changing the app rebuilds none of them.
FROM base AS full
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3-venv sox libsndfile1 time \
 && rm -rf /var/lib/apt/lists/*
COPY docker/tts/requirements.txt docker/tts/requirements.txt
RUN python3 -m venv /opt/flow-reel/tts-venv \
 && /opt/flow-reel/tts-venv/bin/pip install --no-cache-dir -r docker/tts/requirements.txt
COPY docker/tts ./docker/tts
RUN /opt/flow-reel/tts-venv/bin/python docker/tts/download.py
COPY --from=cloud /opt/flow-reel ./

ENV FLOW_REEL_IN_CONTAINER=1 HOME=/tmp HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 TOKENIZERS_PARALLELISM=false
USER pwuser
ENTRYPOINT ["node", "/opt/flow-reel/dist/container/main.js"]
