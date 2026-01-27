
import { describe, expect, test, mock, beforeEach, spyOn } from "bun:test";
import { approveShiftController } from "../src/controllers/approve";

// Mocks
const mockQuery = mock(() => Promise.resolve<any>(null));
const mockTransaction = mock((cb) => cb({
    update: mockUpdate,
    query: {
        shift: { findFirst: mockQuery },
        member: { findFirst: mock(() => Promise.resolve({ role: 'admin' })) }
    }
}));
const mockUpdate = mock(() => ({ set: mockSet }));
const mockSet = mock(() => ({ where: mockWhere }));
const mockWhere = mock(() => Promise.resolve<{ rowCount: number }>({ rowCount: 1 }));

// Mock Observability
const mockLogAudit = mock(() => Promise.resolve());
mock.module("@repo/database", () => ({
    db: {
        query: { shift: { findFirst: mockQuery } },
        transaction: mockTransaction
    },
    // Mock schema objects
    shift: { id: 'shift_id', organizationId: 'org_id', status: 'status' },
    shiftAssignment: { id: 'assign_id' }
}));

mock.module("@repo/config", () => ({
    validateShiftTransition: () => true,
    enforceBreakRules: () => ({ breakMinutes: 30, wasEnforced: true, reason: 'Enforced' })
}));

// Mock AppError class for testing
class MockAppError extends Error {
    constructor(public message: string, public code: string, public statusCode: number, public details?: any) {
        super(message);
        this.name = 'AppError';
    }
}

mock.module("@repo/observability", () => ({
    logAudit: mockLogAudit,
    AppError: MockAppError
}));

describe("WH-126 Break Enforcement Removal", () => {
    beforeEach(() => {
        mockLogAudit.mockClear();
        mockTransaction.mockClear();
        mockUpdate.mockClear();
        mockSet.mockClear();
        mockWhere.mockClear();
        mockQuery.mockClear();
    });

    test("should use manager-specified break time (0 min) instead of enforcing rules", async () => {
        // ... (data setup same as before) ...
        const mockShift = {
            id: "s1",
            organizationId: "org1",
            status: "completed",
            startTime: new Date("2024-01-01T09:00:00Z"),
            endTime: new Date("2024-01-01T17:00:00Z"),
            price: 1000,
            assignments: [
                {
                    id: "a1",
                    workerId: "w1",
                    clockIn: new Date("2024-01-01T09:00:00Z"),
                    clockOut: new Date("2024-01-01T17:00:00Z"),
                    breakMinutes: 0
                }
            ]
        };
        mockQuery.mockResolvedValue(mockShift);

        await approveShiftController("s1", "org1", "test_actor");

        const setCall = (mockSet.mock.calls as any)[0];
        const updatePayload = setCall[0];
        expect(updatePayload.grossPayCents).toBe(8000);
        expect(updatePayload.breakMinutes).toBe(0);
        expect(updatePayload.adjustmentNotes).toBeNull();
    });

    test("should use manager-specified break time (15 min) even if 'illegal'", async () => {
        const mockShift = {
            id: "s1",
            organizationId: "org1",
            status: "completed",
            startTime: new Date("2024-01-01T09:00:00Z"),
            endTime: new Date("2024-01-01T17:00:00Z"),
            price: 1000,
            assignments: [
                {
                    id: "a1",
                    workerId: "w1",
                    clockIn: new Date("2024-01-01T09:00:00Z"),
                    clockOut: new Date("2024-01-01T17:00:00Z"),
                    breakMinutes: 15
                }
            ]
        };
        mockQuery.mockResolvedValue(mockShift);

        await approveShiftController("s1", "org1", "test_actor");
        const updatePayload = (mockSet.mock.calls as any)[0][0];
        expect(updatePayload.grossPayCents).toBe(7750);
        expect(updatePayload.breakMinutes).toBe(15);
    });

    test("should block negative break minutes", async () => {
        const mockShift = {
            id: "s1",
            organizationId: "org1",
            status: "completed",
            startTime: new Date("2024-01-01T09:00:00Z"),
            endTime: new Date("2024-01-01T17:00:00Z"),
            price: 1000,
            assignments: [
                {
                    id: "a1",
                    workerId: "w1",
                    clockIn: new Date("2024-01-01T09:00:00Z"),
                    clockOut: new Date("2024-01-01T17:00:00Z"),
                    breakMinutes: -10
                }
            ]
        };
        mockQuery.mockResolvedValue(mockShift);

        // Expect controller to throw AppError
        try {
            await approveShiftController("s1", "org1", "test_actor");
            expect(true).toBe(false); // Should have thrown
        } catch (e: any) {
            expect(e).toBeInstanceOf(MockAppError);
            expect(e.statusCode).toBe(409);
            expect(e.details.workerIds).toContain("w1");
        }
    });
});
