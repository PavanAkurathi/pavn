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

    await page.waitForURL(/.*\/dashboard(\/shifts.*)?$/, { timeout: 30000 });
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

    test("seeded admin reaches the shifts dashboard", async ({ page }) => {
        await signIn(page);

        await expect(page.getByRole("heading", { name: "Shifts" })).toBeVisible();
        await expect(page.getByRole("link", { name: /shifts/i })).toBeVisible();
        await expect(page.getByRole("link", { name: /roster/i })).toBeVisible();
        await expect(page.getByRole("link", { name: /reports/i })).toBeVisible();
        await expect(page.getByRole("link", { name: /availability/i })).toBeVisible();
        await expect(page.getByRole("link", { name: /create a schedule/i })).toBeVisible();
    });

    test("create schedule flow opens", async ({ page }) => {
        await signIn(page);

        await page.getByRole("link", { name: /create a schedule/i }).click();

        await expect(page).toHaveURL(/.*\/dashboard\/schedule\/create.*/);
        await expect(page.locator('[data-testid="dates-trigger"]')).toBeVisible();
    });

    test("roster page loads with workforce actions", async ({ page }) => {
        await signIn(page);

        await page.getByRole("link", { name: /roster/i }).click();

        await expect(page).toHaveURL(/.*\/rosters.*/);
        await expect(page.getByRole("heading", { name: "Roster" })).toBeVisible();
        await expect(page.getByRole("button", { name: /add worker/i })).toBeVisible();
    });
});
