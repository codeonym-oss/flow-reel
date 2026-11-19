// The docs' showcase reel: Orbit's saved views, with cards, overlays, effects and sounds.
// Serve the app first: `node plugin/examples/saved-views/serve.mjs`, then `npx flow-reel compose docs/demos/orbit-tour/script.ts`.
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173/" }, async ({ page, comment, sound, card, lowerThird }) => {
  comment("Orbit 2.4 brings saved views: your filters, one click away.");
  await card.intro({ kicker: "Orbit 2.4", title: "Saved views", subtitle: "Your filters, one click away" });

  await card.chapter({ title: "Filter the projects" });
  comment("Here are this quarter's projects. Let's keep the active ones.");
  await lowerThird({ title: "Projects", subtitle: "Every project this quarter" });
  await page.getByRole("button", { name: "Active" }).sound(Sounds.controls.TOGGLE).click();

  comment("The chart follows the filter: active work is picking up every week.");
  await page.getByRole("region", { name: "Tasks closed per week" })
    .callout("The chart follows the filter", { detail: "Active projects only" });

  await card.chapter({ title: "Save the view" });
  await page.getByRole("button", { name: "Save view" })
    .comment("To come back to it later, save it as a view.")
    .sound(Sounds.navigation.OPEN)
    .click();
  await page.getByLabel("View name").fill("Active work");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "saved" }).waitFor();
  sound(Sounds.feedback.SUCCESS);

  await page.getByRole("navigation", { name: "Saved views" }).getByRole("link", { name: "Active work" })
    .comment("It's in the sidebar now, one click away.")
    .highlight();

  await card.outro({ title: "Try saved views", url: "orbit.dev/views", links: ["Docs", "Changelog"] });
});
