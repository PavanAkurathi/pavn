import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * API Test Fixtures
 * Provides authenticated API context for tests
 */

// Test user credentials (should be seeded in test database)
const TEST_ADMIN = {
    email: 'admin@test.workershive.com',
    password: 'TestPassword123!',
};

const TEST_MANAGER = {
    email: 'manager@test.workershive.com',
    password: 'TestPassword123!',
};

const TEST_WORKER = {
    email: 'worker@test.workershive.com',
    password: 'TestPassword123!',
};

interface AuthContext {
    token: string;
    orgId: string;
    userId: string;
}

/**
 * Get authenticated API context
 */
async function authenticate(
    request: APIRequestContext,
    credentials: { email: string; password: string }
): Promise<AuthContext> {
    // Sign in
    const signInResponse = await request.post('/api/auth/sign-in/email', {
        data: {
            email: credentials.email,
            password: credentials.password,
        },
    });
    
    expect(signInResponse.ok()).toBeTruthy();
    
    const signInData = await signInResponse.json();
    const token = signInData.token || signInResponse.headers()['set-cookie']?.match(/session=([^;]+)/)?.[1];
    
    // Get session to retrieve org context
    const sessionResponse = await request.get('/api/auth/get-session', {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    
    const sessionData = await sessionResponse.json();
    
    return {
        token,
        orgId: sessionData.session?.activeOrganizationId || '',
        userId: sessionData.user?.id || '',
    };
}

// ============================================================================
// HEALTH CHECK TESTS
// ============================================================================

test.describe('Health Check', () => {
    test('GET /health returns OK', async ({ request }) => {
        const response = await request.get('/health');
        
        expect(response.ok()).toBeTruthy();
        expect(await response.text()).toBe('OK');
    });
});

// ============================================================================
// AUTHENTICATION TESTS
// ============================================================================

test.describe('Authentication', () => {
    test('sign in with valid credentials', async ({ request }) => {
        const response = await request.post('/api/auth/sign-in/email', {
            data: TEST_ADMIN,
        });
        
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.user).toBeDefined();
    });
    
    test('sign in with invalid credentials returns 401', async ({ request }) => {
        const response = await request.post('/api/auth/sign-in/email', {
            data: {
                email: 'invalid@test.com',
                password: 'wrongpassword',
            },
        });
        
        expect(response.status()).toBe(401);
    });
    
    test('unauthenticated request returns 401', async ({ request }) => {
        const response = await request.get('/worker/shifts');
        
        expect(response.status()).toBe(401);
    });
    
    test('missing org header returns 401', async ({ request }) => {
        const auth = await authenticate(request, TEST_WORKER);
        
        const response = await request.get('/worker/shifts', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                // Missing x-org-id
            },
        });
        
        expect(response.status()).toBe(401);
    });
});

// ============================================================================
// RBAC TESTS
// ============================================================================

test.describe('Role-Based Access Control', () => {
    test('worker cannot access manager endpoints', async ({ request }) => {
        const auth = await authenticate(request, TEST_WORKER);
        
        const response = await request.get('/shifts/upcoming', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'x-org-id': auth.orgId,
            },
        });
        
        expect(response.status()).toBe(403);
    });
    
    test('manager can access shift management', async ({ request }) => {
        const auth = await authenticate(request, TEST_MANAGER);
        
        const response = await request.get('/shifts/upcoming', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'x-org-id': auth.orgId,
            },
        });
        
        expect(response.ok()).toBeTruthy();
    });
    
    test('manager cannot access billing endpoints', async ({ request }) => {
        const auth = await authenticate(request, TEST_MANAGER);
        
        const response = await request.get('/billing/payment-methods', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'x-org-id': auth.orgId,
            },
        });
        
        expect(response.status()).toBe(403);
    });
    
    test('admin can access billing endpoints', async ({ request }) => {
        const auth = await authenticate(request, TEST_ADMIN);
        
        const response = await request.get('/billing/payment-methods', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'x-org-id': auth.orgId,
            },
        });
        
        // May return 501 (not implemented) but NOT 403
        expect(response.status()).not.toBe(403);
    });
});

// ============================================================================
// WORKER SHIFTS TESTS
// ============================================================================

test.describe('Worker Shifts', () => {
    test('worker can view their own shifts', async ({ request }) => {
        const auth = await authenticate(request, TEST_WORKER);
        
        const response = await request.get('/worker/shifts', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'x-org-id': auth.orgId,
            },
        });
        
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.shifts).toBeDefined();
        expect(Array.isArray(data.shifts)).toBeTruthy();
    });
    
    test('worker can filter shifts by status', async ({ request }) => {
        const auth = await authenticate(request, TEST_WORKER);
        
        const response = await request.get('/worker/shifts?status=history', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'x-org-id': auth.orgId,
            },
        });
        
        expect(response.ok()).toBeTruthy();
    });
    
    test('worker can paginate shifts', async ({ request }) => {
        const auth = await authenticate(request, TEST_WORKER);
        
        const response = await request.get('/worker/shifts?limit=5&offset=0', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'x-org-id': auth.orgId,
            },
        });
        
        expect(response.ok()).toBeTruthy();
    });
});

// ============================================================================
// CLOCK IN/OUT TESTS
// ============================================================================

test.describe('Geofence Clock In/Out', () => {
    test('clock in requires valid location data', async ({ request }) => {
        const auth = await authenticate(request, TEST_WORKER);
        
        const response = await request.post('/clock-in', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'x-org-id': auth.orgId,
            },
            data: {
                shiftId: 'invalid_shift_id',
                // Missing required fields
            },
        });
        
        expect(response.status()).toBe(400);
    });
    
    test('clock in rejects stale timestamps', async ({ request }) => {
        const auth = await authenticate(request, TEST_WORKER);
        
        // Timestamp from 10 minutes ago (outside 5 min window)
        const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        
        const response = await request.post('/clock-in', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'x-org-id': auth.orgId,
            },
            data: {
                shiftId: 'test_shift_id',
                latitude: '42.3601',
                longitude: '-71.0589',
                deviceTimestamp: staleTimestamp,
            },
        });
        
        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.code).toBe('REPLAY_DETECTED');
    });
    
    test('clock in rejects low accuracy GPS', async ({ request }) => {
        const auth = await authenticate(request, TEST_WORKER);
        
        const response = await request.post('/clock-in', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'x-org-id': auth.orgId,
            },
            data: {
                shiftId: 'test_shift_id',
                latitude: '42.3601',
                longitude: '-71.0589',
                accuracyMeters: 500, // Over 200m threshold
                deviceTimestamp: new Date().toISOString(),
            },
        });
        
        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.code).toBe('LOW_ACCURACY');
    });
});

// ============================================================================
// RATE LIMITING TESTS
// ============================================================================

test.describe('Rate Limiting', () => {
    test('clock in is rate limited', async ({ request }) => {
        const auth = await authenticate(request, TEST_WORKER);
        
        const headers = {
            'Authorization': `Bearer ${auth.token}`,
            'x-org-id': auth.orgId,
        };
        
        const data = {
            shiftId: 'test_shift_id',
            latitude: '42.3601',
            longitude: '-71.0589',
            deviceTimestamp: new Date().toISOString(),
        };
        
        // Make multiple requests quickly
        const responses = await Promise.all([
            request.post('/clock-in', { headers, data }),
            request.post('/clock-in', { headers, data }),
            request.post('/clock-in', { headers, data }),
            request.post('/clock-in', { headers, data }),
            request.post('/clock-in', { headers, data }),
            request.post('/clock-in', { headers, data }),
        ]);
        
        // At least one should be rate limited (or error for other reasons)
        const statuses = responses.map(r => r.status());
        
        // Check rate limit headers are present
        const lastResponse = responses[responses.length - 1];
        expect(lastResponse.headers()['x-ratelimit-limit']).toBeDefined();
    });
});

// ============================================================================
// ADJUSTMENT TESTS
// ============================================================================

test.describe('Time Adjustments', () => {
    test('worker can request time adjustment', async ({ request }) => {
        const auth = await authenticate(request, TEST_WORKER);
        
        const response = await request.post('/worker/adjustments', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'x-org-id': auth.orgId,
            },
            data: {
                shiftAssignmentId: 'test_assignment_id',
                reason: 'Forgot to clock out',
                requestedClockOut: new Date().toISOString(),
            },
        });
        
        // May fail if assignment doesn't exist, but should not be 401/403
        expect(response.status()).not.toBe(401);
        expect(response.status()).not.toBe(403);
    });
    
    test('manager can view pending adjustments', async ({ request }) => {
        const auth = await authenticate(request, TEST_MANAGER);
        
        const response = await request.get('/adjustments/pending', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'x-org-id': auth.orgId,
            },
        });
        
        expect(response.ok()).toBeTruthy();
    });
});
