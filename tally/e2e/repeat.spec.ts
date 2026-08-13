import { expect, test, type Page } from "./fixtures";

/**
 * Repeating tasks, and the split layout that holds the record of them.
 *
 * The arithmetic is covered by unit tests; what only a real browser can answer
 * is whether the radio group commits, whether ticking a repeating row actually
 * leaves two rows behind, and whether the second column appears at 1280px and
 * gets out of the way below it.
 */

const capture = (page: Page) => page.getByPlaceholder("Add a task");

/**
 * The radio itself is `sr-only` — a real input for assistive tech and the
 * keyboard, with the visible row being its label. A pointer user clicks the
 * label, so that is what this clicks; Playwright's `check()` refuses to click
 * an input it considers covered, which is exactly what a label is.
 */
const repeatOption = (page: Page, value: string) =>
  page.locator(`label:has(input[value="${value}"])`);

const row = (page: Page, title: string) =>
  page.getByRole("main").getByRole("listitem").filter({ hasText: title }).first();

/** Every row carrying this title — open and completed alike. */
const rowsTitled = (page: Page, title: string) =>
  page.getByRole("main").getByRole("listitem").filter({ hasText: title });

/**
 * Opens the completed disclosure if this viewport has one rather than a column.
 *
 * Waits for whichever of the two arrives first. A completed row takes 400ms to
 * settle before it moves, so checking for the disclosure the instant after the
 * click finds nothing and silently does nothing — which then fails as a
 * missing row rather than as the race it is.
 */
async function revealCompleted(page: Page) {
  const toggle = page.getByRole("button", { name: /completed/i });
  const heading = page.getByRole("heading", { name: /completed/i });

  await expect(toggle.or(heading).first()).toBeVisible({ timeout: 5_000 });
  if (await toggle.isVisible()) await toggle.click();
}

/**
 * Captures a task, then gives it today's date and a repeat from its own row.
 *
 * The capture happens first and is waited on, which doubles as the hydration
 * gate: until the row appears, React has not attached a handler to anything
 * and a click on the date button lands on inert markup. That failure only
 * appears when the machine is busy, which is exactly when it is hardest to
 * read.
 */
async function addRepeating(page: Page, title: string, repeat: string) {
  await capture(page).click();
  await capture(page).fill(title);
  await capture(page).press("Enter");
  await expect(page.getByRole("main").getByText(title, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /set a due date/i }).first().click();
  await expect(page.getByRole("button", { name: "Done" })).toBeVisible();

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await repeatOption(page, repeat).click();
  await page.getByRole("button", { name: "Done" }).click();
}

test("a repeat can be set, and shows on the row", async ({ page }) => {
  await page.goto("/");
  await addRepeating(page, "Water the plants", "weekly");

  const row = page.getByRole("main").getByRole("listitem").first();
  await expect(row).toContainText("Water the plants");
  await expect(row).toContainText("Weekly");
});

test("the frequencies are one tab stop, navigated with the arrow keys", async ({
  page,
}) => {
  await page.goto("/");
  await addRepeating(page, "Water the plants", "daily");
  await page.getByRole("button", { name: /set a due date/i }).first().click();

  // A radio group is a single tab stop and moves with the arrows. Five
  // separate buttons would be five stops and no grouping — which is the whole
  // reason this is a fieldset of radios rather than a row of chips.
  await expect(page.getByRole("radio", { name: "Daily", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "Daily", exact: true }).press("ArrowDown");

  await expect(page.getByRole("radio", { name: "Weekly", exact: true })).toBeChecked();
});

test("a repeat cannot be set until there is a date to repeat from", async ({
  page,
}) => {
  await page.goto("/");
  await capture(page).click();
  await capture(page).fill("No date yet");
  await capture(page).press("Enter");
  await expect(page.getByRole("main").getByText("No date yet")).toBeVisible();

  await page.getByRole("button", { name: /set a due date/i }).first().click();

  // The whole group is disabled, not merely styled as though it were.
  await expect(page.getByRole("radio", { name: "Weekly", exact: true })).toBeDisabled();
});

test("clearing the date takes the repeat with it", async ({ page }) => {
  await page.goto("/");
  await addRepeating(page, "Water the plants", "weekly");

  const row = page.getByRole("main").getByRole("listitem").first();
  await expect(row).toContainText("Weekly");

  await page.getByRole("button", { name: /set a due date/i }).first().click();
  await page.getByRole("button", { name: "Clear" }).click();

  // A weekly rule with no date would never fire, and the row would go on
  // claiming it did.
  await expect(row).not.toContainText("Weekly");
});

test("completing a repeating task leaves the record and opens the next one", async ({
  page,
}) => {
  await page.goto("/");
  await addRepeating(page, "Water the plants", "weekly");

  await page.getByRole("main").locator("li label[for]").first().click();

  // Two rows now carry the title: the one just finished, and the next
  // occurrence. Which of the two completed layouts is on screen depends on the
  // viewport, so this opens the fold-down when there is one and leaves the
  // column alone when there is not.
  await revealCompleted(page);
  await expect(
    page.getByRole("main").getByRole("listitem").filter({ hasText: "Water the plants" }),
  ).toHaveCount(2);

  // The next occurrence carries the rule forward, so the series continues.
  const open = page.getByRole("main").getByRole("listitem").first();
  await expect(open).toContainText("Weekly");

  // And it is said out loud, with the date — the one thing a sighted user
  // reads off the row and a screen-reader user would otherwise never learn.
  await expect(page.locator('[aria-live="polite"]')).toContainText("Next one is due");
});

test("unticking after a reload still withdraws the occurrence", async ({ page }) => {
  await page.goto("/");
  await addRepeating(page, "Water the plants", "weekly");
  await row(page, "Water the plants").locator("label[for]").first().click();
  await revealCompleted(page);
  await expect(rowsTitled(page, "Water the plants")).toHaveCount(2);

  // The link lives on the task, not in the tab. This is the case the previous
  // in-memory version could not do: notice the wrong row an hour later.
  await page.reload();
  await revealCompleted(page);
  await expect(rowsTitled(page, "Water the plants")).toHaveCount(2);

  await page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ hasText: "Water the plants" })
    .last()
    .locator("label[for]")
    .first()
    .click();

  await expect(rowsTitled(page, "Water the plants")).toHaveCount(1);

  // And it stays withdrawn, rather than coming back from storage.
  await page.reload();
  await expect(rowsTitled(page, "Water the plants")).toHaveCount(1);
});

test("everything survives a reload, including the repeat", async ({ page }) => {
  await page.goto("/");
  await addRepeating(page, "Rent", "monthly");
  await page.reload();

  await expect(page.getByRole("main").getByRole("listitem").first()).toContainText(
    "Monthly",
  );
});

test("the completed column becomes a fold-down below 1280px", async ({
  page,
  isMobile,
}) => {
  // A phone is never 1280px wide, so there is no column for it to lose. The
  // fold-down it *does* get is covered by the other tests on this project.
  test.skip(!!isMobile, "the split layout does not exist below 1280px");

  await page.goto("/");
  await addRepeating(page, "Water the plants", "weekly");
  await page.getByRole("main").locator("li label[for]").first().click();
  await expect(page.getByRole("heading", { name: /Completed/ })).toBeVisible();

  await page.setViewportSize({ width: 1100, height: 800 });

  // Same page, different structure: a disclosure button, collapsed, with the
  // heading gone rather than both existing and one being hidden.
  const toggle = page.getByRole("button", { name: /Completed/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: /Completed/ })).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("the split never introduces a horizontal scrollbar at 360px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await addRepeating(page, "Water the plants", "weekly");
  await page.getByRole("main").locator("li label[for]").first().click();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
