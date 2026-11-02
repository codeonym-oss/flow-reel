# Teach agents the explore, script, record loop in a Claude Code skill

## Problem

An agent doesn't know that flow-reel exists, nor how to turn a feature it built into a good demo.

## Change

A thin Claude Code plugin skill (decision 005): when to record a demo, how to explore the app with the agent's own
browser tool, how to write `demo.ts` with clear narration per step, how to run `flow-reel record`, and how to check
`transcript.json` and the sync check before handing the video over.

## Out of scope

Plugins for other agents (they can follow the same skill text later); PR delivery.

## Done when

- In a fresh session on a sample app, asking "record a demo of <feature>" leads the agent through the loop to a
  narrated MP4 that passes the sync check.

## For the ticket pass

- Where the plugin is published (codeonym-oss/claude-plugins marketplace).
- Narration style guide: length per step, tone, what to avoid.
