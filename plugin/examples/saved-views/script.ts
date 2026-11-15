// A reel of Orbit's saved views: filter, read the chart, save the view, find it again. See brief.md for the plan.
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173/" }, async ({ page, comment, sound }) => {
  // Opening: the starting state, then the change.
  comment("Here are this quarter's projects. Let's look at the active ones.");
  await page.getByRole("button", { name: "Active" }).sound(Sounds.controls.TOGGLE).click();

  // The payoff of the filter: hold the camera on the chart while the comment explains it.
  await page.getByRole("region", { name: "Tasks closed per week" })
    .comment("The chart follows the filter: active work is picking up every week.")
    .zoomIn()
    .hover();

  // A new scene. The chart stays framed until this click: a zoomOut chained here happens after it, whereas a
  // standalone zoomOut() written before it would happen before the chart's comment had finished.
  await page.getByRole("button", { name: "Save view" })
    .comment("To come back to this view later, save it.")
    .sound(Sounds.navigation.OPEN)
    .zoomOut()
    .click();
  await page.getByLabel("View name").fill("Active work");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // Saving takes a moment: wait for the visible result before marking it.
  await page.getByRole("status").filter({ hasText: "saved" }).waitFor();
  sound(Sounds.feedback.SUCCESS);

  // Closing: the result. Clicking it lets polish frame it for two seconds, through the start of the last comment.
  await page.getByRole("navigation", { name: "Saved views" }).getByRole("link", { name: "Active work" })
    .comment("It's in the sidebar now, one click away.")
    .click();
});
