
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { approveShift } from "../src/services/approve";

// Mock Data
const mockQuery = mock(() => Promise.resolve<any>(null));
const mockUpdateSet = mock(() => ({ where: mock(() => Promise.resolve({ rowCount: 1 })) }));
const mockUpdate = mock(() => ({ set: mockUpdateSet }));

const mockBuilder: any = {
    insert: mock(() => ({ values: mock(() => Promise.resolve()) })),
    delete: mock(() => ({ where: mock(() => Promise.resolve()) })),
    query: {
        shift: { findFirst: mockQuery },
        shiftAssignment: { findMany: mock(() => Promise.resolve([])) },
        member: { findFirst: mock(() => Promise.resolve({ role: 'admin' })) }
    },
    transaction: mock((cb) => cb(mockBuilder)),
    select: mock(() => mockBuilder),
    from: mock(() => mockBuilder),
    where: mock(() => mockBuilder),
    update: mockUpdate, // Spy on this
};

// Mock Observability
mock.module("@repo/observability", () => ({
    logAudit: mock(() => Promise.resolve()),
    AppError: class extends Error {
        constructor(public message: string, public code: string, public statusCode: number, public details?: any) {
            super(message);
        }
    }
}));

mock.module("@repo/database", () => ({
    db: {
        query: mockBuilder.query,
        transaction: mockBuilder.transaction
    },
    shift: {},
    shiftAssignment: {},
    organization: {},
    member: {}
}));

mock.module("@repo/config", () => ({
    validateShiftTransition: () => true,
    enforceBreakRules: () => ({ breakMinutes: 30, wasEnforced: true, reason: 'Enforced' })
}));

describe("WH-126 Break Enforcement Removal", () => {
    beforeEach(() => {
        mockUpdate.mockClear();
        mockUpdateSet.mockClear();
        mockQuery.mockClear();
    });

    test("should use manager-specified break time (0 min) instead of enforcing rules", async () => {
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
                    actualClockIn: new Date("2024-01-01T09:00:00Z"),
                    actualClockOut: new Date("2024-01-01T17:00:00Z"),
                    breakMinutes: 0
                }
            ]
        };
        mockQuery.mockResolvedValue(mockShift);

        await approveShift("s1", "org1", "test_actor");

        const updatePayload = (mockUpdateSet.mock.calls as any)[0][0];
        // 8 hours = 480 mins.
        expect(updatePayload.totalDurationMinutes).toBe(480);
        expect(updatePayload.payoutAmountCents).toBeUndefined();
        expect(updatePayload.breakMinutes).toBe(0);
    });

    // ... other tests omitted for brevity but logic is similar ...
});
