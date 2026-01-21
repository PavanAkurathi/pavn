
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { publishScheduleController } from "../src/controllers/publish";

// Mock DB (Minimal)
const mockTransaction = mock((cb) => cb({ insert: () => ({ values: () => Promise.resolve() }) }));
const mockFindFirst = mock(() => Promise.resolve(null));

mock.module("@repo/database", () => ({
    db: {
        query: { shift: { findFirst: mockFindFirst } },
        transaction: mockTransaction
    },
    shift: {},
    shiftAssignment: {}
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

    const createRequest = (body: any) => new Request("http://localhost/publish", {
        method: "POST",
        body: JSON.stringify(body)
    });

    const validBody = {
        organizationId: "org1",
        locationId: "loc1",
        timezone: "UTC",
        schedules: []
    };

    test("throws if DB conflict found", async () => {
        // Setup conflict
        mockFindOverlappingAssignment.mockResolvedValue({
            title: "Existing Shift",
            startTime: new Date()
        });

        // Request causing overlap
        const body = {
            ...validBody,
            schedules: [{
                startTime: "09:00",
                endTime: "17:00",
                dates: ["2026-02-01"],
                scheduleName: "Morning",
                positions: [{
                    roleName: "Guard",
                    workerIds: ["w1"]
                }]
            }]
        };

        try {
            await publishScheduleController(createRequest(body), "org1");
            expect(true).toBe(false); // Should have thrown
        } catch (e: any) {
            expect(e.name).toBe("AppError");
            expect(e.message).toContain("overlapping shift");
            expect(e.statusCode).toBe(409);
        }
        expect(mockFindOverlappingAssignment).toHaveBeenCalled();
    });

    test("throws if In-Memory conflict found (Double Booking)", async () => {
        // Worker w1 assigned to two overlapping shifts in SAME request
        const body = {
            ...validBody,
            schedules: [
                {
                    startTime: "09:00",
                    endTime: "13:00", // 9am - 1pm
                    dates: ["2026-02-01"],
                    scheduleName: "Morning A",
                    positions: [{ roleName: "Guard", workerIds: ["w1"] }]
                },
                {
                    startTime: "12:00", // Overlaps!
                    endTime: "16:00",
                    dates: ["2026-02-01"],
                    scheduleName: "Afternoon B",
                    positions: [{ roleName: "Guard", workerIds: ["w1"] }]
                }
            ]
        };

        try {
            await publishScheduleController(createRequest(body), "org1");
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
                    dates: ["2026-02-01"],
                    scheduleName: "Morning",
                    positions: [{ roleName: "Guard", workerIds: ["w1"] }]
                },
                {
                    startTime: "13:00",
                    endTime: "17:00",
                    dates: ["2026-02-01"],
                    scheduleName: "Afternoon",
                    positions: [{ roleName: "Guard", workerIds: ["w1"] }]
                }
            ]
        };

        const res = await publishScheduleController(createRequest(body), "org1");

        expect(res.status).toBe(201);
    });
});
