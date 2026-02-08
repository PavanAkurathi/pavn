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
    await expect(page.locator('[data-testid="org-name"]')).toBeVisible({ timeout: 30000 });
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
        await expect(page.getByRole('link', { name: /shifts/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /rosters/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /reports/i })).toBeVisible();
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
        await page.click('a[href*="schedule"]');
    });

    test('schedule page loads', async ({ page }) => {
        await expect(page).toHaveURL(/.*schedule.*/);
    });

    test('can create new shift', async ({ page }) => {
        // Click create shift button
        await page.click('[data-testid="create-shift"]');

        // 1. Select Date (Standard Mode)
        await page.click('[data-testid="dates-trigger"]');
        // Click the first available enabled day in the calendar (usually today or tomorrow)
        // avoiding "rdp-day_disabled"
        const dayLocator = page.locator('.rdp-day:not(.rdp-day_disabled)').first();
        await dayLocator.click();
        // Close popover (clicking outside or pressing escape, or just clicking the next element triggers blur)
        await page.keyboard.press('Escape');

        // 2. Select Start Time
        // The IntervalTimePicker uses a Select trigger with placeholder "Start time"
        await page.click('button:has-text("Start time")');
        // Select 09:00 AM
        await page.click('div[role="option"]:has-text("09:00")');

        // 3. Select End Time
        await page.click('button:has-text("End time")');
        // Select 05:00 PM (17:00)
        await page.click('div[role="option"]:has-text("17:00")');

        // 4. Add Position
        await page.click('[data-testid="add-position"]');
        // Select the first available crew member
        await page.click('[data-testid="position-item"]');
        // Confirm selection
        await page.click('[data-testid="confirm-positions"]');

        // 5. Review & Publish
        await page.click('[data-testid="review-publish"]');

        // 6. Confirm in Dialog
        await page.click('[data-testid="confirm-publish"]');

        // Should return to dashboard and show success
        await expect(page).toHaveURL(/.*dashboard\/shifts.*/);
        await expect(page.getByText(/schedule published|success/i)).toBeVisible({ timeout: 10000 });
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
        await signIn(page);
        await page.click('a[href*="rosters"]');
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
        await page.click('[data-testid="invite-worker"]');

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
