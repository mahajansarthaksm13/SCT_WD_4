import { expect, test } from "@playwright/test";

/**
 * The claim on the tin is "keeps your data on your own device". A service
 * worker is what makes that true of the app as well as the tasks, and the only
 * honest way to test one is to pull the network out and reload.
 *
 * Chromium only. Playwright drives service workers properly there; on WebKit
 * and Firefox the support is partial enough that a red run would say more about
 * the harness than about Tally.
 */
test.describe("offline", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "service worker interception is only reliable under Playwright on Chromium",
  );

  test("the app opens with the network switched off", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);

    // The first load fetched its chunks before the worker was in charge. This
    // reload is the one that fills the cache.
    await page.reload();
    await expect(page.getByPlaceholder("Add a task")).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByPlaceholder("Add a task")).toBeVisible();

    // Not just a shell: the stored tasks have to come back too.
    await expect(page.getByRole("navigation", { name: "Lists" })).toBeVisible();

    await context.setOffline(false);
  });

  test("a task captured offline is still there once the network returns", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();

    await context.setOffline(true);
    await page.getByPlaceholder("Add a task").fill("Written on a plane");
    await page.getByPlaceholder("Add a task").press("Enter");
    await expect(page.getByText("Written on a plane")).toBeVisible();

    await context.setOffline(false);
    await page.reload();
    await expect(page.getByText("Written on a plane")).toBeVisible();
  });
});
