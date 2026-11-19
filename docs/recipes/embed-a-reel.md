# Embed a reel

A reel's `video.mp4` and `captions.vtt` go straight into a web page, a docs site or a README.

## On a web page

```html
<video controls preload="metadata" style="width:100%">
  <source src="/reels/onboarding/video.mp4" type="video/mp4">
  <track kind="captions" src="/reels/onboarding/captions.vtt" srclang="en" label="English" default>
</video>
```

WebVTT shows comments as literal text, symbols included. Serve the `.vtt` file from the same origin as the page, or
with CORS headers.

## In Sphinx or MkDocs

Copy the two files into the site's static folder and use the same HTML. With MyST Markdown, wrap it in a
`{raw} html` block. That's how the reel on [this site's front page](../index.md) is embedded.

## In a GitHub README or pull request

GitHub plays an MP4 that you drag into the editor of an issue, a pull request or a release. Upload `video.mp4`
there, and paste the link it gives into your README. A reel is a good thing to attach to a pull request that changes
the UI.

## As a social post

`video.mp4` is 1920×1080, 30 fps, with AAC audio normalized to -16 LUFS, which is ready for most platforms. Upload
`captions.srt` along with it where the platform takes captions.

## From the transcript

`transcript.json` has each step's comment and timing on the video's timeline, so a page can build chapters or a
clickable outline from it:

```js
const { steps } = await (await fetch("/reels/onboarding/transcript.json")).json();
for (const step of steps.filter((s) => s.comment)) {
  console.log(`${(step.startMs / 1000).toFixed(1)} s  ${step.comment}`);
}
```
