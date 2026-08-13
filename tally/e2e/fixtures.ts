import { test as base } from "@playwright/test";

export { expect, type Page } from "@playwright/test";

/**
 * The default test context, with the guided tour already dismissed.
 *
 * Every test here starts on a first visit with an empty database, which is
 * exactly when the tour offers itself — so without this it would open over the
 * app and swallow the first click of every single test. Marking it seen before
 * the page loads is the same thing a returning user's browser does.
 *
 * `tutorial.spec.ts` deliberately imports the raw Playwright `test` instead,
 * because the offering is the behaviour it is checking.
 */
export const test = base.extend<{ tourDismissed: void }>({
  tourDismissed: [
    async ({ context }, use) => {
      await context.addInitScript(() => {
        try {
          localStorage.setItem("tally-tour-seen", "1");
        } catch {
          // Storage refused; the tour opens and that test will say so loudly.
        }
      });
      await use();
    },
    { auto: true },
  ],
});
