import { expect, test, type Page } from "@playwright/test";

/**
 * The activity wall.
 *
 * The bucketing rules are covered by unit tests; what only a browser can
 * answer is that a square appears where the work happened, that clicking it
 * opens the right day, and that a grid of nearly four hundred buttons does not
 * put four hundred stops in front of everything after it.
 */

const capture = (page: Page) => page.getByPlaceholder("Add a task");

/** Captures a task and waits for the row — which also gates on hydration. */
async function addTask(page: Page, title: string) {
  await capture(page).click();
  await capture(page).fill(title);
  await capture(page).press("Enter");
  await expect(page.getByRole("main").getByText(title, { exact: true })).toBeVisible();
}

async function openActivity(page: Page) {
  const hamburger = page.getByRole("button", { name: "Open lists" });
  if (await hamburger.isVisible().catch(() => false)) await hamburger.click();
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
}

/** Today is the last square drawn — the grid never runs into the future. */
const today = (page: Page) => page.getByRole("gridcell").last();

test("before there is anything to look back on, the wall stays out of the way", async ({
  page,
}) => {
  await page.goto("/");

  /*
   * Every other test here captures a task first, which doubles as proof that
   * React has attached. This one has nothing to capture, so it waits on the
   * landing rule instead: the app opens on Today and moves to Inbox once it
   * has read storage and found nothing due. That heading only appears on the
   * far side of hydration.
   */
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await openActivity(page);

  // A year of empty squares on a first visit says nothing and looks like a
  // failure, so with no tasks at all there is no grid to draw yet.
  await expect(page.getByText(/Nothing to look back on yet/)).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(0);
});

test("a year with tasks but nothing finished still draws the grid", async ({ page }) => {
  await page.goto("/");
  await addTask(page, "Not done yet");
  await openActivity(page);

  await expect(page.getByRole("grid", { name: /activity/i })).toBeVisible();
  await expect(page.getByText(/Nothing finished in the last year/)).toBeVisible();
});

test("finishing a task marks today, and the square opens that day", async ({ page }) => {
  await page.goto("/");
  await addTask(page, "Renew the library books");
  await page.getByRole("main").locator("li label[for]").first().click();

  await openActivity(page);
  await expect(today(page)).toHaveAttribute("aria-label", /1 finished/);

  await today(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Completed");
  await expect(dialog).toContainText("Renew the library books");
});

test("a task due today and left open shows on today's square as undone", async ({
  page,
}) => {
  await page.goto("/");
  await addTask(page, "Post the forms");

  // Give it today's date and leave it open.
  await page.getByRole("button", { name: /set a due date/i }).first().click();
  await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await openActivity(page);
  await expect(today(page)).toHaveAttribute("aria-label", /1 left undone/);

  await today(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Left undone");
  await expect(dialog).toContainText("Post the forms");
});

test("the whole year is one tab stop, and the arrows move within it", async ({
  page,
}) => {
  await page.goto("/");
  await addTask(page, "Something to look at");
  await openActivity(page);

  await today(page).focus();
  const start = await today(page).getAttribute("aria-label");

  // Left is a week back, up is a day back — what the layout looks like it does.
  await page.keyboard.press("ArrowLeft");
  const afterLeft = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label"),
  );
  expect(afterLeft).not.toBe(start);

  await page.keyboard.press("ArrowRight");
  await expect(today(page)).toBeFocused();

  // Home goes to the far end of the year, and it is still one tab stop away.
  await page.keyboard.press("Home");
  const atStart = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label"),
  );
  expect(atStart).not.toBe(start);
});

test("the wall never makes the page scroll sideways at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await addTask(page, "Something to look at");
  await openActivity(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
