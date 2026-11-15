// A starter script. Every locator, URL and line below is a placeholder: replace each with what you observed in the
// app (references/exploring.md). The words and options are in references/language.md.
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173/" }, async ({ page, comment, sound }) => {
  // Opening: say what we're about to do, over the starting state.
  comment("REPLACE: one line on what this reel shows.");

  // The change: one comment per scene, then its actions.
  await page.getByRole("button", { name: "REPLACE: the control" })
    .comment("REPLACE: why this step matters.")
    .sound(Sounds.navigation.OPEN)
    .click();

  // The payoff: wait for the visible result, then mark it.
  await page.getByText("REPLACE: the result the viewer should see").waitFor();
  sound(Sounds.feedback.SUCCESS);
});
