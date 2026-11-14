import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173" }, async ({ page, comment }) => {
  comment("Open the settings page.");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Dark mode")
    .comment("Turn on dark mode.")
    .sound(Sounds.controls.TOGGLE)
    .check();
});
