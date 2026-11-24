# Voices

The **voice** is the speech model that speaks a script's comments. flow-reel has one built-in local voice and seven
cloud voices.

:::{tip}
**Prefer a cloud voice.** It speaks a whole script in seconds, sends four comments at a time, and needs only an
API key in your environment. The built-in local voice runs on your CPU: about a minute a comment on a laptop, with
more than 5 GiB of memory.
:::

| | Cloud voice | Built-in local voice |
|---|---|---|
| Speed | seconds for a whole script | about a minute a comment on a laptop CPU |
| Needs | an API key in an environment variable, and a network | more than 5 GiB of memory, about 2.5 free cores |
| Image | about 2.6 GB | about 7 GB |
| Models | any of the provider's | **Qwen3-TTS 0.6B only** |
| Cost | the provider's price, for new or changed comments only | free |
| Offline | no | yes |
| Same audio on every compose | through the [reel cache](#the-reel-cache) | yes, on the same CPU and image |

The voice also picks the composer image: a cloud or self-hosted voice uses the smaller `-cloud` image, and the built-in
local voice uses the full one. Changing between them pulls the other image once.

## Cloud voices

Pick one with `voice.adapter` in `flow-reel.json` (or `--voice`), set its key in your shell, and compose as usual:

```json
{
  "version": 1,
  "voice": { "adapter": "openai", "model": "gpt-4o-mini-tts", "speaker": "coral", "apiKeyEnv": "OPENAI_API_KEY" }
}
```

```sh
export OPENAI_API_KEY=...
npx flow-reel compose demos/settings.ts
```

| `voice.adapter` | Default model | Default speaker | Key variable |
|---|---|---|---|
| `openai` | `gpt-4o-mini-tts` | `coral` | `OPENAI_API_KEY` |
| `gemini` | `gemini-3.8-flash-tts` | `Kore` | `GEMINI_API_KEY` |
| `openrouter` | `google/gemini-3.8-flash-tts` | `Kore` | `OPENROUTER_API_KEY` |
| `together` | `canopylabs/orpheus-3b-0.1-ft` | `tara` | `TOGETHER_API_KEY` |
| `groq` | `canopylabs/orpheus-v1-english` | `troy` | `GROQ_API_KEY` |
| `elevenlabs` | `eleven_multilingual_v2` | `JBFqnCBsd6RMkjVDRZzb` (a voice ID) | `ELEVENLABS_API_KEY` |
| `openai-compatible` | none: set `model` | `alloy` | none: set `apiKeyEnv` if the server needs a key |

Every setting can also be a flag:

```sh
npx flow-reel compose demos/settings.ts --voice gemini --speaker Puck
npx flow-reel compose demos/settings.ts --voice openai --model gpt-4o-mini-tts --api-key-env MY_OPENAI_KEY
```

**Model and speaker**
: Any value the provider accepts. flow-reel passes them on unchecked, since each provider's lists change, and a wrong
  one fails with the provider's own message. OpenRouter routes to many speech models (Gemini, ElevenLabs, Mistral,
  Deepgram and others) behind one key. Its current list, with each model's voices:
  `curl -s "https://openrouter.ai/api/v1/models?output_modalities=speech"`.

**Language**
: `auto` by default: the provider detects it from the text. Together AI and ElevenLabs also take an ISO 639-1 code
  (`"language": "fr"`). The others ignore it.

**Server**
: `baseUrl` points a voice at another endpoint: a proxy, a regional host, or any OpenAI-compatible server. From
  inside the container, `localhost` is the machine running the compose.

**Retries**
: Rate limits (HTTP 429) and server errors are retried with backoff, honouring `Retry-After`. A rejected key fails
  at once and names the variable to check.

**Repeatability**
: A cloud voice may not say a line the same way twice. The [reel cache](#the-reel-cache) keeps that from mattering:
  unchanged comments reuse their clips, so a recompose sends only new or changed comments, and you don't pay for the
  rest. The transcript records the voice as `<adapter>:<model>`.

Claude isn't a voice: Anthropic has no speech API.

### Keys stay in the environment

A cloud voice reads its key from an environment variable. The host checks it is set and passes it into the container
by name, so its value is never written to the reel, the manifest, `flow-reel.json` or the command line.
`flow-reel.json` names the variable (`apiKeyEnv`), never the key: a file with `apiKey` in it is refused.

## Self-hosted voices

Any speech server that implements OpenAI's `POST /audio/speech` works through `openai-compatible`: a self-hosted
Kokoro, or another local server. Set `baseUrl` to the server's API root (flow-reel appends `/audio/speech`) and
`model` to what the server expects:

```json
{
  "version": 1,
  "voice": { "adapter": "openai-compatible", "baseUrl": "http://localhost:8880/v1", "model": "kokoro", "speaker": "af_bella" }
}
```

The model and speaker names above are examples, so check your server's own docs for its names. flow-reel asks for
WAV audio. Add `apiKeyEnv` only if the server needs a key.

## The built-in local voice

:::{note}
**Qwen3-TTS 0.6B CustomVoice is the only built-in local voice today** (`qwen3-tts-0.6b`). It's the default when
no voice is set. For any other model running on your own machine, use a [self-hosted voice](#self-hosted-voices).
:::

It runs inside the full composer image, on the CPU, through the official Python runtime. Its model and tokenizer are
pinned and downloaded when the image is built, so it works offline without a key.

| Setting | Values | Default |
|---|---|---|
| `speaker` | `Aiden`, `Dylan`, `Eric`, `Ono_Anna`, `Ryan`, `Serena`, `Sohee`, `Uncle_Fu`, `Vivian` | `Ryan` |
| `language` | `chinese`, `english`, `french`, `german`, `italian`, `japanese`, `korean`, `portuguese`, `russian`, `spanish` | `english` |

```sh
npx flow-reel compose demos/settings.ts --speaker Serena --language english
```

What to expect:

- Speech is generated after capture finishes, using four CPU threads and more than 5 GiB of process memory.
- On the tested Ryzen 5 3500U, one process generated three short clips (6.4 s of speech) in 147 s, at about 5.4 GiB
  peak memory. Runtime varies with load.
- A synthesis job times out after 15 minutes, and a step fails rather than return truncated speech.
- Each clip resets seed 0 with pinned settings. Matching hashes are checked on the tested CPU and image. Byte
  equality across hardware or architectures isn't guaranteed.
- Speakers differ in how natural they sound in each language. Before a long reel, compose a one-comment script with
  two speakers and listen to both.

## The reel cache

The reel already on disk is the voice's cache. A comment with the same text (whitespace normalized) and the same
voice settings (adapter, model, speaker, language) reuses the previous reel's clip, as long as the clip still matches
the hash in its transcript. Every other comment is spoken again.

- Recomposing an unchanged script speaks nothing, and gives the same audio and transcript.
- The compose says how many comments it voiced and how many it reused.
- Changing the provider, model, speaker or language speaks everything again.
- Deleting the reel deletes its cache.

Pick a voice once per project, in `flow-reel.json`, and keep it.
