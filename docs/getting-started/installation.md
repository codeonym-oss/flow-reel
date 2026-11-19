# Installation

```sh
npm install --save-dev flow-reel
```

flow-reel has two parts with the same version:

- **The npm package:** the `flow-reel` command and the script words you import (`script`, `Sounds`). It runs on your
  machine.
- **The composer:** the `ghcr.io/codeonym-oss/flow-reel:<version>` container image that replays the script,
  records it and renders the video. `flow-reel compose` pulls it the first time. If it can't be pulled, it is built
  locally once, which takes a few minutes.

## Requirements

| | Needed |
|---|---|
| Node.js | 22.18 or later. Scripts are TypeScript, run with Node's type stripping. |
| Container engine | Docker or Podman. |
| CPU | About 2.5 free cores while recording. On an overloaded machine the compose stops with an error rather than save a video whose timing is off. |
| Disk | About 7 GB for the composer image. Its build downloads about 2.5 GB of model weights for the built-in local voice. |
| Memory | Only for the built-in local voice: more than 5 GiB of process memory, on top of your app and OS. A cloud voice needs none of it. |
| Network | Only for a cloud voice, or to pull the image. The local voice runs offline. |

## Platforms

| Platform | Status |
|---|---|
| Linux, amd64 and arm64 (Docker or Podman) | Tested in CI. The container uses the host's network, so `localhost` in a script is your machine. |
| macOS and Windows (Docker Desktop) | Works through Docker Desktop's Linux runtime. `localhost` in a script is mapped to `host.docker.internal`. Not yet tested in CI. |

## Pull the image ahead of time

The first compose waits for the image. To pull it ahead of time and see its progress:

```sh
docker pull ghcr.io/codeonym-oss/flow-reel:$(node -p "require('./node_modules/flow-reel/package.json').version")
```

Or name the version you installed, for example `ghcr.io/codeonym-oss/flow-reel:0.5.0`.

## Choose a voice now

A cloud voice is the recommended start: it needs only an API key in your environment.

```sh
export OPENAI_API_KEY=...   # or GEMINI_API_KEY, ELEVENLABS_API_KEY, ... (see Voices)
```

The key stays in the environment. flow-reel passes it into the container by name, and never writes it to a file or
the command line. See [Voices](../guide/voices.md) for every provider and the built-in local voice.

## Agent plugin (optional)

To have Claude Code or Codex make reels for you, also install the plugin. See
[Make reels with Claude](../tutorials/with-claude.md).

Next: [Quickstart](quickstart.md).
