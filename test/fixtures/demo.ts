import { demo } from "flow-reel";

export default demo({ url: "http://localhost:4173" }, async ({ page, step }) => {
  await step("Open the settings page.", () => page.getByRole("link", { name: "Settings" }).click());
  await step("Turn on dark mode.", () => page.getByLabel("Dark mode").check());
});
