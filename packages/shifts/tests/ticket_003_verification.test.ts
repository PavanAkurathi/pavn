
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { approveShift } from "../src/services/approve";
import { addHours } from "date-fns";

// --- Mocks ---
const mockUpdateSet = mock(() => ({ where: mock(() => Promise.resolve({ rowCount: 1 })) }));
const mockUpdate = mock(() => ({ set: mockUpdateSet }));

const mockBuilder: any = {
    insert: mock(() => ({ values: mock(() => Promise.resolve()) })),
    delete: mock(() => ({ where: mock(() => Promise.resolve()) })),
    query: {
        shift: { findFirst: mock(() => Promise.resolve(null)) },
        shiftAssignment: { findMany: mock(() => Promise.resolve([])) },
        member: { findFirst: mock(() => Promise.resolve({ role: 'admin' })) }
    },
    transaction: mock((cb) => cb(mockBuilder)),
    select: mock(() => mockBuilder),
    from: mock(() => mockBuilder),
    where: mock(() => mockBuilder),
    update: mockUpdate,
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

describe("TICKET-003: Approval Workflow - Time Only", () => {
    beforeEach(() => {
        mockUpdate.mockClear();
        mockUpdateSet.mockClear();
        mockBuilder.query.shift.findFirst.mockReset();
    });

    test("approveShift should calculates duration but NOT financial data", async () => {
        // Arrange
        const now = new Date();
        const startTime = now;
        const endTime = addHours(now, 4);

        const mockShift = {
            id: "shift-003",
            organizationId: "org-003",
            status: "completed",
            price: 5000,
            startTime,
            endTime,
            assignments: [
                {
                    id: "assign-1",
                    workerId: "worker-1",
                    actualClockIn: startTime,
                    actualClockOut: endTime,
                    breakMinutes: 0,
                    budgetRateSnapshot: 2000 // Old data that shouldn't be used/updated
                }
            ]
        };

        mockBuilder.query.shift.findFirst.mockResolvedValue(mockShift);

        // Act
        await approveShift("shift-003", "org-003", "admin-user");

        // Assert
        expect(mockUpdate).toHaveBeenCalled();
        const updatePayloadFn = (mockUpdateSet.mock.calls as any[]).find((call: any[]) => call[0].status === 'completed');
        const updatePayload = updatePayloadFn ? updatePayloadFn[0] : null;

        expect(updatePayload).not.toBeNull();

        // 1. Time Verification
        expect(updatePayload!.totalDurationMinutes).toBe(240); // 4 hours

        // 2. Financial Verification (Must be ABSENT)
        expect(updatePayload!.payoutAmountCents).toBeUndefined();
        expect(updatePayload!.budgetRateSnapshot).toBeUndefined();
    });
});
