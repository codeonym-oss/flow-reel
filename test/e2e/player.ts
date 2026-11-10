// Executed in the recording image, where Chromium and Playwright are already installed.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route("http://player.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") {
      await route.fulfill({ contentType: "text/html", body: `<style>body{margin:0;background:#111}</style>
        <video controls width="1280" height="720">
          <track default kind="captions" srclang="en" label="Narration" src="/demo.vtt">
        </video><script>
          // A Blob makes the fixture seekable without emulating HTTP range responses in the route handler.
          fetch('/demo.mp4').then(r => r.blob()).then(blob => {
            document.querySelector('video').src = URL.createObjectURL(blob);
          });
        </script>` });
    } else {
      await route.fulfill({ contentType: path.endsWith(".vtt") ? "text/vtt" : "video/mp4",
        body: readFileSync(`/work${path}`) });
    }
  });
  await page.goto("http://player.test/");
  await page.waitForFunction(() => document.querySelector("video")!.readyState >= 2
    && document.querySelector("track")!.readyState === 2);
  const cues = await page.evaluate(() => Array.from(document.querySelector("video")!.textTracks[0].cues!, (cue) => {
    const vtt = cue as VTTCue;
    return { startMs: Math.round(vtt.startTime * 1000), endMs: Math.round(vtt.endTime * 1000),
      text: vtt.getCueAsHTML().textContent };
  }));
  await page.evaluate(async () => {
    const video = document.querySelector("video")!;
    const cue = video.textTracks[0].cues![0];
    await new Promise<void>((resolve) => {
      video.addEventListener("seeked", () => resolve(), { once: true });
      video.currentTime = (cue.startTime + cue.endTime) / 2;
    });
    await video.play();
    await new Promise((resolve) => setTimeout(resolve, 100));
    video.pause();
  });
  const active = await page.evaluate(() => Array.from(document.querySelector("video")!.textTracks[0].activeCues!,
    (cue) => (cue as VTTCue).getCueAsHTML().textContent));
  await page.screenshot({ path: "/work/captions.png" });
  console.log(JSON.stringify({ cues, active }));
} finally {
  await browser.close();
}
