
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { AssignmentService } from "../src/services/assignments";
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
    shiftAssignment: { id: 'sa_id', shiftId: 's_id', workerId: 'w_id' },
    assignmentAuditEvent: {},
    location: {},
    shift: {}
}));

mock.module("@repo/observability", () => ({
    AppError: class extends Error {
        constructor(public message: string, public code: string, public statusCode: number) {
            super(message);
        }
    }
}));

describe("TICKET-002: Refactor Assignment Service", () => {
    beforeEach(() => {
        mockUpdate.mockClear();
        mockUpdateSet.mockClear();
        mockInsert.mockClear();
        mockBuilder.query.shiftAssignment.findFirst.mockReset();
    });

    test("clockOut should calculate duration but NOT cost/rate", async () => {
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

        mockBuilder.query.shiftAssignment.findFirst.mockResolvedValue(mockAssignment);

        // Act
        const result = await AssignmentService.clockOut(
            "actor-1",
            "shift-123",
            "worker-123",
            { lat: 0, lng: 0, accuracy: 10 },
            {},
            mockBuilder // Pass mock tx
        );

        // Assert
        expect(result.success).toBe(true);
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
});
