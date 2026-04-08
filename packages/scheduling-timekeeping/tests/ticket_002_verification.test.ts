import { describe, expect, test, mock, beforeEach } from "bun:test";
import { addHours } from "date-fns";

// --- Mocks ---
const mockUpdateSet = mock(() => ({ where: mock(() => Promise.resolve({ rowCount: 1 })) }));
const mockUpdate = mock(() => ({ set: mockUpdateSet }));
const mockInsert = mock(() => ({ values: mock(() => Promise.resolve()) }));

const mockBuilder: any = {
    insert: mockInsert,
    delete: mock(() => ({ where: mock(() => Promise.resolve()) })),
    query: {
        shiftAssignment: { findFirst: mock(() => Promise.resolve(null)) },
        shift: { findFirst: mock(() => Promise.resolve(null)) },
    },
    transaction: mock((cb) => cb(mockBuilder)),
    select: mock(() => mockBuilder),
    from: mock(() => mockBuilder),
    where: mock(() => mockBuilder),
    limit: mock(() => mockBuilder),
    update: mockUpdate,
};

// Mock dependencies
mock.module("@repo/database", () => ({
    db: {
        transaction: mock((cb) => cb(mockBuilder)),
        query: mockBuilder.query
    },
    TxOrDb: {},
    assignmentAuditEvent: {},
    shiftAssignment: { id: 'sa_id', shiftId: 's_id', workerId: 'w_id' },
    shift: { id: "shift_id", organizationId: "organization_id" }
}));

mock.module("@repo/observability", () => ({
    AppError: class extends Error {
        constructor(public message: string, public code: string, public statusCode: number) {
            super(message);
        }
    }
}));

const { applyManagerTimesheetUpdate } = await import("../src/modules/time-tracking/assignment-admin");

describe("TICKET-002: Refactor Assignment Service", () => {
    beforeEach(() => {
        mockUpdate.mockClear();
        mockUpdateSet.mockClear();
        mockInsert.mockClear();
        mockBuilder.query.shiftAssignment.findFirst.mockReset();
        mockBuilder.query.shift.findFirst.mockReset();
    });

    test("manager timesheet updates calculate duration but NOT cost/rate", async () => {
        // Arrange
        const now = new Date();
        const clockedInTime = addHours(now, -4); // Worked 4 hours

        const mockAssignment = {
            id: "assignment-123",
            shiftId: "shift-123",
            workerId: "worker-123",
            status: "in-progress",
            actualClockIn: clockedInTime,
            effectiveClockIn: clockedInTime,
            breakMinutes: 30
        };
        const mockShift = {
            startTime: addHours(now, -5),
            status: "published",
        };

        mockBuilder.query.shiftAssignment.findFirst.mockResolvedValue(mockAssignment);
        mockBuilder.query.shift.findFirst.mockResolvedValue(mockShift);

        // Act
        await applyManagerTimesheetUpdate(
            "actor-1",
            "org-1",
            "shift-123",
            "worker-123",
            {
                clockIn: clockedInTime,
                clockOut: now,
                breakMinutes: 30,
            },
            "manager",
            mockBuilder // Pass mock tx
        );

        // Assert
        expect(mockUpdate).toHaveBeenCalled();

        const updateCall = mockUpdateSet.mock.calls[0] as any[];
        const updatePayload = updateCall[0];

        // 1. Check Duration Logic
        // 4 hours = 240 mins. Minus 30 min break = 210 mins.
        expect(updatePayload.totalDurationMinutes).toBe(210);

        // 2. Check Cost/Rate Logic (Should be absent/null)
        expect(updatePayload.payoutAmountCents).toBeNull();
        expect(updatePayload.budgetRateSnapshot).toBeUndefined(); // Should not even be in the payload

        // 3. Status
        expect(updatePayload.status).toBe("completed");
    });

    test("manager partial edits do not force completion when clock-out is still missing", async () => {
        const now = new Date();
        const clockedInTime = addHours(now, -2);

        const mockAssignment = {
            id: "assignment-456",
            shiftId: "shift-456",
            workerId: "worker-456",
            status: "active",
            actualClockIn: null,
            actualClockOut: null,
            effectiveClockIn: null,
            breakMinutes: 0
        };
        const mockShift = {
            startTime: addHours(now, -3),
            status: "published",
        };

        mockBuilder.query.shiftAssignment.findFirst.mockResolvedValue(mockAssignment);
        mockBuilder.query.shift.findFirst.mockResolvedValue(mockShift);

        await applyManagerTimesheetUpdate(
            "actor-2",
            "org-1",
            "shift-456",
            "worker-456",
            {
                clockIn: clockedInTime,
            },
            "manager",
            mockBuilder
        );

        const updatePayload = mockUpdateSet.mock.calls[0]![0];
        expect(updatePayload.actualClockIn).toBe(clockedInTime);
        expect(updatePayload.actualClockOut).toBeNull();
        expect(updatePayload.status).toBe("active");
    });
});
