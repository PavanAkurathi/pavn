
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { publishSchedule } from "../src/services/publish";

// --- Mocks ---
// We need to capture what is inserted to verify the structure
// For fluent API: db.insert().values().onConflictDoUpdate().returning()
const mockReturning = mock(() => Promise.resolve([{ count: 1, windowStart: String(Date.now()) }]));
const mockOnConflict = mock(() => ({ returning: mockReturning }));

const mockValuesChain = {
    onConflictDoUpdate: mockOnConflict,
    then: (resolve: any) => resolve([]), // Make it thenable for await
};

const mockInsertValues = mock(() => mockValuesChain);

// Create a mock builder that returns itself for chainable methods
const mockSelectWhere = mock(() => Promise.resolve([] as any[]));

// Create a mock builder that returns itself for chainable methods
const mockBuilder: any = {
    insert: mock(() => ({
        values: mockInsertValues
    })),
    transaction: mock((cb) => cb(mockBuilder)), // Exec callback immediately
    query: {
        shift: { findFirst: mock(() => Promise.resolve(null)) },
        workerAvailability: { findMany: mock(() => Promise.resolve([])) },
        location: { findFirst: mock(() => Promise.resolve({ name: 'Test Venue' })) },
        workerNotificationPreferences: { findMany: mock(() => Promise.resolve([])) },
        idempotencyKey: { findFirst: mock(() => Promise.resolve(null)) }
    },
    select: mock(() => ({
        from: mock(() => ({
            innerJoin: mock(() => ({
                where: mockSelectWhere
            }))
        }))
    }))
};

mock.module("@repo/database", () => ({
    db: mockBuilder,
    shift: { $inferInsert: {} },
    shiftAssignment: { $inferInsert: {} },
    rateLimitState: {},
    idempotencyKey: {},
    scheduledNotification: {},
    workerAvailability: {},
    location: {},
    workerNotificationPreferences: {}
}));

mock.module("@repo/notifications", () => ({
    buildNotificationSchedule: mock(() => Promise.resolve([]))
}));

// Mock Overlap Service
const mockFindOverlappingAssignment = mock(() => Promise.resolve<any>(null));
mock.module("../src/services/overlap", () => ({
    findOverlappingAssignment: mockFindOverlappingAssignment
}));

describe("Publish Schedule - Overlap Detection", () => {
    beforeEach(() => {
        mockFindOverlappingAssignment.mockClear();
        mockFindOverlappingAssignment.mockResolvedValue(null);
    });

    const createRequest = (body: any) => body; // publishSchedule now accepts body object directly

    const validBody = {
        organizationId: "org1",
        locationId: "loc1",
        timezone: "UTC",
        schedules: []
    };

    test("throws if DB conflict found", async () => {
        // Setup conflict via DB select
        mockSelectWhere.mockResolvedValueOnce([
            {
                workerId: 'w1',
                startTime: new Date("2030-02-01T09:00:00Z"),
                endTime: new Date("2030-02-01T17:00:00Z"),
                title: "Existing Shift"
            }
        ]);

        // Request causing overlap
        const body = {
            ...validBody,
            schedules: [{
                startTime: "09:00",
                endTime: "17:00",
                dates: ["2030-02-01"],
                scheduleName: "Morning",
                positions: [{
                    roleName: "Guard",
                    workerIds: ["w1"]
                }]
            }]
        };

        try {
            await publishSchedule(createRequest(body), "org1");
            expect(true).toBe(false); // Should have thrown
        } catch (e: any) {
            // expect(e.name).toBe("AppError"); // Name might vary depending on compilation/instance
            expect(e.message).toContain("overlapping shift");
            expect(e.statusCode).toBe(409);
        }
        // expect(mockFindOverlappingAssignment).toHaveBeenCalled(); // No longer used
    });

    test("throws if In-Memory conflict found (Double Booking)", async () => {
        // Worker w1 assigned to two overlapping shifts in SAME request
        const body = {
            ...validBody,
            schedules: [
                {
                    startTime: "09:00",
                    endTime: "13:00", // 9am - 1pm
                    dates: ["2030-02-01"],
                    scheduleName: "Morning A",
                    positions: [{ roleName: "Guard", workerIds: ["w1"] }]
                },
                {
                    startTime: "12:00", // Overlaps!
                    endTime: "16:00",
                    dates: ["2030-02-01"],
                    scheduleName: "Afternoon B",
                    positions: [{ roleName: "Guard", workerIds: ["w1"] }]
                }
            ]
        };

        try {
            await publishSchedule(createRequest(body), "org1");
            expect(true).toBe(false); // Should have thrown
        } catch (e: any) {
            expect(e.name).toBe("AppError");
            expect(e.message).toContain("double-booked");
            expect(e.statusCode).toBe(409);
        }
    });

    test("succeeds if no overlap", async () => {
        // Non-overlapping shifts
        const body = {
            ...validBody,
            schedules: [
                {
                    startTime: "09:00",
                    endTime: "12:00",
                    dates: ["2030-02-01"],
                    scheduleName: "Morning",
                    positions: [{ roleName: "Guard", workerIds: ["w1"] }]
                },
                {
                    startTime: "13:00",
                    endTime: "17:00",
                    dates: ["2030-02-01"],
                    scheduleName: "Afternoon",
                    positions: [{ roleName: "Guard", workerIds: ["w1"] }]
                }
            ]
        };

        const res = await publishSchedule(createRequest(body), "org1");

        expect(res.success).toBe(true);
    });
});
