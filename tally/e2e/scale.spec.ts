import { expect, test } from "@playwright/test";

/**
 * The PRD's stated worst case: five thousand tasks must not freeze the list.
 *
 * Measured rather than assumed. Rendering all five thousand took about ten
 * seconds and made typing lag by half a second — the cost being React
 * reconciling five thousand components, not the browser laying them out, which
 * is why `content-visibility` did not help (and dropped every offscreen row
 * out of the accessibility tree besides). Capping the first page fixed it.
 */
test("five thousand tasks stay responsive", async ({ page }, testInfo) => {
  // One engine is enough. What is being measured is React reconciling five
  // thousand components, which is not an engine-specific characteristic — and
  // seeding that many rows through WebKit's IndexedDB takes minutes on its own.
  test.skip(
    testInfo.project.name !== "chromium",
    "performance characteristic, measured on one engine",
  );
  test.setTimeout(180_000);

  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));

  await page.goto("/");
  // The Inbox is created on first load; seeding before it exists has nothing
  // to attach the tasks to.
  await expect(page.getByRole("button", { name: /^Inbox,/ })).toBeVisible();

  // Seeded straight into IndexedDB — typing five thousand tasks is not the
  // thing under test, and the repository is covered by the unit suite.
  await page.evaluate(async () => {
    const inboxId = await new Promise<string>((resolve, reject) => {
      const open = indexedDB.open("tally");
      open.onsuccess = () => {
        const tx = open.result.transaction(["lists"], "readonly");
        const all = tx.objectStore("lists").getAll();
        all.onsuccess = () => {
          const inbox = (all.result as { id: string; isDefault: boolean }[]).find(
            (l) => l.isDefault,
          );
          if (inbox) resolve(inbox.id);
          else reject(new Error("no inbox"));
        };
      };
      open.onerror = () => reject(open.error);
    });

    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("tally");
      open.onsuccess = () => {
        const tx = open.result.transaction(["tasks"], "readwrite");
        const store = tx.objectStore("tasks");
        const now = new Date().toISOString();
        for (let i = 0; i < 5000; i++) {
          store.put({
            id: `bulk-${i}`,
            listId: inboxId,
            title: `Bulk task number ${i}`,
            notes: null,
            dueAt: null,
            hasTime: false,
            priority: "none",
            isComplete: false,
            position: (i + 1) * 1000,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  });

  const started = Date.now();
  await page.reload();
  await expect(page.getByRole("main").getByText("Bulk task number 0")).toBeVisible({
    timeout: 60_000,
  });
  const loadMs = Date.now() - started;

  // A capped first page, with the rest one click away and the count honest.
  const rendered = await page.getByRole("main").getByRole("listitem").count();
  expect(rendered).toBe(200);
  await expect(page.getByText("Showing 200 of 5000.")).toBeVisible();

  // Rows stay real list items. A windowed list is exactly what would cost us
  // this, and with it find-in-page and the screen-reader item count.
  expect(
    await page.evaluate(() => document.querySelectorAll("main ul > li").length),
  ).toBe(200);

  // Typing has to stay usable with the list on screen. This is the number
  // that decided whether any of the above was necessary.
  const typingStarted = Date.now();
  await page.getByPlaceholder("Add a task").fill("Still responsive?");
  const typingMs = Date.now() - typingStarted;

  await page.getByRole("button", { name: "Show 200 more" }).click();
  await expect(page.getByText("Showing 400 of 5000.")).toBeVisible();

  console.log(`SCALE load=${loadMs}ms typing=${typingMs}ms rows=${rendered}`);
  expect(loadMs).toBeLessThan(5_000);
  expect(typingMs).toBeLessThan(1_000);
  expect(problems).toEqual([]);
});
