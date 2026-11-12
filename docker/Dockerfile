# The recording sandbox (GH-2 decision 004): Playwright's image, plus a virtual display and ffmpeg.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

RUN apt-get update \
 && apt-get install -y --no-install-recommends xvfb x11-utils ffmpeg python3-venv sox libsndfile1 time \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/flow-reel
COPY docker/tts/requirements.txt docker/tts/requirements.txt
RUN python3 -m venv /opt/flow-reel/tts-venv \
 && /opt/flow-reel/tts-venv/bin/pip install --no-cache-dir -r docker/tts/requirements.txt
COPY docker/tts ./docker/tts
RUN /opt/flow-reel/tts-venv/bin/python docker/tts/download.py
COPY package.json ./
RUN npm install --omit=dev --no-fund --no-audit
COPY dist ./dist
COPY docker/sfx ./docker/sfx

ENV FLOW_REEL_IN_CONTAINER=1 HOME=/tmp HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 TOKENIZERS_PARALLELISM=false
USER pwuser
ENTRYPOINT ["node", "/opt/flow-reel/dist/cli.js"]
