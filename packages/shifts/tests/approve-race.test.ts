
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { approveShift } from "../src/services/approve";
import { db } from "@repo/database";

// Mock Data
const mockShift = {
    id: "s1",
    organizationId: "org1",
    status: "completed",
    assignments: []
};

// Mock Transaction
const mockTx: any = {
    query: {
        shift: { findFirst: mock(() => Promise.resolve(mockShift)) },
        member: { findFirst: mock(() => Promise.resolve({ role: 'admin' })) }, // Auth check
        shiftAssignment: { findMany: mock(() => Promise.resolve([])) }
    },
    update: mock(() => ({
        set: mock(() => ({
            where: mock(() => Promise.resolve({ rowCount: 1 })) // Success case
        }))
    })),
    // For other calls
    insert: mock(() => ({ values: mock(() => Promise.resolve()) })),
    select: mock(() => ({ from: mock(() => ({ where: mock(() => Promise.resolve([])) })) })),
};

mock.module("@repo/database", () => ({
    db: {
        transaction: mock((cb) => cb(mockTx)), // execute callback with mockTx
        query: mockTx.query
    },
    shift: {},
    organization: {},
    member: {}
}));

mock.module("@repo/config", () => ({
    validateShiftTransition: () => true, // Bypass state machine for unit test
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

describe("approveShift Race Condition", () => {
    test("successfully approves a 'completed' shift (Fixed SHIFT-001)", async () => {
        const response = await approveShift("s1", "org1", "test_actor");
        expect(response.success).toBe(true);
    });
});
