# GH-28: implementation plan

Planned 2026-11-14 against `main` @ `2803c0d`. A documentation-only ticket: pull request type `docs:`, branch
`docs/28-declare-language-in-context`, no release.

## Settled before this pass

Story decisions 001–009 (009 is the vocabulary). GH-1 decisions 002, 005 and 012 still hold.

## Read first

- `planning/GH-27-one-language-composer-cassettes/decisions/009-vocabulary.md`: the eleven terms.
- Story decisions 003, 004, 005, 007: the supporting terms they introduce.
- `AGENTS.md` (line 1 is the only project-specific line; the rest is the imported coding guidelines).
- `README.md` lines 1–8 (introduction) and the "Requirements" heading at line 10.
- No `CONTEXT.md`, glossary or vocabulary file exists; nothing links to one.

## Assumptions (say so if either is wrong)

1. **`CONTEXT.md` states the 0.2 language only.** One note at the top says the code and README still use the 0.1
   names until GH-29 and GH-30 land. No per-term "current code name" column, which every later ticket would have to
   maintain.
2. **Supporting terms are included** beside the eleven of decision 009, because the story's own decisions use them:
   recording (the raw screen capture), captions, event log, polish (the automatic picture treatment), port,
   cassette store, cassette cache, manifest. Internal words (master, bus, fit, hold) stay out; they are
   implementation detail.

## Steps

1. Write `CONTEXT.md` at the repository root:
   - a two-sentence statement of what flow-reel is, in the vocabulary;
   - **The language:** one entry per term (the eleven of decision 009, then the supporting terms), each with one
     meaning and its "avoid" words;
   - **How the terms relate:** a short list (a script has steps; a step carries comments, sounds and effects; the
     composer composes a script into a cassette through an integration and a voice; a cassette holds the video,
     transcript, captions, event log, audio and manifest);
   - **An example sentence or two** using the terms the way a contributor should;
   - the note of assumption 1.
   → check: every term of decision 009 appears as an entry exactly once (`grep -c` per term heading); no entry
   defines a term with one of its own "avoid" words.
2. Add one line to `AGENTS.md`, directly under line 1: read `CONTEXT.md` and use its terms in code, docs and
   commit messages.
   → check: `git diff AGENTS.md` shows one added line and nothing else.
3. Add one sentence to the README introduction linking to `CONTEXT.md` as the project's vocabulary.
   → check: `git diff README.md` shows that sentence only; the link resolves (`test -f CONTEXT.md`).
4. Confirm nothing shipped changed.
   → check: `git diff --stat origin/main` lists only `CONTEXT.md`, `AGENTS.md`, `README.md` and `planning/`;
   `npm run pack:check` still passes (the README is in the package).

## Tests

No automated test is added: the ticket changes no behaviour. The checks above are run by hand and their output
goes in the pull request.

## Risks

- **The README ships in the npm package,** so the added sentence reaches users at the next release. It is one
  link; `pack:check` in step 4 covers it.
- **Vocabulary drift:** later tickets may need a term this file lacks. The story rule says a ticket adds the term
  here first, so this file is expected to change.
