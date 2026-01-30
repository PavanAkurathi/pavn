import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.test' });

/**
 * Playwright E2E Test Configuration for WorkersHive
 * 
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './tests',
    
    /* Run tests in files in parallel */
    fullyParallel: true,
    
    /* Fail the build on CI if you accidentally left test.only in the source code */
    forbidOnly: !!process.env.CI,
    
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,
    
    /* Opt out of parallel tests on CI */
    workers: process.env.CI ? 1 : undefined,
    
    /* Reporter to use */
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['list'],
    ],
    
    /* Shared settings for all the projects below */
    use: {
        /* Base URL for the web app */
        baseURL: process.env.WEB_URL || 'http://localhost:3000',
        
        /* API base URL */
        extraHTTPHeaders: {
            'Accept': 'application/json',
        },
        
        /* Collect trace when retrying the failed test */
        trace: 'on-first-retry',
        
        /* Screenshot on failure */
        screenshot: 'only-on-failure',
        
        /* Video on failure */
        video: 'on-first-retry',
    },

    /* Configure projects for major browsers and API */
    projects: [
        // API Testing Project
        {
            name: 'api',
            testDir: './tests/api',
            use: {
                baseURL: process.env.API_URL || 'http://localhost:4005',
            },
        },

        // Web Testing Projects
        {
            name: 'web',
            testDir: './tests/web',
            use: { ...devices['Desktop Chrome'] },
        },

        {
            name: 'web-firefox',
            testDir: './tests/web',
            use: { ...devices['Desktop Firefox'] },
        },

        {
            name: 'web-safari',
            testDir: './tests/web',
            use: { ...devices['Desktop Safari'] },
        },

        /* Mobile viewports */
        {
            name: 'mobile-chrome',
            testDir: './tests/web',
            use: { ...devices['Pixel 5'] },
        },

        {
            name: 'mobile-safari',
            testDir: './tests/web',
            use: { ...devices['iPhone 13'] },
        },
    ],

    /* Run local dev servers before starting the tests */
    webServer: [
        {
            command: 'cd ../.. && bun run dev --filter=@repo/shifts',
            url: 'http://localhost:4005/health',
            reuseExistingServer: !process.env.CI,
            timeout: 120 * 1000,
        },
        {
            command: 'cd ../../apps/web && bun run dev',
            url: 'http://localhost:3000',
            reuseExistingServer: !process.env.CI,
            timeout: 120 * 1000,
        },
    ],
});
