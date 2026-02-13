import { describe, expect, test, mock, beforeEach } from "bun:test";
import { getWorkerShifts } from "../src/modules/time-tracking/worker-shifts";

// --- Mocks ---

class MockAppError extends Error {
    constructor(public message: string, public code: string, public statusCode: number, public details?: any) {
        super(message);
        this.name = 'AppError';
    }
}

mock.module("@repo/observability", () => ({
    AppError: MockAppError
}));

const mockFindMany = mock(() => Promise.resolve([] as any[]));

// Self-referencing builder to handle chaining and specific returns
const mockBuilder: any = {
    select: mock(() => mockBuilder),
    from: mock(() => mockBuilder),
    leftJoin: mock(() => mockBuilder),
    innerJoin: mock(() => mockBuilder),
    where: mock(() => mockBuilder),
    orderBy: mock(() => mockBuilder),
    limit: mock(() => mockBuilder),
    offset: mockFindMany
};

mock.module("@repo/database", () => ({
    db: mockBuilder,
    shift: {},
    shiftAssignment: {},
    location: {},
    organization: {}
}));


describe("GET /worker/shifts", () => {
    // Assuming we have some data in the local DB. 
    // If not, these tests might fail or return empty arrays, which is still a partial success (no crash).
    // ideally we'd insert data here, but for now let's try to read common IDs or just run it.

    // We'll use a likely non-existent ID to test empty state first, 
    // or try to fetch known data if we can identify it.
    const TEST_WORKER_ID = "user_1";
    const TEST_ORG_ID = "ewwTgLz_yWUiuQiX4fS1E";

    test("removes pay information from response (WOR-26)", async () => {
        // Mock DB return with price/rate info to ensure it gets stripped
        const mockDbShift = {
            shift: {
                id: "shf_123",
                startTime: new Date("2026-06-01T09:00:00Z"),
                endTime: new Date("2026-06-01T17:00:00Z"),
                title: "Server",
                description: "Day Shift",
                price: 2000, // Should be hidden
                status: 'published',
                locationId: "loc_1"
            },
            shiftAssignment: {
                status: 'assigned',
                budgetRateSnapshot: 2500 // Should be hidden
            },
            location: {
                name: "Main Venue",
                address: "123 Main St"
            },
            organization: {
                name: "Test Org",
                logo: null
            }
        };

        // We need to mock the chain: db.select(...).from(...).innerJoin(...)...
        // This is complex with the current mockBuilder. 
        // Let's assume the service calls `await db.select(...)...` and returns an array.
        // We can override the `then` of the final builder.

        // A simpler way with Bun test constraints might be to just assume the mapper works if we can isolate it,
        // but here we are testing the service.

        // Let's refine the mock to return our data
        mockFindMany.mockResolvedValue([mockDbShift]);

        const response = await getWorkerShifts("worker_1", "org_1", { status: 'upcoming' });

        const data = response as any;
        expect(data.shifts).toHaveLength(1);
        const shift = data.shifts[0];

        // WOR-26 Assertions
        expect(shift).toHaveProperty("id");
        expect(shift).not.toHaveProperty("pay");
        expect(shift).not.toHaveProperty("hourlyRate");
        expect(shift).not.toHaveProperty("estimatedPay");
        expect(shift).not.toHaveProperty("price");
    });
});
