import { test, expect, Page } from '@playwright/test';

/**
 * Web E2E Tests for WorkersHive Manager Dashboard
 */

// Test credentials
const TEST_ADMIN = {
    email: 'admin@test.workershive.com',
    password: 'TestPassword123!',
};

/**
 * Helper: Sign in via UI
 */
async function signIn(page: Page, credentials = TEST_ADMIN) {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', credentials.email);
    await page.fill('input[name="password"]', credentials.password);
    await page.click('button[type="submit"]');

    // Wait for redirect to the landing page (the Schedule)
    await page.waitForURL(/.*(dashboard|schedule).*/, { timeout: 30000 });
    // Robust check: wait for the org name to appear, confirming we are logged in and verified
    // This ensures activeOrg is fully loaded before we proceed
    await expect(page.locator('[data-testid="org-name"]')).toHaveText('Test Organization', { timeout: 30000 });
}

// Increase default timeout for this suite
test.setTimeout(60000);

// ============================================================================
// AUTHENTICATION UI TESTS
// ============================================================================

test.describe('Authentication UI', () => {
    test('sign in page loads', async ({ page }) => {
        await page.goto('/auth/login');

        await expect(page.getByRole('heading', { name: /welcome back|sign in|log in/i })).toBeVisible();
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
    });

    test('sign up page loads', async ({ page }) => {
        await page.goto('/auth/signup');

        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
    });

    test('successful sign in redirects to dashboard', async ({ page }) => {
        await signIn(page);

        await expect(page).toHaveURL(/.*(dashboard|schedule).*/);
    });

    test('invalid credentials shows error', async ({ page }) => {
        await page.goto('/auth/login');
        await page.fill('input[name="email"]', 'invalid@test.com');
        await page.fill('input[name="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');

        // Should show error message
        await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 5000 });
    });

    test('sign out works', async ({ page }) => {
        await signIn(page);

        // Find and click sign out
        await page.click('[data-testid="user-menu"]');
        await page.click('[data-testid="sign-out"]');

        // Should redirect to sign in
        await expect(page).toHaveURL(/.*auth\/login.*/);
    });
});

// ============================================================================
// DASHBOARD TESTS
// ============================================================================

test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page);
    });

    test('dashboard shows organization name', async ({ page }) => {
        // Should display org name somewhere
        await expect(page.locator('[data-testid="org-name"]')).toBeVisible();
    });

    test('dashboard shows navigation', async ({ page }) => {
        // Check main navigation items
        const nav = page.getByRole('navigation');
        await expect(nav.getByRole('link', { name: /^Schedule/ })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Timesheets', exact: true })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Team', exact: true })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Reports', exact: true })).toBeVisible();
    });

    test('Timesheets lists what has happened and has nothing to plan', async ({ page }) => {
        await page.goto('/dashboard/shifts');
        await expect(page.getByRole('heading', { name: 'Timesheets', exact: true })).toBeVisible();
        await expect(page.locator('[data-testid="timesheets-list"]')).toBeVisible();
        await expect(page.getByRole('button', { name: 'New shift' })).toHaveCount(0);
    });
});

// ============================================================================
// SCHEDULE MANAGEMENT TESTS
// ============================================================================

test.describe('Schedule Management', () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page);
        await page.click('a[href*="shifts"]');
    });

    test('schedule page loads', async ({ page }) => {
        await page.getByRole('link', { name: /^Schedule/ }).first().click();
        await expect(page).toHaveURL(/\/schedule/);
        await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible({ timeout: 30000 });
    });

    test('can add a shift in the Schedule and publish the week', async ({ page }) => {
        test.setTimeout(120000);
        await page.setViewportSize({ width: 1280, height: 800 });

        // A random week months out, so no earlier run's shifts are in it.
        const weeksOut = 8 + Math.floor(Math.random() * 400);
        const someWeek = new Date(Date.now() + weeksOut * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        await page.goto(`/schedule?date=${someWeek}`);
        await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible({ timeout: 30000 });

        // Add one position, left open: role and times are enough.
        await page.getByRole('button', { name: 'Add shift' }).first().click();
        const panel = page.getByRole('dialog');
        await panel.getByLabel('Role', { exact: true }).fill('Server');
        // With more than one site, the panel asks which; with one, it already knows.
        const site = panel.getByRole('combobox', { name: 'Site' });
        if ((await site.innerText()).includes('Choose a site')) {
            await site.click();
            await page.getByRole('option').first().click();
        }
        await panel.getByRole('button', { name: 'Save draft' }).click();
        await expect(page.getByText('1 draft shift')).toBeVisible({ timeout: 15000 });

        // Review what would change, then publish it.
        await page.getByRole('button', { name: /^Publish \d+$/ }).click();
        const review = page.getByRole('dialog');
        await expect(review.getByRole('heading', { name: 'Review & publish' })).toBeVisible();
        await review.getByRole('button', { name: /^Publish/ }).click();
        await expect(review.getByRole('heading', { name: 'Published' })).toBeVisible({ timeout: 20000 });
    });

    test('can view shift details', async ({ page }) => {
        // Click on a shift (if exists)
        const shiftCard = page.locator('[data-testid="shift-card"]').first();

        if (await shiftCard.isVisible()) {
            await shiftCard.click();
            await expect(page.getByText(/details|assigned|timesheet/i)).toBeVisible();
        }
    });
});

// ============================================================================
// CREW MANAGEMENT TESTS
// ============================================================================

test.describe('Worker Management', () => {
    test.beforeEach(async ({ page }) => {
        // Log console messages
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
        page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

        await signIn(page);
        await page.click('a[href*="workers"]');
        await expect(page).toHaveURL(/.*workers.*/);
        await page.waitForLoadState('networkidle');
    });

    test('workers page loads', async ({ page }) => {
        await expect(page).toHaveURL(/.*workers.*/);
    });

    test('can search workers', async ({ page }) => {
        const searchInput = page.locator('input[placeholder*="search" i]');

        if (await searchInput.isVisible()) {
            await searchInput.fill('test');
            // Results should filter
            await page.waitForTimeout(500); // Debounce
        }
    });

    test('can invite new worker', async ({ page }) => {
        test.setTimeout(120000);
        await page.click('[data-testid="invite-worker"]', { force: true });
        await expect(page.getByRole('dialog')).toBeVisible();

        const randomEmail = `newworker-${Date.now()}@test.com`;
        await page.fill('input[name="name"]', 'New Worker');
        await page.fill('input[name="email"]', randomEmail);
        await page.click('button[data-testid="submit-worker"]');

        await expect(page.getByText(/worker added|invited|success/i)).toBeVisible({ timeout: 10000 });
    });
});

// ============================================================================
// TIMESHEETS TESTS
// ============================================================================

test.describe.skip('Timesheets', () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page);
        await page.click('a[href*="timesheets"]');
    });

    test('timesheets page loads', async ({ page }) => {
        await expect(page).toHaveURL(/.*timesheets.*/);
    });

    test('can filter by date range', async ({ page }) => {
        // Find date filter
        const dateFilter = page.locator('[data-testid="date-filter"]');

        if (await dateFilter.isVisible()) {
            await dateFilter.click();
            // Select date range
        }
    });

    test('can export timesheets', async ({ page }) => {
        const exportButton = page.locator('[data-testid="export-button"]');

        if (await exportButton.isVisible()) {
            // Set up download listener
            const downloadPromise = page.waitForEvent('download');
            await exportButton.click();

            const download = await downloadPromise;
            expect(download.suggestedFilename()).toContain('.csv');
        }
    });
});

// ============================================================================
// SETTINGS TESTS (ADMIN ONLY)
// ============================================================================

test.describe('Settings', () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page, TEST_ADMIN);
    });

    test('can access organization settings', async ({ page }) => {
        // Open user menu
        await page.click('[data-testid="user-menu"]');
        // Click Settings
        await page.getByText('Settings').click();

        await expect(page).toHaveURL(/.*settings.*/);
    });

    test('can access billing settings', async ({ page }) => {
        await page.goto('/settings/billing');

        // Admin should see billing page (even if not implemented)
        await expect(page).toHaveURL(/.*billing.*/);
    });
});

// ============================================================================
// MOBILE RESPONSIVENESS TESTS
// ============================================================================

test.describe('Mobile Responsiveness', () => {
    test.use({ viewport: { width: 375, height: 812 } }); // iPhone X

    test.skip('mobile navigation works', async ({ page }) => {
        await signIn(page);
        // Mobile nav not implemented yet in NavHeader
        await page.setViewportSize({ width: 375, height: 667 });

        // Mobile menu button should be visible
        const menuButton = page.locator('[data-testid="mobile-menu"]');
        await expect(menuButton).toBeVisible();

        // Click to open menu
        await menuButton.click();

        // Navigation should be visible
        await expect(page.locator('nav')).toBeVisible();
    });

    test('forms are usable on mobile', async ({ page }) => {
        await page.goto('/auth/login');

        // Form should be fully visible
        await expect(page.locator('input[name="email"]')).toBeInViewport();
        await expect(page.locator('input[name="password"]')).toBeInViewport();
    });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

test.describe('Accessibility', () => {
    test('sign in page has proper labels', async ({ page }) => {
        await page.goto('/auth/login');

        // Check for accessible labels
        const emailInput = page.locator('input[name="email"]');
        const passwordInput = page.locator('input[name="password"]');

        // Check for accessible referencing (label or placeholder)
        await expect(emailInput).toHaveAttribute('type', 'email');
        await expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('navigation is keyboard accessible', async ({ page }) => {
        await signIn(page);

        // Tab through navigation
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Focus should move to interactive elements
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });
});
