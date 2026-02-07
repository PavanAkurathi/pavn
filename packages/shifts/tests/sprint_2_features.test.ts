
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { approveShift } from "../src/services/approve";
import { nanoid } from "nanoid";
import { addMinutes, addHours } from "date-fns";

// --- Mocks ---
const mockUpdateSet = mock(() => ({ where: mock(() => Promise.resolve({ rowCount: 1 })) }));
const mockUpdate = mock(() => ({ set: mockUpdateSet }));

const mockBuilder: any = {
    insert: mock(() => ({ values: mock(() => Promise.resolve()) })),
    delete: mock(() => ({ where: mock(() => Promise.resolve()) })),
    query: {
        shift: { findFirst: mock(() => Promise.resolve(null)) }, // Default null
        shiftAssignment: { findMany: mock(() => Promise.resolve([])) }
    },
    transaction: mock((cb) => cb(mockBuilder)), // Transaction executes callback immediately
    select: mock(() => mockBuilder),
    from: mock(() => mockBuilder),
    where: mock(() => mockBuilder),
    update: mockUpdate, // Spy on this
};

mock.module("@repo/database", () => ({
    db: mockBuilder,
    shift: {},
    shiftAssignment: {},
    organization: {},
    user: {},
    member: {},
    location: {}
}));

// Mock config if needed (or assume default imports work if they are pure functions)

const orgId = `org_${nanoid()}`;
const shiftId = `shf_${nanoid()}`;
const workerA = "workerA";
const workerB = "workerB";
const workerC = "workerC";
const workerD = "workerD";

describe.skip("Sprint 2 Features (Unit)", () => {

    beforeEach(() => {
        mockUpdate.mockClear();
        mockUpdateSet.mockClear();
    });

    test("approves shift and applies Sprint 2 business rules correctly", async () => {
        // 1. Setup Data
        const baseDate = new Date("2026-01-20T10:00:00Z");
        const endTime = addHours(baseDate, 4); // 14:00

        const mockShift = {
            id: shiftId,
            organizationId: orgId,
            status: "completed",
            price: 2000,
            startTime: baseDate,
            endTime: endTime,
            assignments: [
                {
                    id: "asgA",
                    workerId: workerA,
                    clockIn: baseDate,
                    clockOut: addMinutes(baseDate, 1),
                    breakMinutes: 0
                },
                {
                    id: "asgB", // Grace Period
                    workerId: workerB,
                    clockIn: addMinutes(baseDate, 4),
                    clockOut: endTime,
                    breakMinutes: 0
                },
                {
                    id: "asgC", // Late Penalty
                    workerId: workerC,
                    clockIn: addMinutes(baseDate, 6),
                    clockOut: endTime,
                    breakMinutes: 0
                },
                {
                    id: "asgD", // Overtime Flag
                    workerId: workerD,
                    clockIn: baseDate,
                    clockOut: addMinutes(endTime, 16),
                    breakMinutes: 0
                }
            ]
        };

        mockBuilder.query.shift.findFirst.mockResolvedValue(mockShift);

        // 2. Act
        await approveShift(shiftId, orgId, "test_actor");

        // 3. Assert on Updates
        // The controller iterates assignments and updates them.
        // We expect 4 update calls (or 1 batch? code usually updates individually or in loop).
        // Let's inspect mockUpdateSet calls which contain the data.

        // mockUpdate is called like: db.update(shiftAssignment).set(payload).where(...)
        // So mockUpdate.mock.calls returns [ [shiftAssignment] ]
        // mockUpdateSet.mock.calls returns [ [payload] ]

        const updatePayloads = mockUpdateSet.mock.calls.map((c: any[]) => c[0]);

        // Worker A: 1 min -> 34 cents
        expect(updatePayloads[0]?.grossPayCents).toBe(34);

        // Worker B: Grace Period -> 8000 cents
        expect(updatePayloads[1]?.grossPayCents).toBe(8000);

        // Worker C: Late Penalty -> 7800 cents
        expect(updatePayloads[2]?.grossPayCents).toBe(7800);

        // Worker D: Overtime Flag -> 8534 cents + Flag
        expect(updatePayloads[3]?.grossPayCents).toBe(8534);
        expect(updatePayloads[3]?.adjustmentNotes).toContain("Flag: Clock-out >15m past schedule");
    });

    // WH-110: Idempotency Test
    test("prevents duplicate publishing with idempotency key", async () => {
        // Need to import dynamically to use mocked DB?
        // Actually module mock is global.
        const { publishSchedule } = await import("../src/services/publish");

        // Mock findFirst to return an existing batch
        const idempotencyKey = "test-key";
        mockBuilder.query.shift.findFirst.mockResolvedValueOnce({
            id: "batch1",
            createdAt: new Date()
        });

        const req = new Request("http://localhost/api/shifts/publish", {
            method: "POST",
            body: JSON.stringify({
                idempotencyKey,
                locationId: "loc1",
                organizationId: orgId,
                timezone: "UTC",
                schedules: []
            })
        });

        const res = await publishSchedule(req, orgId);

        
        const body = res as any;
        expect(body.message).toContain("Batch already processed");
        expect(body.batchId).toBe(idempotencyKey);
    });
});
