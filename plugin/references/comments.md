# Comments: what the voice says

A comment is spoken by the voice and shown as a caption. It is the viewer's guide, not a description of the mouse.

## Writing a comment

- **One idea, one comment.** About 6–16 words. Two ideas are two scenes.
- **Say why before how.** "Save it, so the team sees the same view" beats "Click the Save view button".
  For a learner, name the control too: "Click Save view, top right."
- **Talk about what's on screen now**, or what is about to happen. Don't announce what happened three steps ago.
- **Speakable text.** Write numbers as they are said when it matters ("twenty-four hours", "version two"); spell out
  symbols ("and", not "&"); expand acronyms the voice may misread on first use. Avoid parentheses and lists.
- **Short sentences, plain words.** The voice reads exactly what you write; punctuation shapes its pauses.
- **No filler.** Cut "Now", "As you can see", "Let's go ahead and". Start with the verb or the subject.

| Instead of | Write |
|---|---|
| "Now we are going to click on the Active filter button in order to filter the list." | "Let's look at the active projects." |
| "As you can see the chart has updated." | "The chart follows the filter: active work is picking up." |
| "Here I type the name of the view, which is Active work, and then I click Save." | "Give the view a name, and save it." |

## Placing a comment

- `comment("…")` before the scene's first action, or chained on that action's locator: `locator.comment("…")`.
- A scene whose comment is longer than its actions holds its last frame until the comment ends. That is fine for a
  result worth looking at; for a dull frame, shorten the comment.
- An opening comment with no action (two comments in a row) speaks over the starting page. Keep it to one line.

## The voice

The local voice (`qwen3-tts-0.6b`) speaks nine speakers in ten languages, offline but slowly. A cloud voice (OpenAI,
Gemini, OpenRouter, Together AI, Groq, ElevenLabs or an OpenAI-compatible server; `language.md`) is fast, and needs a
key in an environment variable. Ask the person which they want; offer a cloud voice when a long script would take the
local one many minutes, or when a key for one is already set. Pick once per project, in `flow-reel.json`, and keep
it: changing the voice, model, speaker or language re-speaks every comment.

- Match the language to the comments' language. A French reel: `--language french`, comments in French (a cloud
  voice detects the language from the text).
- Ryan is the local default. Speakers differ in how natural they sound in each language: before a long reel, compose a
  one-comment script with two speakers and listen to both.

## Rewriting after a compose

Every unchanged comment reuses its clip from the previous reel, so editing one line re-speaks only that line. Read
`transcript.json`: each step's `startMs` and `endMs` show how long it took. A step much longer than its actions
means the comment is too long for what's on screen.
