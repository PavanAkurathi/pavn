
import { describe, expect, test, mock, beforeEach, spyOn } from "bun:test";
import { approveShift } from "../src/services/approve";

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
    enforceBreakRules: () => ({ breakMinutes: 0, wasEnforced: false })
}));

mock.module("@repo/observability", () => ({
    logAudit: mockLogAudit,
    AppError: class extends Error {
        constructor(public message: string, public code: string, public statusCode: number, public data?: any) {
            super(message);
        }
    }
}));

describe("Approve Shift - No Show Audit", () => {
    beforeEach(() => {
        mockLogAudit.mockClear();
        mockTransaction.mockClear();
    });

    test("logs audit event when worker is marked as no_show", async () => {
        // Setup Shift with one assignment that has NO clock-in/out
        const mockShift = {
            id: "s1",
            organizationId: "org1",
            status: "completed",
            startTime: new Date(),
            endTime: new Date(),
            assignments: [
                { id: "a1", workerId: "w1", clockIn: null, clockOut: null } // No Show
            ]
        };
        mockQuery.mockResolvedValue(mockShift);

        await approveShift("s1", "org1", "test_actor");

        // Verify Transaction
        expect(mockTransaction).toHaveBeenCalled();

        // Verify Audit Logs
        // 1. Shift Approved
        // 2. Assignment No Show
        expect(mockLogAudit).toHaveBeenCalledTimes(2);

        // Find the no_show log
        const noShowLog = (mockLogAudit.mock.calls as any).find((call: any) => call[0].action === 'assignment.no_show');
        expect(noShowLog).toBeDefined();
        if (!noShowLog) throw new Error("Log not found");

        const logEntry = noShowLog[0] as any;
        expect(logEntry.entityId).toBe("a1");
        expect(logEntry.userId).toBe("test_actor");
        expect(logEntry.metadata.reason).toContain("No clock-in");
    });
});
