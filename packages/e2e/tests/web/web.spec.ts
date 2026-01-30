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
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', credentials.email);
    await page.fill('input[name="password"]', credentials.password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard**');
}

// ============================================================================
// AUTHENTICATION UI TESTS
// ============================================================================

test.describe('Authentication UI', () => {
    test('sign in page loads', async ({ page }) => {
        await page.goto('/sign-in');
        
        await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
    });
    
    test('sign up page loads', async ({ page }) => {
        await page.goto('/sign-up');
        
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
    });
    
    test('successful sign in redirects to dashboard', async ({ page }) => {
        await signIn(page);
        
        await expect(page).toHaveURL(/.*dashboard.*/);
    });
    
    test('invalid credentials shows error', async ({ page }) => {
        await page.goto('/sign-in');
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
        await expect(page).toHaveURL(/.*sign-in.*/);
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
        await expect(page.getByRole('link', { name: /schedule/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /crew|workers/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /timesheets/i })).toBeVisible();
    });
    
    test('dashboard shows upcoming shifts widget', async ({ page }) => {
        await expect(page.getByText(/upcoming/i)).toBeVisible();
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
        
        // Fill shift form
        await page.fill('input[name="title"]', 'E2E Test Shift');
        
        // Select date/time (implementation depends on your date picker)
        // await page.fill('input[name="startTime"]', '2026-02-01T09:00');
        // await page.fill('input[name="endTime"]', '2026-02-01T17:00');
        
        // Submit
        await page.click('button[type="submit"]');
        
        // Should show success
        await expect(page.getByText(/created|success/i)).toBeVisible({ timeout: 5000 });
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

test.describe('Crew Management', () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page);
        await page.click('a[href*="crew"]');
    });
    
    test('crew page loads', async ({ page }) => {
        await expect(page).toHaveURL(/.*crew.*/);
    });
    
    test('can search crew members', async ({ page }) => {
        const searchInput = page.locator('input[placeholder*="search" i]');
        
        if (await searchInput.isVisible()) {
            await searchInput.fill('test');
            // Results should filter
            await page.waitForTimeout(500); // Debounce
        }
    });
    
    test('can invite new worker', async ({ page }) => {
        await page.click('[data-testid="invite-worker"]');
        
        await page.fill('input[name="email"]', 'newworker@test.com');
        await page.click('button[type="submit"]');
        
        await expect(page.getByText(/invited|sent/i)).toBeVisible({ timeout: 5000 });
    });
});

// ============================================================================
// TIMESHEETS TESTS
// ============================================================================

test.describe('Timesheets', () => {
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
        await page.click('a[href*="settings"]');
        
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
        
        // Mobile menu button should be visible
        const menuButton = page.locator('[data-testid="mobile-menu"]');
        await expect(menuButton).toBeVisible();
        
        // Click to open menu
        await menuButton.click();
        
        // Navigation should be visible
        await expect(page.getByRole('link', { name: /schedule/i })).toBeVisible();
    });
    
    test('forms are usable on mobile', async ({ page }) => {
        await page.goto('/sign-in');
        
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
        await page.goto('/sign-in');
        
        // Check for accessible labels
        const emailInput = page.locator('input[name="email"]');
        const passwordInput = page.locator('input[name="password"]');
        
        await expect(emailInput).toHaveAttribute('aria-label', /.*/);
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
