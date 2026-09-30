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

        await expect(page.getByRole("heading", { name: "Shifts", exact: true })).toBeVisible();
        const nav = page.getByRole("navigation");
        await expect(nav.getByRole("link", { name: /^Schedule/ })).toBeVisible();
        await expect(nav.getByRole("link", { name: "Shifts", exact: true })).toBeVisible();
        await expect(nav.getByRole("link", { name: "Roster", exact: true })).toBeVisible();
        await expect(nav.getByRole("link", { name: "Reports", exact: true })).toBeVisible();
    });

    test("Schedule opens the day-first Scheduler", async ({ page }) => {
        await signIn(page);

        await page.getByRole("navigation").getByRole("link", { name: /^Schedule/ }).click();

        await expect(page).toHaveURL(/\/schedule/);
        await expect(page.getByTestId("week-strip")).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId("day-panel")).toBeVisible();
        await expect(page.getByTestId("add-shift")).toBeVisible();
    });

    test("roster page loads with workforce actions", async ({ page }) => {
        await signIn(page);

        await page.getByRole("link", { name: /roster/i }).click();

        await expect(page).toHaveURL(/.*\/rosters.*/);
        await expect(page.getByRole("heading", { name: "Roster" })).toBeVisible();
        await expect(page.getByRole("button", { name: /add worker/i })).toBeVisible();
    });
});
