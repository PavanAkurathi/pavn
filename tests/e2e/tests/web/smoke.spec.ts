import { test, expect, type Page } from "@playwright/test";

const TEST_ADMIN = {
    email: "admin@test.workershive.com",
    password: "TestPassword123!",
};

async function signIn(page: Page) {
    await page.goto("/auth/login");
    await page.fill('input[name="email"]', TEST_ADMIN.email);
    await page.fill('input[name="password"]', TEST_ADMIN.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL(/.*\/(schedule|dashboard(\/shifts.*)?)(\?.*)?$/, { timeout: 30000 });
    await expect(page.locator('[data-testid="org-name"]')).toHaveText(/test organization/i, {
        timeout: 30000,
    });
}

test.setTimeout(60000);

test.describe("Manager web smoke", () => {
    test("login page loads", async ({ page }) => {
        await page.goto("/auth/login");

        await expect(page.getByRole("heading", { name: /welcome back|sign in|log in/i })).toBeVisible();
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
    });

    test("signup page loads", async ({ page }) => {
        await page.goto("/auth/signup");

        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
    });

    test("seeded admin lands on the Schedule", async ({ page }) => {
        await signIn(page);

        await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toBeVisible();
        const nav = page.getByRole("navigation");
        await expect(nav.getByRole("link", { name: /^Schedule/ })).toBeVisible();
        await expect(nav.getByRole("link", { name: "Timesheets", exact: true })).toBeVisible();
        await expect(nav.getByRole("link", { name: "Team", exact: true })).toBeVisible();
        await expect(nav.getByRole("link", { name: "Reports", exact: true })).toBeVisible();
    });

    test("Schedule opens the workspace", async ({ page }) => {
        await signIn(page);

        await page.getByRole("navigation").getByRole("link", { name: /^Schedule/ }).click();

        await expect(page).toHaveURL(/\/schedule/);
        await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toBeVisible({ timeout: 30000 });
        await expect(page.getByRole("button", { name: "Shifts", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Team week" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Add shift" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Review & publish" })).toBeVisible();
    });

    test("team page loads with workforce actions", async ({ page }) => {
        await signIn(page);

        await page.getByRole("navigation").getByRole("link", { name: "Team", exact: true }).click();

        await expect(page).toHaveURL(/.*\/workers.*/);
        await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: /add worker/i })).toBeVisible();
    });
});
