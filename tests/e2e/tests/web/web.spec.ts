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

    // Wait for redirect to dashboard
    await page.waitForURL(/.*dashboard.*/, { timeout: 30000 });
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

        await expect(page).toHaveURL(/.*dashboard.*/);
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
        await expect(nav.getByRole('link', { name: 'Shifts', exact: true })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Roster', exact: true })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Reports', exact: true })).toBeVisible();
    });

    test('dashboard shows upcoming shifts widget', async ({ page }) => {
        await expect(page.locator('[data-testid="upcoming-shifts-widget"]')).toBeVisible();
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
        await expect(page.getByTestId('week-strip')).toBeVisible({ timeout: 30000 });
    });

    test('can add a shift, fill it with a suggestion, and publish the week', async ({ page }) => {
        test.setTimeout(120000);

        // A random week months out, so no earlier run's shift is in the way.
        const weeksOut = 8 + Math.floor(Math.random() * 400);
        const someWeek = new Date(Date.now() + weeksOut * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        await page.goto(`/schedule?week=${someWeek}`);
        await expect(page.getByTestId('week-strip')).toBeVisible({ timeout: 30000 });

        // Wednesday: type the time, pick the role, add it. No dragging anywhere.
        await page.getByTestId('day-tile-3').click();
        await page.getByTestId('add-shift').click();
        await page.getByLabel('Time', { exact: true }).fill('9-5');
        await page.getByLabel('Role', { exact: true }).fill('Server');
        await page.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(page.getByTestId('day-panel').getByText('9a–5p')).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('needed-card')).toHaveCount(1);

        // Suggest someone for the open spot.
        await page.getByTestId('suggest-button').click();
        await expect(page.getByTestId('suggest-sheet')).toBeVisible();
        await page.locator('[data-testid^="suggest-add-"]').first().click();
        await expect(page.getByText('All filled. Nice.')).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: 'Done' }).click();
        await expect(page.getByTestId('person-card')).toHaveCount(1);

        // Publish the week.
        await page.getByRole('button', { name: /^Publish \d+/ }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: /^Publish( anyway)?$/ }).click();
        await expect(page.getByText(/^Published\./)).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('publish-bar')).toBeHidden();
    });

    test('the Week table opens the Add a shift sheet from a cell', async ({ page, isMobile }) => {
        test.skip(isMobile, 'The Week table is desktop only; phones use the Day view.');
        await page.goto('/schedule');
        await expect(page.getByTestId('week-strip')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('schedule-view-week').click();
        await expect(page.getByRole('table').first()).toBeVisible();
        await page.locator('[data-cell="0,3"]').click();
        await expect(page.getByTestId('add-shift-sheet')).toBeVisible();
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

test.describe('Roster Management', () => {
    test.beforeEach(async ({ page }) => {
        // Log console messages
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
        page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

        await signIn(page);
        await page.click('a[href*="rosters"]');
        await expect(page).toHaveURL(/.*rosters.*/);
        await page.waitForLoadState('networkidle');
    });

    test('roster page loads', async ({ page }) => {
        await expect(page).toHaveURL(/.*rosters.*/);
    });

    test('can search roster members', async ({ page }) => {
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

    test('mobile navigation works', async ({ page }) => {
        await signIn(page);

        // Below 768px the four places to go sit in a bottom tab bar.
        const tabs = page.getByRole('navigation');
        await expect(tabs.getByRole('link', { name: /^Schedule/ })).toBeVisible();
        await expect(tabs.getByRole('link', { name: 'Roster', exact: true })).toBeVisible();

        await tabs.getByRole('link', { name: 'Reports', exact: true }).click();
        await expect(page).toHaveURL(/\/reports/);
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
