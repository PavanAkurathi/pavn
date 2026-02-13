
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
        shiftAssignment: { findMany: mock(() => Promise.resolve([])) },
        member: { findFirst: mock(() => Promise.resolve({ role: 'admin' })) } // Auth
    },
    transaction: mock((cb) => cb(mockBuilder)), // Transaction executes callback immediately
    select: mock(() => mockBuilder),
    from: mock(() => mockBuilder),
    where: mock(() => mockBuilder),
    update: mockUpdate, // Spy on this
};

mock.module("@repo/database", () => ({
    db: {
        transaction: mock((cb) => cb(mockBuilder)),
        query: mockBuilder.query
    },
    shift: {},
    shiftAssignment: {},
    organization: {},
    user: {},
    member: {},
    location: {},
    idempotencyKey: {}
}));

mock.module("@repo/config", () => ({
    validateShiftTransition: () => true,
    ShiftStatus: {}
}));

mock.module("@repo/observability", () => ({
    logAudit: mock(() => Promise.resolve()),
    AppError: class extends Error {
        constructor(public message: string, public code: string, public statusCode: number) {
            super(message);
        }
    }
}));

const orgId = `org_${nanoid()}`;
const shiftId = `shf_${nanoid()}`;
const workerA = "workerA";
const workerB = "workerB";
const workerC = "workerC";
const workerD = "workerD";

describe("Sprint 2 Features (Unit)", () => {

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
                    actualClockIn: baseDate,
                    actualClockOut: addMinutes(baseDate, 1),
                    breakMinutes: 0
                },
                {
                    id: "asgB", // Grace Period
                    workerId: workerB,
                    actualClockIn: addMinutes(baseDate, 4),
                    actualClockOut: endTime,
                    breakMinutes: 0
                },
                {
                    id: "asgC", // Late Penalty
                    workerId: workerC,
                    actualClockIn: addMinutes(baseDate, 6),
                    actualClockOut: endTime,
                    breakMinutes: 0
                },
                {
                    id: "asgD", // Overtime Flag
                    workerId: workerD,
                    actualClockIn: baseDate,
                    actualClockOut: addMinutes(endTime, 16),
                    breakMinutes: 0
                }
            ]
        };

        mockBuilder.query.shift.findFirst.mockResolvedValue(mockShift);

        // 2. Act
        await approveShift(shiftId, orgId, "test_actor");

        // 3. Assert on Updates
        // 3. Assert on Updates
        // Sorting payloads by workerId might be needed if order isn't guaranteed, 
        // but typically map preserves order of processing if array is ordered. 
        // Our mock returns assignments in order A, B, C, D.
        const updatePayloads = mockUpdateSet.mock.calls.map((c: any[]) => c[0]);

        // Worker A: 1 min
        expect(updatePayloads[0]?.totalDurationMinutes).toBe(1);
        expect(updatePayloads[0]?.payoutAmountCents).toBeUndefined();

        // Worker B: Grace Period (Snaps to 10:00) -> 4h = 240m
        expect(updatePayloads[1]?.totalDurationMinutes).toBe(240);

        // Worker C: Late Start (10:06) -> 3h 54m = 234m
        expect(updatePayloads[2]?.totalDurationMinutes).toBe(234);

        // Worker D: Late Stay -> 4h 16m = 256m
        expect(updatePayloads[3]?.totalDurationMinutes).toBe(256);
    });
});
