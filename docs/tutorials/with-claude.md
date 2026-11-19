# Make reels with Claude

The flow-reel **plugin** teaches a coding agent the flow-reel language and the craft of a good reel. With it, Claude
Code (or Codex) takes a request like *"make a demo video of the saved views feature"* and works through the whole
job:

1. **Plans the story:** the audience, the one takeaway, and the scenes, written into a `brief.md`.
2. **Explores your running app** with the browser tool it has, and notes real locators and states for each scene.
3. **Checks what composing needs** (Node, Docker, the flow-reel version, the voice's key, the app's URL) and tells
   you what's missing, without fixing anything silently.
4. **Writes the script:** comments, sounds, effects, cards and overlays.
5. **Composes it**, and reads the composer's errors if it fails.
6. **Reviews the reel:** it verifies the files, pulls a still of every step, and checks framing and payoff against
   the brief.
7. **Hands it over:** the reel, the script, the command to compose it again, and what was and wasn't checked.

The plugin holds no composing logic. flow-reel does the work, and the plugin teaches the agent how to drive it well.

## Install

You need flow-reel's own [requirements](../getting-started/installation.md) (Node 22.18+, Docker or Podman) and a
project with your web app.

::::{tab-set}
:::{tab-item} Claude Code
```text
/plugin marketplace add codeonym-oss/claude-plugins
/plugin install flow-reel@codeonym-oss
```
:::
:::{tab-item} Codex
```text
codex plugin marketplace add codeonym-oss/claude-plugins
codex plugin add flow-reel@codeonym-oss
```
:::
::::

The plugin and the npm package are released separately. Each plugin version states the flow-reel versions it
supports (`>=0.5.0 <0.6.0` today), and its preflight check reports whether your project's version is in that range.
If flow-reel isn't installed yet, Claude offers to run `npm install --save-dev flow-reel@0.5` for you.

## Set up a voice first

Composing speaks every comment, and a cloud voice does that in seconds. **Set its key in your shell before you start
Claude**, so the composer can read it from the environment:

```sh
export OPENAI_API_KEY=...      # or GEMINI_API_KEY, ELEVENLABS_API_KEY, ...
claude
```

:::{important}
Never paste an API key into the conversation. flow-reel reads keys only from environment variables, and the plugin
tells the agent never to ask for one or print one. `flow-reel.json` names the variable (`apiKeyEnv`), never the key.
:::

Without a key, Claude uses the built-in local voice (Qwen3-TTS 0.6B). It works offline, but takes about a minute a
comment on a laptop CPU. Claude says so before composing, and offers a cloud voice instead.

## The three skills

| Skill | Ask for it like this | What it does |
|---|---|---|
| `reel` | "Make a demo video of the saved views feature." | From the request to a finished, reviewed reel. |
| `reshoot` | "The zoom on the chart is rushed, and cut the last line." | Edits only the affected comments, sounds and effects, composes again and compares with the reel before. Nothing edits the video directly. |
| `screening` | "Review the onboarding reel before I share it." | Read-only: verifies the files, pulls stills of every step, checks sounds and comments against the picture, and reports findings with how each was checked. |

Claude picks the skill from what you say. In Claude Code you can also call one by name: `/flow-reel:reel`,
`/flow-reel:reshoot`, `/flow-reel:screening`.

## A session, step by step

Start your app (for example on `http://localhost:4173`), open Claude Code in the project, and ask:

```text
Make a 30-second reel of the saved views feature for our release notes.
The app is running on http://localhost:4173. Use the OpenAI voice.
```

What to expect:

1. **A few questions, only where needed.** For example, who watches it, and whether there is a logo for the brand.
   Claude writes the plan to a `brief.md` next to where the script will go, so you can read and change it.
2. **Exploring.** Claude opens the app in its browser and walks each scene. If the feature needs a login that a
   fresh browser can't replay, it stops and says so (see [Logins and data](#logins-and-data)).
3. **Preflight.** It runs the plugin's `preflight.mjs` and reports each failed check with its fix. For example: "The
   composer image isn't pulled yet. The first compose will download about 7 GB."
4. **The script.** A TypeScript file next to the brief, with one comment per scene. Sounds come after visible results, and
   the camera is directed only where the story needs it.
5. **The compose.** `npx flow-reel compose <script>`.
6. **Screening.** `flow-reel verify`, then a contact sheet of stills from every step, checked against the brief.
   Fixes go back into the script, and only the changed comments are spoken again.
7. **The handoff.** The reel path, the video's length, the command to compose it again, and an honest list of what
   was checked. If nobody has played the video yet, Claude says playback is still pending and asks you to watch it.

Then give feedback in plain words:

```text
The callout on the chart disappears too fast, and say "one click" instead of "a click".
```

The `reshoot` skill changes only those lines, composes again, and runs `flow-reel compare` against the previous reel
so you can see what changed.

## Prompts that work well

```text
Make a reel of the new CSV export, for customers who haven't used it. Under 45 seconds,
with an intro and outro card in our brand (logo in public/logo.svg, accent #D6336C).
```

```text
Make a French version of demos/onboarding/script.ts, with comments translated
and the voice set to French.
```

```text
The deploy step in the reel takes two minutes of nothing. Skip it and show how long was cut.
```

```text
Screen demos/billing.reel and tell me if it's ready to post. Don't change anything.
```

```text
Compare demos/onboarding.reel with the one on main and tell me what changed.
```

## Logins and data

The composer's browser is fresh, with no cookies, no stored session and no login from your own browser. A reel of a
page behind a login needs the script to sign in with a **test account** that's safe to show on screen, or an app
mode that doesn't need one. Claude asks you which it should use. It never uses your real credentials.

Reels film your app's real data. Before composing again, reset anything a previous run created (a saved view, an
uploaded file), or the second reel will differ from the first.

## When it can't do something

The plugin knows exactly which words, options and flags exist for your flow-reel version. Ask for something
flow-reel doesn't have, such as background music, a target length or another voice provider, and Claude says so and
offers what it can do instead. It won't approximate it with tricks that change how your app behaves.

## Without the plugin

Any agent can write flow-reel scripts from these docs. The [Script API](../reference/script-api.md) is the complete
list of words, and the plugin's references
([`plugin/references/`](https://github.com/codeonym-oss/flow-reel/tree/main/plugin/references)) carry the craft:
story, scenes, comments, direction, sound design and shot recipes.
