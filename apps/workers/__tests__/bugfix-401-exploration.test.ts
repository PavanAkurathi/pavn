/**
 * Bug Condition Exploration Test for 401 Error Handling
 * 
 * **Validates: Requirements 1.2, 2.2**
 * 
 * This test explores the bug condition where the app throws an unhandled
 * "Unauthorized" error when API requests receive 401 responses, instead of
 * gracefully handling session expiration by redirecting to login.
 * 
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists and surfaces counterexamples.
 * 
 * When this test passes after the fix, it confirms the expected behavior is satisfied.
 */

import * as SecureStore from 'expo-secure-store';
import { api } from '../lib/api';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

// Mock expo-router
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
    router: {
        replace: mockRouterReplace,
    },
}));

// Mock auth-client
jest.mock('../lib/auth-client', () => ({
    authClient: {
        getSession: jest.fn().mockResolvedValue({
            data: {
                session: {
                    activeOrganizationId: 'test-org-id',
                },
            },
        }),
    },
}));

describe('Bug Condition Exploration: 401 Error Handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Setup default mock for token retrieval
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');
        // Mock global fetch with proper typing
        global.fetch = jest.fn() as unknown as typeof fetch;
    });

    /**
     * Property 1: Fault Condition - Token Deletion on 401
     * 
     * Test that when fetchJson receives a 401 response, it deletes the session token.
     * This part of the behavior is already implemented correctly.
     * 
     * EXPECTED OUTCOME ON UNFIXED CODE: This assertion PASSES
     * (token deletion is working, but redirect and error handling are not)
     */
    it('should delete session token when API returns 401', async () => {
        // Mock 401 response
        (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
            status: 401,
            ok: false,
            statusText: 'Unauthorized',
            json: async () => ({ error: 'Unauthorized' }),
        } as Response);

        let error;
        try {
            await api.shifts.getUpcoming();
        } catch (e: any) {
            error = e;
        }

        // Expected behavior: Token should be deleted
        // On unfixed code: This PASSES (token deletion works)
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('better-auth.session_token');

        // Document the counterexample
        console.log('COUNTEREXAMPLE - Token Deletion:');
        console.log('API Endpoint: /worker/shifts?status=upcoming');
        console.log('HTTP Status: 401');
        console.log('Token Deleted: YES ✓');
        console.log('Error Thrown:', error?.message);
    });

    /**
     * Property 1: Fault Condition - Redirect to Login on 401
     * 
     * Test that when fetchJson receives a 401 response, it redirects to login screen.
     * This is the MISSING behavior that causes the bug.
     * 
     * EXPECTED OUTCOME ON UNFIXED CODE: This assertion FAILS
     * (no redirect occurs, proving the bug exists)
     */
    it('should redirect to login when API returns 401', async () => {
        // Mock 401 response
        (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
            status: 401,
            ok: false,
            statusText: 'Unauthorized',
            json: async () => ({ error: 'Unauthorized' }),
        } as Response);

        let error;
        try {
            await api.shifts.getUpcoming();
        } catch (e: any) {
            error = e;
        }

        // Expected behavior: Should redirect to login
        // On unfixed code: This FAILS (no redirect occurs)
        expect(mockRouterReplace).toHaveBeenCalledWith('/login');

        // Document the counterexample
        if (!mockRouterReplace.mock.calls.length) {
            console.error('COUNTEREXAMPLE FOUND:');
            console.error('API Endpoint: /worker/shifts?status=upcoming');
            console.error('HTTP Status: 401');
            console.error('Expected: Redirect to /login');
            console.error('Actual: NO redirect occurred');
            console.error('Error thrown:', error?.message);
        }
    });

    /**
     * Property 1: Fault Condition - No Unhandled Error Crash on 401
     * 
     * Test that when fetchJson receives a 401 response, it does NOT throw an
     * unhandled error that crashes the app. Instead, it should handle the
     * session expiration gracefully.
     * 
     * EXPECTED OUTCOME ON UNFIXED CODE: This assertion FAILS
     * (unhandled "Unauthorized" error is thrown, proving the bug exists)
     */
    it('should NOT throw unhandled error when API returns 401', async () => {
        // Mock 401 response
        (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
            status: 401,
            ok: false,
            statusText: 'Unauthorized',
            json: async () => ({ error: 'Unauthorized' }),
        } as Response);

        let error;
        let didThrow = false;
        try {
            await api.shifts.getUpcoming();
        } catch (e: any) {
            error = e;
            didThrow = true;
        }

        // Expected behavior: Should NOT throw an error (or throw a handled error)
        // On unfixed code: This FAILS (error is thrown)
        expect(didThrow).toBe(false);

        // Document the counterexample
        if (didThrow) {
            console.error('COUNTEREXAMPLE FOUND:');
            console.error('API Endpoint: /worker/shifts?status=upcoming');
            console.error('HTTP Status: 401');
            console.error('Expected: No unhandled error (graceful handling)');
            console.error('Actual: Unhandled error thrown');
            console.error('Error message:', error?.message);
            console.error('Error type:', error?.constructor?.name);
        }
    });

    /**
     * Property 1 (Extended): Multiple API Endpoints with 401
     * 
     * Test that 401 handling works consistently across different API endpoints.
     * This verifies the bug affects all API calls, not just specific endpoints.
     * 
     * EXPECTED OUTCOME ON UNFIXED CODE: All assertions FAIL
     * (all endpoints throw unhandled errors without redirect)
     */
    it('should handle 401 gracefully across multiple API endpoints', async () => {
        // Mock 401 response
        (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
            status: 401,
            ok: false,
            statusText: 'Unauthorized',
            json: async () => ({ error: 'Unauthorized' }),
        } as Response);

        const endpoints = [
            { name: 'shifts.getUpcoming', fn: () => api.shifts.getUpcoming() },
            { name: 'worker.getProfile', fn: () => api.worker.getProfile() },
            { name: 'worker.getAllShifts', fn: () => api.worker.getAllShifts() },
        ];

        const counterexamples: any[] = [];

        for (const endpoint of endpoints) {
            jest.clearAllMocks();
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');

            let error;
            let didThrow = false;
            try {
                await endpoint.fn();
            } catch (e: any) {
                error = e;
                didThrow = true;
            }

            // Expected behavior: No error thrown, redirect occurs
            // On unfixed code: Error thrown, no redirect
            const tokenDeleted = (SecureStore.deleteItemAsync as jest.Mock).mock.calls.length > 0;
            const redirected = mockRouterReplace.mock.calls.length > 0;

            if (didThrow || !redirected) {
                counterexamples.push({
                    endpoint: endpoint.name,
                    tokenDeleted,
                    redirected,
                    errorThrown: didThrow,
                    errorMessage: error?.message,
                });
            }
        }

        // Expected: No counterexamples (all endpoints handle 401 gracefully)
        // On unfixed code: Multiple counterexamples found
        expect(counterexamples).toHaveLength(0);

        // Document all counterexamples
        if (counterexamples.length > 0) {
            console.error('COUNTEREXAMPLES FOUND ACROSS MULTIPLE ENDPOINTS:');
            counterexamples.forEach((ce, idx) => {
                console.error(`\nCounterexample ${idx + 1}:`);
                console.error('  Endpoint:', ce.endpoint);
                console.error('  Token Deleted:', ce.tokenDeleted ? 'YES ✓' : 'NO ✗');
                console.error('  Redirected to Login:', ce.redirected ? 'YES ✓' : 'NO ✗');
                console.error('  Error Thrown:', ce.errorThrown ? 'YES ✗' : 'NO ✓');
                console.error('  Error Message:', ce.errorMessage);
            });
            console.error('\nExpected: All endpoints handle 401 with redirect, no errors');
            console.error('Actual: Endpoints throw errors without redirect');
        }
    });

    /**
     * Property 1 (Context): Clock-In with 401 Response
     * 
     * Test the specific context where 401 during clock-in could crash the app
     * and prevent workers from clocking in after session expiration.
     * 
     * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
     * (clock-in throws unhandled error without redirect)
     */
    it('should handle 401 during clock-in without crashing', async () => {
        // Mock 401 response
        (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
            status: 401,
            ok: false,
            statusText: 'Unauthorized',
            json: async () => ({ error: 'Unauthorized' }),
        } as Response);

        const clockInData = {
            shiftId: 'test-shift-id',
            latitude: 37.7749,
            longitude: -122.4194,
            accuracyMeters: 10,
            deviceTimestamp: new Date().toISOString(),
        };

        let error;
        let didThrow = false;
        try {
            await api.geofence.clockIn(clockInData);
        } catch (e: any) {
            error = e;
            didThrow = true;
        }

        // Expected behavior: No error thrown, redirect to login
        // On unfixed code: Error thrown, no redirect
        expect(didThrow).toBe(false);
        expect(mockRouterReplace).toHaveBeenCalledWith('/login');

        // Document the counterexample with full context
        if (didThrow || !mockRouterReplace.mock.calls.length) {
            console.error('COUNTEREXAMPLE FOUND:');
            console.error('Context: Worker attempting to clock in');
            console.error('API Endpoint: /geofence/clock-in');
            console.error('HTTP Status: 401');
            console.error('User Impact: Worker cannot clock in, app crashes');
            console.error('Expected: Redirect to login, allow re-authentication');
            console.error('Actual: Unhandled error thrown, app crashes');
            console.error('Error:', error?.message);
            console.error('Token Deleted:', (SecureStore.deleteItemAsync as jest.Mock).mock.calls.length > 0);
            console.error('Redirected:', mockRouterReplace.mock.calls.length > 0);
        }
    });
});
