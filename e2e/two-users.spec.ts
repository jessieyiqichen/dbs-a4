import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

/** Step 7: two people sign in, each saves a goal, and neither can see the other's. Real browser, real Clerk, real
 *  Supabase: this checks the row-level security that keeps each person to their own rows, from the outside. */

const A = "yiqi+clerk_test_a@example.com";
const B = "yiqi+clerk_test_b@example.com";

/** A browser of its own (no shared cookies), signed in with the test email's code. */
async function signedIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/sign-in");
  await clerk.signIn({ page, signInParams: { strategy: "email_code", identifier: email } });
  return page;
}

/** Adds a goal through the app, the way a person would, and returns the address of its page. */
async function addGoal(page: Page, title: string): Promise<string> {
  await page.goto("/goals/new");
  await page.getByText("Something else", { exact: true }).click();
  await page.getByLabel("What will you do?").fill(title);
  // The goal shows at once and is saved in the background: wait for Supabase to confirm before leaving the page,
  // or the reload below would cut the save short
  const saved = savedTo(page, "goals", "POST");
  await page.getByRole("button", { name: "Start the first one" }).click();
  await saved;
  await page.waitForURL("**/session");
  await page.goto("/goals");
  const link = page.getByRole("link", { name: new RegExp(title) });
  await expect(link).toBeVisible();
  return (await link.getAttribute("href")) as string;
}

async function removeGoal(page: Page, href: string) {
  await page.goto(href);
  const removed = savedTo(page, "goals", "DELETE");
  await page.getByRole("button", { name: "Remove goal" }).click();
  await removed;
}

/** Removes goals an earlier run left behind (a run that failed halfway), so every run starts clean. */
async function removeLeftovers(page: Page) {
  await page.goto("/goals");
  await expect(page.getByRole("heading", { name: "Your goals" })).toBeVisible();
  await expect(page.getByText("Loading your goals…")).toHaveCount(0);
  const links = page.getByRole("link", { name: /e2e-[ab]-\d+/ });
  const hrefs = await Promise.all((await links.all()).map((l) => l.getAttribute("href")));
  for (const href of hrefs) if (href) await removeGoal(page, href);
}

/** Resolves once Supabase has answered a write to this table with success. */
function savedTo(page: Page, table: string, method: string) {
  return page.waitForResponse(
    (r) => r.url().includes(`/rest/v1/${table}`) && r.request().method() === method && r.ok(),
  );
}

test("two people each see only their own goals", async ({ browser }) => {
  const run = Date.now();
  const titleA = `Practice e2e-a-${run}`;
  const titleB = `Practice e2e-b-${run}`;
  const pageA = await signedIn(browser, A);
  const pageB = await signedIn(browser, B);
  await removeLeftovers(pageA);
  await removeLeftovers(pageB);

  try {
    const hrefA = await addGoal(pageA, titleA);
    await addGoal(pageB, titleB);

    // Each Goals page, loaded fresh from the database
    await pageA.goto("/goals");
    await expect(pageA.getByText(titleA).first()).toBeVisible();
    await expect(pageA.getByText(titleB), "A must not see B's goal").toHaveCount(0);

    await pageB.goto("/goals");
    await expect(pageB.getByText(titleB).first()).toBeVisible();
    await expect(pageB.getByText(titleA), "B must not see A's goal").toHaveCount(0);

    // Even with the link to A's goal, B gets nothing: once B's own goals have loaded, A's is nowhere on the page
    await pageB.goto(hrefA);
    await expect(pageB.getByText(titleB).first()).toBeVisible();
    await expect(pageB.getByText(titleA), "B must not see A's goal, even from its link").toHaveCount(0);
  } finally {
    // Whatever happened above, each person's test goals are removed (a goal that was never added is simply not there)
    await removeLeftovers(pageA);
    await removeLeftovers(pageB);
  }
});
