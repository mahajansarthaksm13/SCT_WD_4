import { expect, test, type Page } from "@playwright/test";
import { TUTORIAL_STEPS } from "../src/features/tutorial/steps";

/**
 * The guided tour.
 *
 * The raw Playwright `test` on purpose, not `./fixtures` — the fixture exists
 * to mark the tour seen before every other test, and the whole question here is
 * what happens when it has not been.
 */

const card = (page: Page) => page.locator('[data-tour-overlay] [role="dialog"]');

test("it offers itself once on a first visit, and not again", async ({ page }) => {
  await page.goto("/");
  await expect(card(page)).toBeVisible();
  await expect(page.locator("#tour-title")).toHaveText(TUTORIAL_STEPS[0]!.title);

  await card(page).getByRole("button", { name: "Skip" }).click();
  await expect(card(page)).toHaveCount(0);

  await page.reload();
  await expect(page.getByPlaceholder("Add a task")).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});

test("every step lands on screen, spotlight and all", async ({ page }) => {
  await page.goto("/");
  await expect(card(page)).toBeVisible();

  for (const [index, step] of TUTORIAL_STEPS.entries()) {
    await expect(page.locator("#tour-title")).toHaveText(step.title);

    /*
     * The check that matters. A tour whose card has run off the bottom of the
     * screen is worse than no tour at all, and it only happens on the steps
     * with the longest body text against the tallest targets — which is
     * exactly the combination nobody clicks through by hand.
     */
    const box = await card(page).boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.y).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);

    /*
     * Advanced with the arrow key rather than by clicking Next.
     *
     * The click has to wait for the card to hold still, and the card is
     * repositioning itself for the step it has just moved to — so on a loaded
     * machine the two race and the click times out on a card that is working
     * perfectly. The keyboard path goes through the same `setTutorialStep`,
     * and the clicking path is covered by the tests either side of this one.
     */
    if (index < TUTORIAL_STEPS.length - 1) await page.keyboard.press("ArrowRight");
  }

  await card(page).getByRole("button", { name: "Done" }).click();
  await expect(card(page)).toHaveCount(0);
});

test("it can be driven, and dismissed, from the keyboard alone", async ({ page }) => {
  await page.goto("/");
  await expect(card(page)).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#tour-title")).toHaveText(TUTORIAL_STEPS[1]!.title);

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#tour-title")).toHaveText(TUTORIAL_STEPS[0]!.title);

  // Back on the first step there is nowhere further to go, and the step
  // number must not run off the front of the list.
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#tour-title")).toHaveText(TUTORIAL_STEPS[0]!.title);

  await page.keyboard.press("Escape");
  await expect(card(page)).toHaveCount(0);
});

test("it can be asked for again afterwards", async ({ page }) => {
  await page.goto("/");
  await card(page).getByRole("button", { name: "Skip" }).click();
  await expect(card(page)).toHaveCount(0);

  const hamburger = page.getByRole("button", { name: "Open lists" });
  if (await hamburger.isVisible().catch(() => false)) await hamburger.click();

  await page.getByRole("button", { name: "Take the guided tour" }).click();
  await expect(card(page)).toBeVisible();
  await expect(page.locator("#tour-title")).toHaveText(TUTORIAL_STEPS[0]!.title);
});

test("someone who already has tasks is not shown it", async ({ page }) => {
  await page.goto("/");
  await card(page).getByRole("button", { name: "Skip" }).click();

  const capture = page.getByPlaceholder("Add a task");
  await capture.click();
  await capture.fill("Already using this");
  await capture.press("Enter");
  await expect(page.getByRole("main").getByText("Already using this")).toBeVisible();

  // Clear the "seen" flag but keep the tasks: the tour is for empty databases,
  // and an import or a second device is not a first-time user.
  await page.evaluate(() => localStorage.removeItem("tally-tour-seen"));
  await page.reload();
  await expect(page.getByRole("main").getByText("Already using this")).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});
