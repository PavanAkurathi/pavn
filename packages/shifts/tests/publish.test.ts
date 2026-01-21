
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { publishScheduleController } from "../src/controllers/publish";
import { nanoid } from "nanoid";

// --- Mocks ---
// We need to capture what is inserted to verify the structure
const mockInsertValues = mock(() => Promise.resolve());
const mockInsert = mock(() => ({ values: mockInsertValues }));

const mockBuilder: any = {
    insert: mockInsert,
    transaction: mock((cb) => cb(mockBuilder)), // Exec callback immediately
    query: {
        shift: { findFirst: mock(() => Promise.resolve(null)) },
    }
};

mock.module("@repo/database", () => ({
    db: mockBuilder,
    shift: { $inferInsert: {} },
    shiftAssignment: { $inferInsert: {} }
}));

mock.module("../src/services/overlap", () => ({
    findOverlappingAssignment: mock(() => Promise.resolve(null))
}));

describe("Publish Controller (WH-131 Fix)", () => {

    beforeEach(() => {
        mockInsertValues.mockClear();
        mockInsert.mockClear();
    });

    test("creates ONE shift with MULTIPLE assignments for a multi-worker block", async () => {
        const orgId = "org_123";
        const locationId = "loc_123";

        const req = new Request("http://localhost/api/shifts/publish", {
            method: "POST",
            body: JSON.stringify({
                organizationId: orgId,
                locationId: locationId,
                timezone: "UTC",
                schedules: [{
                    startTime: "09:00",
                    endTime: "17:00",
                    dates: ["2026-05-20"],
                    scheduleName: "Morning Shift",
                    positions: [{
                        roleName: "Server",
                        workerIds: ["worker_1", "worker_2", "worker_3"] // 3 Workers
                    }]
                }]
            })
        });

        await publishScheduleController(req, orgId);

        // Analyze calls to db.insert(table).values(...)
        // We expect 2 insert calls: one for shifts, one for assignments
        // But strictly checking the arguments passed to 'values'

        // mockInsert is called twice (once for shift, once for shiftAssignment)
        // We need to check the data arrays passed to values()

        // mockInsertValues is a mock function, calls are stored in .mock.calls
        const calls = mockInsertValues.mock.calls as any[];
        const firstInsertCall = calls[0];
        const secondInsertCall = calls[1];

        // Flatten all inserted items to find shifts and assignments
        // The controller does: await tx.insert(shift).values(shiftsToInsert);
        // Then: await tx.insert(shiftAssignment).values(assignmentsToInsert);

        // We don't easily know which is which without checking the object shape or mock implementation details
        // But we know shifts have 'capacityTotal' and assignments have 'workerId'

        const allInserts = [
            ...(firstInsertCall ? firstInsertCall[0] : []),
            ...(secondInsertCall ? secondInsertCall[0] : [])
        ];

        const shifts = allInserts.filter((i: any) => i.title !== undefined); // Shifts have titles
        const assignments = allInserts.filter((i: any) => i.workerId !== undefined); // Assignments have workerId

        // EXPECTATION FOR WH-131:
        // 1 Shift created
        expect(shifts.length).toBe(1);
        expect(shifts[0].capacityTotal).toBe(3); // 3 worker slots

        // 3 Assignments created
        expect(assignments.length).toBe(3);

        // Verify linking
        const shiftId = shifts[0].id;
        expect(assignments[0].shiftId).toBe(shiftId);
        expect(assignments[1].shiftId).toBe(shiftId);
        expect(assignments[2].shiftId).toBe(shiftId);
    });

    test("handles OPEN slots (null workers) correctly", async () => {
        const orgId = "org_123";

        const req = new Request("http://localhost/api/shifts/publish", {
            method: "POST",
            body: JSON.stringify({
                organizationId: orgId,
                locationId: "loc_1",
                timezone: "UTC",
                schedules: [{
                    startTime: "09:00",
                    endTime: "17:00",
                    dates: ["2026-05-21"],
                    scheduleName: "Open Shift Test",
                    positions: [{
                        roleName: "Server",
                        // 1 Assigned, 2 Open
                        workerIds: ["worker_1", null, null]
                    }]
                }]
            })
        });

        await publishScheduleController(req, orgId);

        const calls = mockInsertValues.mock.calls as any[];
        const call1 = calls[0]?.[0] || [];
        const call2 = calls[1]?.[0] || [];

        const allInserts = [...call1, ...call2];
        const shifts = allInserts.filter((i: any) => i.title !== undefined);
        const assignments = allInserts.filter((i: any) => i.workerId !== undefined);

        expect(shifts.length).toBe(1);
        expect(shifts[0].capacityTotal).toBe(3); // 1 worker + 2 open = 3 capacity

        expect(assignments.length).toBe(1); // Only 1 actual assignment for worker_1
        expect(assignments[0].workerId).toBe("worker_1");
    });

    test("rejects empty dates array", async () => {
        const orgId = "org_123";
        const req = new Request("http://localhost/api/shifts/publish", {
            method: "POST",
            body: JSON.stringify({
                organizationId: orgId,
                locationId: "loc_1",
                timezone: "UTC",
                schedules: [{
                    startTime: "09:00",
                    endTime: "17:00",
                    dates: [], // Empty
                    scheduleName: "Test",
                    positions: []
                }]
            })
        });

        try {
            await publishScheduleController(req, orgId);
            expect(true).toBe(false); // Should not reach here
        } catch (e: any) {
            expect(e.statusCode).toBe(400);
            expect(e.message).toContain("Validation Failed");
        }
    });

    test("rejects past dates", async () => {
        const orgId = "org_123";
        const req = new Request("http://localhost/api/shifts/publish", {
            method: "POST",
            body: JSON.stringify({
                organizationId: orgId,
                locationId: "loc_1",
                timezone: "UTC",
                schedules: [{
                    startTime: "09:00",
                    endTime: "17:00",
                    dates: ["1999-01-01"], // Definitely past
                    scheduleName: "Past Test",
                    positions: []
                }]
            })
        });

        try {
            await publishScheduleController(req, orgId);
            expect(true).toBe(false);
        } catch (e: any) {
            expect(e.statusCode).toBe(400);
            expect(e.code).toBe("INVALID_PAST_DATES");
            expect(e.message).toContain("1999-01-01");
        }
    });

    // WH-130: Recurrence Tests
    test("expands recurring dates (weekly)", async () => {
        const orgId = "org_123";
        // Start on a Sunday (2026-06-01 is a Monday)
        const req = new Request("http://localhost/api/shifts/publish", {
            method: "POST",
            body: JSON.stringify({
                organizationId: orgId,
                locationId: "loc_1",
                timezone: "UTC",
                recurrence: {
                    enabled: true,
                    pattern: 'weekly',
                    daysOfWeek: [1, 3], // Mon, Wed
                    endType: 'after_weeks',
                    endAfter: 2 // 2 weeks
                },
                schedules: [{
                    startTime: "09:00",
                    endTime: "17:00",
                    dates: ["2026-06-01"], // Monday
                    scheduleName: "Recurring Test",
                    positions: [{
                        roleName: "Server",
                        workerIds: ["w1"]
                    }]
                }]
            })
        });

        const res = await publishScheduleController(req, orgId);
        const data: any = await res.json();

        expect(res.status).toBe(201);
        // Expect 2 weeks * 2 days = 4 shifts
        expect(data.count).toBe(4);
    });

    test("expands recurring dates (on_date)", async () => {
        const orgId = "org_123";
        const req = new Request("http://localhost/api/shifts/publish", {
            method: "POST",
            body: JSON.stringify({
                organizationId: orgId,
                locationId: "loc_1",
                timezone: "UTC",
                recurrence: {
                    enabled: true,
                    pattern: 'weekly',
                    daysOfWeek: [5], // Friday
                    endType: 'on_date',
                    endDate: '2026-06-15' // Should include June 5, June 12. Skip June 19.
                },
                schedules: [{
                    startTime: "09:00",
                    endTime: "17:00",
                    dates: ["2026-06-05"], // Friday
                    scheduleName: "Recurring Test",
                    positions: [{ roleName: "Cook", workerIds: ["w1"] }]
                }]
            })
        });

        const res = await publishScheduleController(req, orgId);
        const data: any = await res.json();
        expect(res.status).toBe(201);
        expect(data.count).toBe(2); // June 5, June 12
    });
});
