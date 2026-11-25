# Voices

## Goal

A person chooses any voice: a provider, their own endpoint, or flow-reel's local voice. The composer image is one and small,
and scripts never run beside an API key.

## What it delivers

- **One composer image,** without the local voice (epic decision 022).
- **The voice server** (022, 030): today's local voice in its own image, answering as an OpenAI-compatible endpoint, with
  commands to start and stop it. The model stays loaded between runs.
- **Voices called by flow-reel itself,** outside the container, so `localhost` endpoints work and the runner holds no key.
- **Connectors:** OpenAI, Gemini, OpenRouter, Together, Groq, ElevenLabs, and any OpenAI-compatible endpoint with its address
  and an optional key.
- **No voice configured:** the compose is silent, with captions, and says how to add one.
- **The migration** from the built-in voice and from the two images of 0.7, documented.

## Rules every ticket keeps

- The same comment and voice settings reuse the saved clip, whichever voice spoke it.
- A missing or failing voice never loses a recording: the run resumes from the voice phase.
- The voice server's audio matches 0.7's local voice for the same text and settings.

## To settle in its pass

- What the voice server accepts beyond the OpenAI request: speaker, language and seed.
- Whether flow-reel starts the server by itself when a run needs it, and when it stops.
- How the release builds and checks the two images.

## Done when

- A reel composes with the voice server, with a provider, with another local endpoint, and silently with none.
- The runner's container holds no key.
- The composer image is about the size of today's cloud image.

## Not part of this story

- Other machine learning (word timings, translation), and hosting the voice server for a team.
