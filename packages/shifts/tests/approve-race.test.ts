import { describe, expect, test, afterAll } from "bun:test";
import { approveShiftController } from "../src/controllers/approve";
import { db } from "@repo/database";
import { shift, organization } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { mock } from "bun:test";

const mockBuilder: any = {
    insert: mock(() => ({ values: mock(() => Promise.resolve()) })),
    delete: mock(() => ({ where: mock(() => Promise.resolve()) })),
    query: {
        shift: { findFirst: mock(() => Promise.resolve(null)) },
        shiftAssignment: { findMany: mock(() => Promise.resolve([])) }
    },
    transaction: mock((cb) => cb(mockBuilder)),
    select: mock(() => mockBuilder),
    from: mock(() => mockBuilder),
    where: mock(() => mockBuilder),
    update: mock(() => ({ set: mock(() => ({ where: mock(() => Promise.resolve({ rowCount: 1 })) })) })),
};

mock.module("@repo/database", () => ({
    db: mockBuilder,
    shift: {},
    organization: {}
}));


const orgId = `org_${nanoid()}`;
const shiftId = `shf_${nanoid()}`;

describe("approveShiftController Race Condition", () => {
    test("successfully approves a 'completed' shift (Fixed SHIFT-001)", async () => {
        // Mock finding the shift
        const mockShift = {
            id: shiftId,
            organizationId: orgId,
            status: "completed",
            assignments: []
        };
        mockBuilder.query.shift.findFirst.mockResolvedValue(mockShift);

        // Action: Attempt to approve
        // We expect it to succeed because the controller logic for 'completed' was fixed (in WH-005/WH-126 context) 
        // OR we are explicitly testing the "race condition" check.
        // Wait, the test name says "successfully approves a 'completed' shift".
        // In the controller, if status is 'completed' and we are approving, 
        // does it throw?
        // The controller logic checks:
        // if (shiftRecord.status === 'approved') throw Race Condition.
        // if (shiftRecord.status === 'completed') it usually proceeds to finalize (idempotent or re-approve).
        // Actually, if it's 'completed', it means workers clocked out, but manager hasn't approved?
        // OR 'completed' means 'Done'?
        // The enum usually is: scheduled -> assigned -> in-progress -> completed (clock out) -> approved (manager) -> paid.
        // So 'completed' is the correct state for approval.

        const response = await approveShiftController(shiftId, orgId, "test_actor");

        // Assertion
        expect(response.status).toBe(200);
        const body = await response.json() as any;
        expect(body.success).toBe(true);
    });


});
