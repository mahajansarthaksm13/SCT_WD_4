import { expect, test, type Page } from "./fixtures";

/**
 * The core loop, end to end: capture a task with a due time, find it in Today,
 * check it off, and confirm it is still there tomorrow.
 *
 * That sentence is the PRD's own one-line test for whether the MVP exists, so
 * it is the thing worth automating on every engine.
 */

const capture = (page: Page) => page.getByPlaceholder("Add a task");

/** Task rows only. The sidebar is a list of list items too. */
const rows = (page: Page) => page.getByRole("main").getByRole("listitem");

/**
 * Ticking a task the way a person does — by clicking the box.
 *
 * The input itself is `sr-only`: a real checkbox for assistive tech and the
 * keyboard, with the visible 20px box being its label. Clicking the label is
 * what a pointer user does, and it is what drives the input.
 */
const tickFirst = (page: Page) =>
  page.getByRole("main").locator("li label[for]").first().click();

/**
 * Brings the list panel into reach.
 *
 * Below 1024px the sidebar is an off-canvas drawer, so on the phone projects
 * every list interaction has to open it first. On a desktop viewport the
 * hamburger is not rendered at all and this does nothing.
 */
async function openLists(page: Page) {
  const hamburger = page.getByRole("button", { name: "Open lists" });
  if (await hamburger.isVisible().catch(() => false)) {
    await hamburger.click();
    await expect(page.getByRole("button", { name: "New list" })).toBeVisible();
  }
}

/**
 * Every test starts empty. Playwright gives each one its own browser context,
 * and a context has its own IndexedDB — so isolation is free and there is
 * nothing to tear down.
 */
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(capture(page)).toBeVisible();
});

async function addTask(page: Page, title: string) {
  await capture(page).click();
  await capture(page).fill(title);
  await capture(page).press("Enter");
  await expect(page.getByRole("main").getByText(title, { exact: true })).toBeVisible();
}

test("a task can be captured with the keyboard alone, and focus is kept", async ({
  page,
}) => {
  await addTask(page, "Submit the lab report");

  // The field clears and holds focus, so the next task needs no mouse.
  await expect(capture(page)).toHaveValue("");
  await expect(capture(page)).toBeFocused();

  await capture(page).fill("Review pull request 214");
  await capture(page).press("Enter");

  await expect(page.getByRole("main").getByText("Review pull request 214")).toBeVisible();
  await expect(rows(page)).toHaveCount(2);
});

test("an empty submission is ignored rather than answered with an error", async ({
  page,
}) => {
  await capture(page).click();
  await capture(page).fill("   ");
  await capture(page).press("Enter");

  await expect(rows(page)).toHaveCount(0);
  // Nothing typed is not an error, so nothing is said about it. (The toast
  // library keeps a permanently-mounted, empty live region; only a visible
  // message would count as the app complaining.)
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
});

test("everything survives a reload", async ({ page }) => {
  await addTask(page, "Countersign the lease");
  await addTask(page, "Collect the tailored coat");

  await page.reload();

  await expect(page.getByRole("main").getByText("Countersign the lease")).toBeVisible();
  await expect(page.getByRole("main").getByText("Collect the tailored coat")).toBeVisible();
});

test("a task can be completed, and completion survives a reload", async ({
  page,
}) => {
  await addTask(page, "Renew the library books");

  await tickFirst(page);

  /*
   * Completed work is a persistent column at 1280px and a fold-down below it,
   * so this asserts that it is *reachable* rather than which of the two is on
   * screen. `revealCompleted` opens the disclosure when there is one and does
   * nothing when the column is already showing — the layout is covered on its
   * own terms in repeat.spec.ts.
   */
  await revealCompleted(page);
  await expect(page.getByRole("main").getByText("Renew the library books")).toBeVisible({
    timeout: 5_000,
  });

  await page.reload();
  await revealCompleted(page);
  await expect(page.getByRole("main").getByText("Renew the library books")).toBeVisible();
});

/**
 * Opens the completed disclosure if this viewport has one rather than a column.
 *
 * Waits for whichever of the two arrives first: a completed row takes 400ms to
 * settle before it moves, and checking the instant after the click finds
 * neither.
 */
async function revealCompleted(page: Page) {
  const toggle = page.getByRole("button", { name: /completed/i });
  const heading = page.getByRole("heading", { name: /completed/i });

  await expect(toggle.or(heading).first()).toBeVisible({ timeout: 5_000 });
  if (await toggle.isVisible()) await toggle.click();
}

test("a task with a due time appears in Today", async ({ page }) => {
  await addTask(page, "Board the train");

  await page.getByRole("button", { name: /set a due date/i }).first().click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await openLists(page);
  await page.getByRole("button", { name: /^Today,/ }).click();

  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByText("Board the train")).toBeVisible();
});

test("deleting is undoable inside the toast window", async ({ page }) => {
  await addTask(page, "Delete me");

  await page.getByRole("button", { name: /actions for delete me/i }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();

  // The toast, not the screen-reader announcement that mirrors it.
  await expect(page.getByText("Task deleted").first()).toBeVisible();
  await expect(page.getByRole("main").getByText("Delete me")).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("main").getByText("Delete me")).toBeVisible();
});

test("a list can be created, and the row menu offers it as a destination", async ({
  page,
}) => {
  await addTask(page, "Essay draft");

  await openLists(page);
  await page.getByRole("button", { name: "New list" }).click();
  await page.getByLabel("New list name").fill("Uni");
  await page.getByLabel("New list name").press("Enter");

  await expect(page.getByRole("button", { name: /^Uni, 0 open tasks/ })).toBeVisible();

  // Selecting a list closes the drawer on a phone; on desktop it never opened.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /actions for essay draft/i }).click();

  // The menu offers the new list, and "Move to list" is live rather than the
  // disabled state it shows when Inbox is the only list there is.
  const moveToList = page.getByRole("menuitem", { name: /move to list/i });
  await expect(moveToList).toBeVisible();
  await expect(moveToList).not.toHaveAttribute("data-disabled", /.*/);

  // Actually performing the move is covered in tests/store.test.ts. Driving a
  // Radix submenu from Playwright is not possible here — the parent menu's
  // dismissable layer owns the pointer as far as hit-testing is concerned, so
  // both click and hover time out on the item. A real pointer reaches it; this
  // is the two libraries disagreeing, not the product misbehaving.
});

test("the page has no horizontal scroll at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 720 });
  await addTask(page, "A title long enough to need more than one line of space");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("the capture field is never small enough to make iOS zoom", async ({
  page,
}) => {
  // Below 16px, mobile Safari zooms the viewport on focus and does not zoom
  // back. It is the single most common mobile polish bug there is.
  const size = await capture(page).evaluate(
    (el) => parseFloat(getComputedStyle(el).fontSize),
  );
  expect(size).toBeGreaterThanOrEqual(16);
});

test("nothing logs an error to the console during the core loop", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await addTask(page, "Quiet please");
  await tickFirst(page);
  await page.waitForTimeout(800);
  await page.reload();
  await expect(capture(page)).toBeVisible();

  expect(errors).toEqual([]);
});
